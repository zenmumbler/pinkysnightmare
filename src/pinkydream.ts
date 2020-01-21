// Pinky's Nightmare
// An entry for LD33 Game Jampo — You are the Monster
// (c) 2015-2020 by Arthur Langereis — @zenmumbler

import { deg2rad, intRandom, clamp01f } from "stardazed/core";
import { vec2, vec3, mat2, mat4 } from "stardazed/vector";
import { $1, on, show, hide } from "./util.js";
import { u8Color, makeDoorGeometry } from "./asset.js";
import { Renderer, RenderTexture, RenderMesh, RenderModel, WebGLRenderer, RenderProgram, RenderPass } from "./render";
import { genMapMesh, CameraPoint } from "./levelgen.js";
import { loadObjFile } from "./objloader.js";
import { Grid, Direction } from "./grid";
import { Input, KEY_A, KEY_D, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_S, KEY_UP, KEY_W } from "./input";

interface State {
	// timing
	t0: number;
	tCur: number;
	tLast: number;

	// entities
	keyItems: Key[];
	pacs: Abomination[];
	player: Player;
	door: Door;
	grid: Grid;
	end: End;
	camera: FixedCamera;

	// assets and render stuff
	meshes: Record<string, RenderMesh>;
	textures: Record<string, RenderTexture>;
	mapModel: RenderModel;
	modelProgram: RenderProgram;
	texturedProgram: RenderProgram;
	fogLimits: Float32Array;
}

let state: State;
let renderer: Renderer;
const bird = false;

let mode = "title";

const KEY_UP = 38, KEY_DOWN = 40, KEY_LEFT = 37, KEY_RIGHT = 39,
	KEY_W = "W".charCodeAt(0), KEY_A = "A".charCodeAt(0), KEY_S = "S".charCodeAt(0), KEY_D = "D".charCodeAt(0);


// ----- Sort of an Object ECS

interface Entity {
	readonly type: string;
}

interface Camera {
	readonly projectionMatrix: Float32Array;
	readonly viewMatrix: Float32Array;
}

function isCamera(e: any): e is Camera {
	return e && typeof e === "object" &&
		e.projectionMatrix instanceof Float32Array &&
		e.viewMatrix instanceof Float32Array;
}

interface Updatable {
	update(dt: number): void;
}

function isUpdatable(e: any): e is Updatable {
	return e && typeof e === "object" && typeof e.update === "function";
}

interface Drawable {
	draw(pass: RenderPass): void;
}

function isDrawable(e: any): e is Drawable {
	return e && typeof e === "object" && typeof e.draw === "function";
}

interface Collidable {
	readonly radius: number;
	onCollide?(other: Entity & Collidable): void;
}

function isCollidable(e: any): e is Collidable {
	return e && typeof e === "object" &&
		(e.onCollide === undefined || typeof e.onCollide === "function")
		&& typeof e.radius === "number";
}

class Scene {
	updatables: Updatable[] = [];
	drawables: Drawable[] = [];
	collidables: Collidable[] = [];
	camera: Camera | undefined;

	addEntity<E extends Entity>(e: E) {
		if (isCamera(e)) {
			this.camera = e;
		}
		if (isUpdatable(e)) {
			this.updatables.push(e);
		}
		if (isDrawable(e)) {
			this.drawables.push(e);
		}
		if (isCollidable(e)) {
			this.collidables.push(e);
		}
	}
}

// -------

class FixedCamera {
	projectionMatrix: Float32Array;
	viewMatrix: Float32Array;
	fixedPoints: CameraPoint[];

	constructor(canvas: HTMLCanvasElement, fixedPoints: CameraPoint[]) {
		const w = canvas.width;
		const h = canvas.height;

		this.projectionMatrix = mat4.create();
		if (bird) {
			mat4.perspective(this.projectionMatrix, deg2rad(65), w / h, 1, 100.0);
			state.fogLimits[0] = 100.0;
			state.fogLimits[1] = 1000.0;
		}
		else {
			mat4.perspective(this.projectionMatrix, deg2rad(65), w / h, 0.05, 25.0);
			state.fogLimits[0] = 2.0;
			state.fogLimits[1] = 8.0;
		}
		this.viewMatrix = mat4.create();
		this.fixedPoints = fixedPoints;
	}

