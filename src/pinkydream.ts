// Pinky's Nightmare
// An entry for LD33 Game Jampo — You are the Monster
// (c) 2015-2020 by Arthur Langereis — @zenmumbler

import { deg2rad, intRandom, clamp01f } from "stardazed/core";
import { vec2, vec3, mat2, mat4, quat } from "stardazed/vector";
import { $1, on, show, hide } from "./util.js";
import { u8Color, makeDoorGeometry } from "./asset.js";
import { Renderer, RenderTexture, RenderMesh, RenderProgram, WebGLRenderer, WebGPURenderer } from "./render";
import { genMapMesh, CameraPoint, MapData } from "./levelgen.js";
import { loadObjFile } from "./objloader.js";
import { Grid, Direction } from "./grid";
import { Input, KEY_A, KEY_D, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_S, KEY_UP, KEY_W } from "./input";

interface Assets {
	meshes: Record<string, RenderMesh>;
	textures: Record<string, RenderTexture>;
	modelProgram: RenderProgram;
	texturedProgram: RenderProgram;
}

let assets: Assets;
let renderer: Renderer;

// ----- Sort of an Object ECS

interface Entity {
	// name?: string;
}

interface Transformable {
	readonly position: NumArray;
	readonly rotation: NumArray;
	readonly scale: NumArray;
	modelMatrix: Float32Array;
}

function isTransformable(e: any): e is Transformable {
	return e && typeof e === "object" &&
		e.position !== undefined && e.position.length === 3 &&
		e.rotation !== undefined && e.rotation.length === 4 &&
		e.scale !== undefined && e.scale.length === 3;
}

interface Camera {
	readonly projectionMatrix: Float32Array;
	readonly viewMatrix: Float32Array;
	readonly fogLimits: Float32Array;
}

function isCamera(e: any): e is Camera {
	return e && typeof e === "object" &&
		e.projectionMatrix instanceof Float32Array &&
		e.viewMatrix instanceof Float32Array &&
		e.fogLimits instanceof Float32Array;
}

interface Updatable {
	update(dt: number): void;
}

function isUpdatable(e: any): e is Updatable {
	return e && typeof e === "object" && typeof e.update === "function";
}

interface Drawable {
	mesh: RenderMesh;
	program: RenderProgram;
	texture?: RenderTexture;
}

function isDrawable(d: any): d is Drawable {
	return d && typeof d === "object" &&
		typeof d.mesh === "object" &&
		typeof d.program === "object" &&
		(typeof d.texture === "object" || d.texture === undefined);
}

interface Collidable {
	readonly radius: number;
	readonly collisionType: number;
	readonly collisionMask: number;
	onCollide?(other: Collidable & Transformable): void;
}

function isCollidable(e: any): e is Collidable {
	return e && typeof e === "object" &&
		(e.onCollide === undefined || typeof e.onCollide === "function")
		&& typeof e.radius === "number"
		&& typeof e.collisionType === "number"
		&& typeof e.collisionMask === "number";
}

class Scene {
	entities: Entity[] = [];
	updatables: Updatable[] = [];
	drawables: (Drawable & Transformable)[] = [];
	collidables: (Collidable & Transformable)[] = [];
	cameras: Camera[] = [];
	matrices: Float32Array[] = [];
	curCamera: Camera | undefined;

	addEntity<E extends Entity>(e: E): E {
		this.entities.push(e);

		if (isCamera(e)) {
			this.cameras.push(e);
		}
		if (isUpdatable(e)) {
			this.updatables.push(e);
		}
		if (isTransformable(e)) {
			e.modelMatrix = mat4.create();
			if (isDrawable(e)) {
				this.drawables.push(e);
			}
			if (isCollidable(e)) {
				this.collidables.push(e);
			}
		}
		return e;
	}

	update(dt: number) {
		for (const u of this.updatables) {
			u.update(dt);
		}

		// handle collisions (N log N - I think)
		const collCount = this.collidables.length;
		for (let ca = 0; ca < collCount; ++ca) {
			const colliderA = this.collidables[ca];
			const posA = [colliderA.position[0], colliderA.position[2]];
			for (let cb = ca + 1; cb < collCount; ++cb) {
				const colliderB = this.collidables[cb];
				const a2b = (colliderB.collisionType & colliderA.collisionMask) && colliderA.onCollide;
				const b2a = (colliderA.collisionType & colliderB.collisionMask) && colliderB.onCollide;
				if (a2b || b2a) {
					const posB = [colliderB.position[0], colliderB.position[2]];
					const maxRadius = Math.max(colliderA.radius, colliderB.radius);
					if (vec2.distance(posA, posB) < maxRadius) {
						if (a2b) {
							colliderA.onCollide!(colliderB);
						}
						if (b2a) {
							colliderB.onCollide!(colliderA);
						}
					}
				}
			}
		}
	}