	update(_dt: number) {
		const playerPos2D = vec2.fromValues(state.player.position[0], state.player.position[2]);

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
			const sq = state.grid.castRay(camFP, temp);

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

		const playerPos = vec3.clone(state.player.position);
		if (bestCam.doorCam) {
			vec3.set(playerPos, 28.5, 0, 27); // fixed view of the home base
		}
		else {
			playerPos[1] = 0.3; // player height oscillates but we don't want a wobbly camera
		}

		if (bird) {
			mat4.lookAt(this.viewMatrix, [28.5, 60, 32.5], [28.5, 0, 32.5], [0, 0, 1]);
		}
		else {
			mat4.lookAt(this.viewMatrix, camPos, playerPos, [0, 1, 0]);
		}
	}
}

class Key {
	keyModel: RenderModel;
	lockModel: RenderModel;
	index: number;
	found: boolean;
	keyPosition: NumArray;
	lockPosition: NumArray;
	radius: number;
	rotAxis: NumArray;
	lockRotAxis: NumArray;
	lockRotMax: number;

	constructor(index: number) {
		this.keyModel = renderer.createModel([state.meshes["key"]]);
		this.lockModel = renderer.createModel([state.meshes["lock"]]);
		this.index = index;
		this.found = false;
		this.keyPosition = vec3.create();
		this.lockPosition = vec3.create();
		this.radius = 0.5;

		this.keyModel.setUniformScale(0.25);
		this.lockModel.setUniformScale(0.005);

		this.rotAxis = vec3.fromValues(0, 1, 0);

		this.lockRotAxis = [0, 0, 1];
		this.lockRotMax = Math.PI / 40;

		const keyPositions = [
			[4.5, .2, 8.5],
			[52.5, .2, 8.5],
			[4.5, .2, 48.5],
			[52.5, .2, 48.5]
		];

		const lockPositions = [
			[29.3, 2.3, 26.8],
			[27.5, 2.3, 26.8],
			[29.3, 0.6, 26.8],
			[27.5, 0.6, 26.8]
		];

		vec3.copy(this.keyPosition, keyPositions[this.index]);
		this.keyModel.setPosition(this.keyPosition);

		vec3.copy(this.lockPosition, lockPositions[this.index]);
		this.lockModel.setPosition(this.lockPosition);
	}

	update(_dt: number) {
		if (this.found) {
			return;
		}

		const playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
		const myPos = vec2.fromValues(this.keyPosition[0], this.keyPosition[2]);

		const maxRadius = Math.max(this.radius, state.player.radius);
		if (vec2.distance(playerPos, myPos) < maxRadius) {
			this.found = true;
		}
	}

	draw(pass: RenderPass) {
		if (! this.found) {
			this.keyModel.setRotation(this.rotAxis, state.tCur * 1.3);
			pass.draw({ model: this.keyModel, program: state.modelProgram });

			const lrt = this.lockRotMax * Math.sin(state.tCur * 2);
			this.lockModel.setRotation(this.lockRotAxis, lrt);
			pass.draw({ model: this.lockModel, program: state.modelProgram });
		}
	}
}


class Door {
	mesh: RenderMesh;
	model: RenderModel;
	state: "closed" | "opening" | "open";
	position: MutNumArray;
	openT0 = 0;

	constructor() {
		this.mesh = state.meshes.door;
		this.model = renderer.createModel([this.mesh], state.textures["door"]);

		this.state = "closed";

		this.position = vec3.fromValues(28.5, 0, 27);

		this.model.setUniformScale(1);

		this.model.setPosition(this.position);

		// block the home base
		state.grid.set(27, 27, true);
		state.grid.set(28, 27, true);
		state.grid.set(29, 27, true);
	}

	update(_dt: number) {
		if (this.state === "closed") {
			const allKeys = state.keyItems.every(function(key) { return key.found; });

			if (allKeys) {
				const playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
				const myPos = vec2.fromValues(this.position[0], this.position[2]);

				if (vec2.distance(playerPos, myPos) < 2) {
					this.state = "opening";
					this.openT0 = state.tCur;
				}
			}
		}
		else if (this.state === "opening") {
			const step = Math.max(0, Math.min(1, (state.tCur - this.openT0) / 4));
			this.position[0] = 28.5 + ((Math.random() - 0.5) * 0.03);
			this.position[1] = -3 * step;
			this.model.setPosition(this.position);

			if (step === 1) {
				// unblock
				state.grid.set(27, 27, false);
				state.grid.set(28, 27, false);
				state.grid.set(29, 27, false);
				this.state = "open";
			}
		}
	}

	draw(pass: RenderPass) {
		pass.draw({ model: this.model, program: state.texturedProgram });
	}
}


class End {
	position = [28.5, 29.5];
	radius = 1;
	fadeSec = 4;
	T = -1;