	draw() {
		const { curCamera } = this;
		if (! curCamera) {
			return;
		}
		const pass = renderer.createPass(curCamera.projectionMatrix, curCamera.viewMatrix, curCamera.fogLimits);

		for (const d of this.drawables) {
			pass.draw({
				modelMatrix: mat4.fromRotationTranslationScale(d.modelMatrix, d.rotation, d.position, d.scale),
				mesh: d.mesh,
				program: d.program,
				texture: d.texture
			});
		}

		pass.finish();
	}

	show() {
		// show this scene
	}

	hide() {
		// hide this scene
	}
}

// -------

const enum CollisionType {
	NONE   = 0,
	PLAYER = 0x1,
	ENEMY  = 0x2,
	KEY    = 0x4,
	END    = 0x8,
	ALL    = 0xF
}

class Maze {
	position = [0, 0, 0];
	rotation = quat.create();
	scale = [1, 1, 1];
	mesh: RenderMesh;
	program = assets.modelProgram;

	constructor(mapMesh: RenderMesh) {
		this.mesh = mapMesh;
	}
}

class TopDownCamera {
	projectionMatrix: Float32Array;
	viewMatrix: Float32Array;
	fogLimits = new Float32Array([100.0, 1000.0]);

	constructor(canvas: HTMLCanvasElement) {
		const w = canvas.width;
		const h = canvas.height;
		this.projectionMatrix = mat4.create();
		this.viewMatrix = mat4.create();

		mat4.lookAt(this.viewMatrix, [28.5, 60, 32.5], [28.5, 0, 32.5], [0, 0, 1]);
		mat4.perspective(this.projectionMatrix, deg2rad(65), w / h, 1, 100.0);
	}
}

class FixedCamera {
	projectionMatrix: Float32Array;
	viewMatrix: Float32Array;
	fogLimits = new Float32Array([2.0, 8.0]);

	fixedPoints: CameraPoint[];
	player: Player;
	grid: Grid;

	constructor(canvas: HTMLCanvasElement, fixedPoints: CameraPoint[], player: Player, grid: Grid) {
		this.fixedPoints = fixedPoints;
		this.player = player;
		this.grid = grid;

		const w = canvas.width;
		const h = canvas.height;
		this.projectionMatrix = mat4.create();
		mat4.perspective(this.projectionMatrix, deg2rad(65), w / h, 0.05, 25.0);
		this.viewMatrix = mat4.create();
	}

	update(_dt: number) {
		const playerPos2D = vec2.fromValues(this.player.position[0], this.player.position[2]);

		// order viewpoints by distance to player
		this.fixedPoints.sort(function(fpa, fpb) {
			const distA = vec2.squaredDistance(fpa, playerPos2D);
			const distB = vec2.squaredDistance(fpb, playerPos2D);
			return (distA < distB) ? -1 : ((distB < distA) ? 1 : 0);
		});

		let bestCam = null;
		const minViewDistSq = 3.5 * 3.5;
		const temp = vec2.create(), f2p = vec2.create();

		for (const camFP of this.fixedPoints) {
			// from this viewpoint, cast a ray to the player and find the first map wall we hit
			vec2.subtract(temp, playerPos2D, camFP);
			vec2.copy(f2p, temp);
			const sq = this.grid.castRay(camFP, temp);

			// calc distances from cam to wall and player
			const camToSquareDistSq = vec2.squaredDistance(camFP, sq!.center);
			let camToPlayerDistSq = vec2.length(f2p);
			camToPlayerDistSq = camToPlayerDistSq * camToPlayerDistSq;

			// if we have a minimum view distance or the player is closer to the cam than the wall then it wins
			if (camToSquareDistSq >= minViewDistSq || camToSquareDistSq > camToPlayerDistSq) {
				bestCam = camFP;
				break;
			}
			// else {
			// 	console.info("rejecting", vec2.str(camFP), "because", vec2.str(sq.center), "blocks view to", vec2.str(playerPos), camToSquareDistSq, camToPlayerDistSq);
			// }
		}
		if (! bestCam) {
			// console.info("CAM FIND FAIL");
			bestCam = this.fixedPoints[0];
		}

		// place eye at worldspace of cam and treat the viewpoint looking at the home door as a fixed camera
		const camY = bestCam.doorCam ? 6 : 5;
		const camPos = vec3.fromValues(bestCam[0], camY, bestCam[1]);

		const playerPos = vec3.clone(this.player.position);
		if (bestCam.doorCam) {
			vec3.set(playerPos, 28.5, 0, 27); // fixed view of the home base
		}
		else {
			playerPos[1] = 0.3; // player height oscillates but we don't want a wobbly camera
		}

		mat4.lookAt(this.viewMatrix, camPos, playerPos, [0, 1, 0]);
	}
}