	update(_dt: number) {
		const playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
		if (vec2.distance(playerPos, this.position) < this.radius) {
			this.T = state.tCur;

			const totalSeconds = this.T | 0;
			const minutes = (totalSeconds / 60) | 0;
			const seconds = totalSeconds - (minutes * 60);

			$1("#minutes").textContent = "" + minutes;
			$1("#seconds").textContent = "" + seconds;

			showVictory();
		}
	}

	draw() {
	}
}


class Player {
	model = renderer.createModel([state.meshes["spookje"]]);
	position = vec3.fromValues(0, 0.3, 0); // grid units
	viewAngle = Math.PI / -2; // radians
	turnSpeed = Math.PI; // radians / sec
	speed = 2.3; // grid units / sec
	radius = .25; // grid units
	dieT = -1;
	rotAxis = vec3.fromValues(0, 1, 0);
	moveMat = mat2.create();
	movePos = vec2.create();

	constructor() {
		this.model.setUniformScale(0.25);
	}

	moveTo2D(x: number, z: number) {
		vec3.set(this.position, x, this.position[1], z);
	}

	die() {
		if (this.dieT < 0) {
			this.dieT = state.tCur;
		}
	}

	update(dt: number) {
		if (this.dieT >= 0) {
			const meltStep = (state.tCur - this.dieT) / 4;
			const meltClamp = clamp01f(meltStep);
			this.model.setScale(0.25 + meltClamp * .75, Math.max(0.1, 0.25 * Math.pow(1 - meltClamp, 2)), 0.25 + meltClamp * 0.75);

			if (meltStep >= 2) {
				// back to original position
				this.model.setUniformScale(0.25);
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

				newPos = state.grid.collideAndResolveCircle(oldPos, newPos, this.radius);

				// warp tunnel
				if (newPos[0] < 0) {
					newPos[0] += state.grid.width;
				}
				if (newPos[0] >= state.grid.width) {
					newPos[0] -= state.grid.width;
				}
				this.position[0] = newPos[0];
				this.position[2] = newPos[1];
			}
		}

		// -- they all float down here
		this.position[1] = 0.35 + 0.05 * Math.sin(state.tCur * 3);
	}

	draw(pass: RenderPass) {
		this.model.setPosition(this.position);
		this.model.setRotation(this.rotAxis, -this.viewAngle);
		pass.draw({ model: this.model, program: state.modelProgram });
	}
}


class Abomination {
	model = renderer.createModel([state.meshes["pac1"], state.meshes["pac2"]], state.textures["crackpac"]);
	phase = "move";
	nextDir: Direction = "north";
	pathStep = 0;
	lastStepT = 0;
	stepDuration = 0.33;
	turnDuration = 0.6;
	radius = 1.4;
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

	constructor(index: number) {
		this.model.setUniformScale(1.25);
		this.direction = Abomination.spawnData[index].direction;
		this.pathPos = vec2.clone(Abomination.spawnData[index].pathPos);
	}

	update(_dt: number) {
		if (this.phase === "move") {
			if (state.tCur - this.lastStepT > this.stepDuration) {
				this.pathStep++;
				this.lastStepT = state.tCur;
				const dirVec2 = Abomination.directionVecs[this.direction];
				const dirVec3 = vec3.fromValues(dirVec2[0], 0, dirVec2[1]);

				const moveOffset = vec3.scale([0, 0, 0], dirVec3, this.pathStep / 2);
				const visualPos = vec3.set([0, 0, 0], this.pathPos[0] + 0.5, 0, this.pathPos[1] + 0.5);
				vec3.add(visualPos, visualPos, moveOffset);

				this.model.setPosition(visualPos);
				this.model.setRotation(this.rotAxis, Abomination.rotations[this.direction]);

				// moved 1 full tile
				if (this.pathStep === 2) {
					vec2.add(this.pathPos, this.pathPos, dirVec2);
					this.pathStep = 0;

					const exits = state.grid.pathExits(this.pathPos, this.direction);
					const exit = exits[intRandom(exits.length)];

					if (exit.dir !== this.direction) {
						this.nextDir = exit.dir;
						this.phase = "turn";
					}
				}
			}
		} // move
		else if (this.phase === "turn") {
			let step = Math.max(0, Math.min(1, (state.tCur - this.lastStepT) / this.turnDuration));
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

			this.model.setRotation(this.rotAxis, fromAngle + rotation * step);

			if (step >= 1.0) {
				this.phase = "move";
				this.direction = this.nextDir;
				// this.nextDir = "";
				this.lastStepT = state.tCur;
			}
		}

		// -- check collisions against player
		const playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);

		const maxRadius = Math.max(this.radius, state.player.radius);
		if (vec2.distance(playerPos, this.pathPos) < maxRadius) {
			state.player.die();
		}
	}

	draw(pass: RenderPass) {
		pass.draw({ model: this.model, program: state.texturedProgram, meshIndex: 1 - (this.pathStep & 1) });
	}
}


function drawScene(camera: FixedCamera) {
	const pass = renderer.createPass(camera.projectionMatrix, camera.viewMatrix, state.fogLimits);

	// -- PLAIN MODELS
	pass.draw({ model: state.mapModel, program: state.modelProgram });
	state.player.draw(pass);
	state.keyItems.forEach(function(key) { key.draw(pass); });

	// -- TEXTURED MODELS
	state.door.draw(pass);
	state.pacs.forEach(function(pac) { pac.draw(pass); });

	pass.finish();
}

function nextFrame() {
	state.tCur = (Date.now() / 1000.0) - state.t0;
	const dt = state.tCur - state.tLast;
	const camera = state.camera;

	// -- update
	state.end.update(dt);
	camera.update(dt);
	state.player.update(dt);
	state.keyItems.forEach(function(key) { key.update(dt); });
	state.door.update(dt);
	state.pacs.forEach(function(pac) { pac.update(dt); });

	// -- render
	drawScene(camera);

	state.tLast = state.tCur;

	if (Input.active && (mode === "game")) {
		requestAnimationFrame(nextFrame);
	}
}


function run() {
	show("canvas");
	mode = "game";

	state.t0 = Date.now() / 1000.0;
	state.tCur = 0;
	state.tLast = 0;

	state.player = new Player();
	state.player.moveTo2D(28.5, 25);

	state.keyItems.push(new Key(0));
	state.keyItems.push(new Key(1));
	state.keyItems.push(new Key(2));
	state.keyItems.push(new Key(3));

	state.door = new Door();
	state.end = new End();

	state.pacs.push(new Abomination(0));
	state.pacs.push(new Abomination(1));
	state.pacs.push(new Abomination(2));
	state.pacs.push(new Abomination(3));
	state.pacs.push(new Abomination(4));

	nextFrame();
}


function showTitle() {
	mode = "title";
	hide("canvas");
	hide("#victory");
	show("#run");
}

function showVictory() {
	mode = "victory";
	hide("canvas");
	show("#victory");
	hide("#run");
}


async function init() {
	state = {
		keys: [],
		keyItems: [],
		textures: {},
		meshes: {},
		pacs: [],
		fogLimits: new Float32Array(2)
	} as any as State;

	const canvas = document.querySelector("canvas")!;
	renderer = new WebGLRenderer();
	await renderer.setup(canvas);

	state.modelProgram = renderer.createProgram("standard");
	state.texturedProgram = renderer.createProgram("textured");

	Input.onActiveChange = (active) => {
		if (active) {
			if (mode === "game") {
				state.tLast = (Date.now() / 1000.0) - state.t0;
				nextFrame();
			}
		}
	};

	on("#run", "click", function() {
		hide("#run");
		hide("#victory");
		run();
	});

	on("#victory", "click", function() {
		location.reload();
	});

	genMapMesh(renderer).then(async function(mapData) {
		state.mapModel = renderer.createModel([mapData.mesh]);
		state.camera = new FixedCamera(canvas, mapData.cameras);
		state.grid = new Grid(mapData.gridW, mapData.gridH, mapData.grid, mapData.path);

		state.meshes["door"] = renderer.createMesh(makeDoorGeometry(mapData.cornerColors));

		const pacColor = u8Color(213, 215, 17);

		state.textures["door"] = await renderer.createTexture("assets/doortex.png");
		state.textures["crackpac"] = await renderer.createTexture("assets/crackpac.png");

		const pac1Geom = await loadObjFile("assets/pac1.obj", pacColor);
		state.meshes["pac1"] = renderer.createMesh(pac1Geom);

		const pac2Geom = await loadObjFile("assets/pac2.obj", pacColor);
		state.meshes["pac2"] = renderer.createMesh(pac2Geom);

		const keyGeom = await loadObjFile("assets/key.obj", u8Color(201, 163, 85));
		state.meshes["key"] = renderer.createMesh(keyGeom);

		const lockGeom = await loadObjFile("assets/lock.obj", u8Color(0x66, 0x77, 0x88));
		state.meshes["lock"] = renderer.createMesh(lockGeom);

		const spookjeGeom = await loadObjFile("assets/spookje.obj", u8Color(255, 184, 221));
		state.meshes["spookje"] = renderer.createMesh(spookjeGeom);

		showTitle();
	});
}

on(window, "load", init);