class Key {
	radius = 0.5;
	collisionType = CollisionType.KEY;
	collisionMask = CollisionType.PLAYER;
	position: NumArray;
	rotation = quat.create();
	scale = [0.25, 0.25, 0.25];
	mesh = assets.meshes["key"];
	program = assets.modelProgram;
	
	found: boolean;
	index: number;

	static rotAxis = [0, 1, 0];

	static keyPositions = [
		[4.5, .2, 8.5],
		[52.5, .2, 8.5],
		[4.5, .2, 48.5],
		[52.5, .2, 48.5]
	];

	constructor(index: number) {
		this.index = index;
		this.found = false;
		this.position = vec3.copy(vec3.create(), Key.keyPositions[this.index]);
	}

	onCollide(_other: Collidable) {
		console.info("Collected key", this.index);
		// collided with player
		this.found = true;
		// no longer interested in further collisions
		this.collisionMask = CollisionType.NONE;
	}

	update(_dt: number) {
		if (this.found) {
			return;
		}

		quat.setAxisAngle(this.rotation, Key.rotAxis, App.tCur * 1.3);
	}
}

class Lock {
	position: NumArray;
	rotation = quat.create();
	scale = [0.005, 0.005, 0.005];
	mesh = assets.meshes["lock"];
	program = assets.modelProgram;

	key: Key;

	static rotAxis = [0, 0, 1];

	static lockPositions = [
		[29.3, 2.3, 26.8],
		[27.5, 2.3, 26.8],
		[29.3, 0.6, 26.8],
		[27.5, 0.6, 26.8]
	];

	constructor(key: Key) {
		this.key = key;
		this.position = Lock.lockPositions[this.key.index];
	}

	update(_dt: number) {
		if (this.key.found) {
			return;
		}
		const lrt = (Math.PI / 40) * Math.sin(App.tCur * 2);
		quat.setAxisAngle(this.rotation, Lock.rotAxis, lrt);
	}
}

class Door {
	radius = 2;
	collisionType = CollisionType.END;
	collisionMask = CollisionType.PLAYER;
	position = [28.5, 0, 27];
	rotation = quat.create();
	scale = [1, 1, 1];
	mesh = assets.meshes.door;
	program = assets.texturedProgram;
	texture = assets.textures["door"];

	state: "closed" | "opening" | "open";
	openT0 = 0;

	grid: Grid;
	keyItems: Key[];

	constructor(grid: Grid, keyItems: Key[]) {
		this.grid = grid;
		this.keyItems = keyItems;
		
		this.state = "closed";

		// block the home base
		this.grid.set(27, 27, true);
		this.grid.set(28, 27, true);
		this.grid.set(29, 27, true);
	}

	onCollide(_other: Collidable) {
		if (this.state !== "closed") {
			return;
		}

		const allKeys = this.keyItems.every(key => key.found);
		if (allKeys) {
			this.state = "opening";
			this.collisionMask = CollisionType.NONE;
			this.openT0 = App.tCur;
		}
	}

	update(_dt: number) {
		if (this.state === "opening") {
			const step = Math.max(0, Math.min(1, (App.tCur - this.openT0) / 4));
			this.position[0] = 28.5 + ((Math.random() - 0.5) * 0.03);
			this.position[1] = -3 * step;

			if (step === 1) {
				// unblock
				this.grid.set(27, 27, false);
				this.grid.set(28, 27, false);
				this.grid.set(29, 27, false);
				this.state = "open";
			}
		}
	}
}


class End {
	radius = 1;
	collisionType = CollisionType.END;
	collisionMask = CollisionType.PLAYER;
	position = [28.5, 0, 29.5];
	rotation = quat.create();
	scale = [1, 1, 1];

	onCollide(_other: Collidable) {
		this.collisionMask = CollisionType.NONE;

		const totalSeconds = App.tCur | 0;
		const minutes = (totalSeconds / 60) | 0;
		const seconds = totalSeconds - (minutes * 60);

		$1("#minutes").textContent = "" + minutes;
		$1("#seconds").textContent = "" + seconds;

		App.setScene(victoryScreen);
	}
}


class Player {
	radius = .25; // grid units
	collisionType = CollisionType.PLAYER;
	collisionMask = CollisionType.ENEMY;
	position = vec3.fromValues(28.5, 0.3, 25); // grid units
	rotation = quat.create();
	scale = [0.25, 0.25, 0.25];
	mesh = assets.meshes["spookje"];
	program = assets.modelProgram;

	viewAngle = Math.PI / -2; // radians
	turnSpeed = Math.PI; // radians / sec
	speed = 2.3; // grid units / sec
	dieT = -1;
	rotAxis = vec3.fromValues(0, 1, 0);
	moveMat = mat2.create();
	movePos = vec2.create();
	grid: Grid;

	constructor(grid: Grid) {
		this.grid = grid;
	}

	moveTo2D(x: number, z: number) {
		vec3.set(this.position, x, this.position[1], z);
	}

	onCollide(_other: Collidable) {
		if (this.dieT < 0) {
			console.info("Player was eaten by Abomination");
			this.dieT = App.tCur;
		}
	}

	update(dt: number) {
		if (this.dieT >= 0) {
			const meltStep = (App.tCur - this.dieT) / 4;
			const meltClamp = clamp01f(meltStep);
			vec3.set(this.scale,
				0.25 + meltClamp * .75,
				Math.max(0.1, 0.25 * Math.pow(1 - meltClamp, 2)),
				0.25 + meltClamp * 0.75
			);

			if (meltStep >= 2) {
				// back to original position
				vec3.set(this.scale, 0.25, 0.25, 0.25);
				this.moveTo2D(28.5, 25);
				this.viewAngle = Math.PI / -2; // radians
				this.dieT = -1;
			}
		}
		else {
			// -- rotation
			let turnAngle = 0;
			if (Input.keys[KEY_LEFT] || Input.keys[KEY_A]) {
				turnAngle = -this.turnSpeed;
			}
			else if (Input.keys[KEY_RIGHT] || Input.keys[KEY_D]) {
				turnAngle = this.turnSpeed;
			}
			this.viewAngle += turnAngle * dt;

			// -- movement
			let speed = 0;
			if (Input.keys[KEY_UP] || Input.keys[KEY_W]) {
				speed = -this.speed;
			}
			else if (Input.keys[KEY_DOWN] || Input.keys[KEY_S]) {
				speed = this.speed;
			}

			if (speed !== 0) {
				mat2.fromRotation(this.moveMat, this.viewAngle);
				mat2.scale(this.moveMat, this.moveMat, [speed * dt, speed * dt]);
				vec2.set(this.movePos, 1, 0);
				vec2.transformMat2(this.movePos, this.movePos, this.moveMat);

				const oldPos = vec2.fromValues(this.position[0], this.position[2]);
				let newPos: MutNumArray = vec2.create();
				vec2.add(newPos, oldPos, this.movePos);

				newPos = this.grid.collideAndResolveCircle(oldPos, newPos, this.radius);

				// warp tunnel
				if (newPos[0] < 0) {
					newPos[0] += this.grid.width;
				}
				if (newPos[0] >= this.grid.width) {
					newPos[0] -= this.grid.width;
				}
				this.position[0] = newPos[0];
				this.position[2] = newPos[1];
			}
		}

		// -- they all float down here
		this.position[1] = 0.35 + 0.05 * Math.sin(App.tCur * 3);
		quat.setAxisAngle(this.rotation, this.rotAxis, -this.viewAngle);
	}
}


class Abomination {
	radius = 1.4;
	collisionType = CollisionType.ENEMY;
	collisionMask = CollisionType.NONE;
	position: NumArray;
	rotation = quat.create();
	scale = [1.25, 1.25, 1.25];
	mesh = assets.meshes["pac0"];
	program = assets.texturedProgram;
	texture = assets.textures["crackpac"];

	grid: Grid;

	phase = "move";
	nextDir: Direction = "north";
	pathStep = 0;
	lastStepT = 0;
	stepDuration = 0.33;
	turnDuration = 0.6;
	rotAxis = vec3.fromValues(0, 1, 0);
	direction: Direction;
	pathPos: NumArray;

	static spawnData: { direction: Direction, pathPos: number[] }[] = [
		// { direction: "north", pathPos: [43, 18] },
		{ direction: "west", pathPos: [26, 24] },
		{ direction: "west", pathPos: [13, 4] },
		{ direction: "south", pathPos: [4, 43] },
		{ direction: "north", pathPos: [49, 52] },
		{ direction: "west", pathPos: [28, 36] }
	];
	static rotations = {
		north: Math.PI,
		west: Math.PI / -2,
		south: 0,
		east: Math.PI / 2
	};
	static directionVecs = {
		north: [0, -1],
		west: [-1, 0],
		south: [0, 1],
		east: [1, 0]
	};

	constructor(index: number, grid: Grid) {
		this.grid = grid;
		this.direction = Abomination.spawnData[index].direction;
		this.pathPos = vec2.clone(Abomination.spawnData[index].pathPos);
		this.position = [this.pathPos[0], 0, this.pathPos[1]];
	}

	update(_dt: number) {
		if (this.phase === "move") {
			if (App.tCur - this.lastStepT > this.stepDuration) {
				this.pathStep++;
				this.mesh = assets.meshes["pac" + (1 - (this.pathStep & 1))];
				this.lastStepT = App.tCur;
				const dirVec2 = Abomination.directionVecs[this.direction];
				const dirVec3 = vec3.fromValues(dirVec2[0], 0, dirVec2[1]);

				const moveOffset = vec3.scale([0, 0, 0], dirVec3, this.pathStep / 2);
				vec3.set(this.position, this.pathPos[0] + 0.5, 0, this.pathPos[1] + 0.5);
				vec3.add(this.position, this.position, moveOffset);

				quat.setAxisAngle(this.rotation, this.rotAxis, Abomination.rotations[this.direction]);

				// moved 1 full tile
				if (this.pathStep === 2) {
					vec2.add(this.pathPos, this.pathPos, dirVec2);
					this.pathStep = 0;

					const exits = this.grid.pathExits(this.pathPos, this.direction);
					const exit = exits[intRandom(exits.length)];

					if (exit.dir !== this.direction) {
						this.nextDir = exit.dir;
						this.phase = "turn";
					}
				}
			}
		} // move
		else if (this.phase === "turn") {
			let step = Math.max(0, Math.min(1, (App.tCur - this.lastStepT) / this.turnDuration));
			step = step * step;

			const fromAngle = Abomination.rotations[this.direction];
			const toAngle = Abomination.rotations[this.nextDir];
			let rotation = toAngle - fromAngle;
			if (rotation < (Math.PI * -1.01)) {
				rotation += Math.PI * 2;
			}
			if (rotation > (Math.PI * 1.01)) {
				rotation -= Math.PI * 2;
			}

			quat.setAxisAngle(this.rotation, this.rotAxis, fromAngle + rotation * step);

			if (step >= 1.0) {
				this.phase = "move";
				this.direction = this.nextDir;
				// this.nextDir = "";
				this.lastStepT = App.tCur;
			}
		}
	}
}

// ---------

class GameScene extends Scene {
	keyItems: Key[] = [];
	cameraIndex = 0;

	constructor(canvas: HTMLCanvasElement, mapData: MapData) {
		super();

		const grid = new Grid(mapData.gridW, mapData.gridH, mapData.grid, mapData.path);
		this.addEntity(new Maze(mapData.mesh));

		const player = this.addEntity(new Player(grid));

		this.addEntity(new FixedCamera(canvas, mapData.cameras, player, grid));
		this.addEntity(new TopDownCamera(canvas));

		for (let ki = 0; ki < 4; ++ki) {
			const key = this.addEntity(new Key(ki));
			this.addEntity(new Lock(key));
			this.keyItems.push(key);
		}

		this.addEntity(new Door(grid, this.keyItems));
		this.addEntity(new End());

		this.addEntity(new Abomination(0, grid));
		this.addEntity(new Abomination(1, grid));
		this.addEntity(new Abomination(2, grid));
		this.addEntity(new Abomination(3, grid));
		this.addEntity(new Abomination(4, grid));

		this.curCamera = this.cameras[this.cameraIndex];
	}

	update(dt: number) {
		super.update(dt);
		if (Input.keys[32]) {
			for (const k of this.keyItems) {
				k.found = true;
			}
		}
		else if (Input.keys[13]) {
			this.cameraIndex = 1 - this.cameraIndex;
			this.curCamera = this.cameras[this.cameraIndex];
		}
	}

	show() {
		show("canvas");
	}

	hide() {
		hide("canvas");
	}
}

class TitleScreen extends Scene {
	constructor() {
		super();
		on("#run", "click", function() {
			App.setScene(gameScene);
		});
	}

	show() {
		show("#run");
	}

	hide() {
		hide("#run");
	}
}

class VictoryScreen extends Scene {
	constructor() {
		super();
		on("#victory", "click", function() {
			location.reload();
		});
	}

	show() {
		show("#victory");
	}

	hide() {
		hide("#victory");
	}
}

// ---------

let gameScene: GameScene;
let titleScreen: TitleScreen;
let victoryScreen: VictoryScreen;

class Application {
	curScene: Scene | undefined;
	t0 = 0;
	tLast = 0;
	tCur = 0;

	constructor() {
		Input.onActiveChange = (active) => {
			if (active) {
				this.tLast = (Date.now() / 1000.0) - this.t0;
				this.nextFrame();
			}
		};
	}

	setScene(newScene: Scene | undefined) {
		if (newScene === this.curScene) {
			return;
		}
		if (this.curScene) {
			this.curScene.hide();
		}
		if (newScene) {
			this.t0 = Date.now() / 1000;
			this.tLast = this.t0;
			this.tCur = this.t0;

			newScene.show();
		}
		this.curScene = newScene;
	}

	nextFrame() {
		if (this.curScene) {
			App.tCur = (Date.now() / 1000.0) - this.t0;
			const dt = this.tCur - this.tLast;
			this.curScene.update(dt);
			this.curScene.draw();
			this.tLast = this.tCur;
		}

		if (Input.active) {
			requestAnimationFrame(() => this.nextFrame());
		}
	}
}
const App = new Application();

// ---------

async function init() {
	assets = {
		textures: {},
		meshes: {},
		fogLimits: new Float32Array(2)
	} as any as Assets;

	const canvas = document.querySelector("canvas")!;
	renderer = new WebGLRenderer();
	await renderer.setup(canvas);

	assets.modelProgram = renderer.createProgram("standard");
	assets.texturedProgram = renderer.createProgram("textured");

	async function meshFromOBJFile(filePath: string, fixedColour: number[]) {
		const geom = await loadObjFile(filePath, fixedColour);
		return renderer.createMesh(geom);
	}

	const pacColor = u8Color(213, 215, 17);
	const before = Date.now();
	const stuff = await Promise.all([
		genMapMesh(renderer),
		renderer.createTexture("assets/doortex.png"),
		renderer.createTexture("assets/crackpac.png"),
		meshFromOBJFile("assets/pac1.obj", pacColor),
		meshFromOBJFile("assets/pac2.obj", pacColor),
		meshFromOBJFile("assets/key.obj", u8Color(201, 163, 85)),
		meshFromOBJFile("assets/lock.obj", u8Color(0x66, 0x77, 0x88)),
		meshFromOBJFile("assets/spookje.obj", u8Color(255, 184, 221)),
	]);

	const mapData = stuff[0];
	assets.textures["door"] = stuff[1];
	assets.textures["crackpac"] = stuff[2];
	assets.meshes["pac0"] = stuff[3];
	assets.meshes["pac1"] = stuff[4];
	assets.meshes["key"] = stuff[5];
	assets.meshes["lock"] = stuff[6];
	assets.meshes["spookje"] = stuff[7];
	assets.meshes["door"] = renderer.createMesh(makeDoorGeometry(mapData.cornerColors));

	console.info("Asset load", Date.now() - before, "ms");

	gameScene = new GameScene(canvas, mapData);
	titleScreen = new TitleScreen();
	victoryScreen = new VictoryScreen();

	App.setScene(titleScreen);
	App.nextFrame();
}

on(window, "load", init);
