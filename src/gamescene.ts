import { intRandom, clamp01f } from "stardazed/core";
import { vec2, vec3, quat, mat4, mat2 } from "stardazed/vector";
import { $1, show, hide } from "./util";
import { Scene, EntityDescriptor, SceneRenderer, Entity, EntityBehaviour } from "./scene";
import { Grid, Direction } from "./grid";
import { CameraPoint, genMapMesh } from "./levelgen";
import { Input, KEY_A, KEY_D, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_S, KEY_UP, KEY_W } from "./input";
import { loadObjFile } from "./objloader";
import { Assets, u8Color, makeDoorGeometry } from "./asset";
import { App } from "./app";

let assets: Assets;

const enum CollisionType {
	NONE = 0,
	PLAYER = 0x1,
	ENEMY = 0x2,
	KEY = 0x4,
	END = 0x8,
	ALL = 0xF
}

class Maze extends EntityBehaviour {
	grid!: Grid;

	awaken() {
		const mapData = assets.mapData;
		this.grid = new Grid(mapData.gridW, mapData.gridH, mapData.grid, mapData.path);
	}
}

class TopDownCamera extends EntityBehaviour {
	awaken() {
		mat4.lookAt(this.entity.camera!.viewMatrix, [28.5, 60, 32.5], [28.5, 0, 32.5], [0, 0, 1]);
	}
}

class FixedCamera extends EntityBehaviour {
	fixedPoints!: CameraPoint[];
	player!: Entity;
	maze!: Maze;

	awaken() {
		this.fixedPoints = assets.mapData.cameras;
		this.player = this.scene.findEntityByName("player")!;
		this.maze = this.scene.findEntityByName("maze")!.behaviour! as Maze;
	}

	update(_dt: number) {
		const player = this.scene.findEntityByName("player");
		if (! player) {
			return;
		}
		const playerPos = vec3.clone(player.transform.position);
		const playerPos2D = vec2.fromValues(playerPos[0], playerPos[2]);

		// order viewpoints by distance to player
		this.fixedPoints.sort(function(fpa, fpb) {
			const distA = vec2.squaredDistance(fpa, playerPos2D);
			const distB = vec2.squaredDistance(fpb, playerPos2D);
			return distA - distB;
		});

		let bestCam = null;
		const minViewDistSq = 3.5 * 3.5;
		const temp = vec2.create(), f2p = vec2.create();

		for (const camFP of this.fixedPoints) {
			// from this viewpoint, cast a ray to the player and find the first map wall we hit
			vec2.subtract(temp, playerPos2D, camFP);
			vec2.copy(f2p, temp);
			const sq = this.maze.grid.castRay(camFP, temp);

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
		if (!bestCam) {
			// console.info("CAM FIND FAIL");
			bestCam = this.fixedPoints[0];
		}

		// place eye at worldspace of cam and treat the viewpoint looking at the home door as a fixed camera
		const camY = bestCam.doorCam ? 6 : 5;
		const camPos = vec3.fromValues(bestCam[0], camY, bestCam[1]);

		if (bestCam.doorCam) {
			vec3.set(playerPos, 28.5, 0, 27); // fixed view of the home base
		}
		else {
			playerPos[1] = 0.3; // player height oscillates but we don't want a wobbly camera
		}

		mat4.lookAt(this.entity.camera!.viewMatrix, camPos, playerPos, [0, 1, 0]);
	}
}

class Key extends EntityBehaviour {
	index!: number;
	found!: boolean;

	static rotAxis = [0, 1, 0];

	awaken() {
		this.index = parseInt(this.entity.name.substr(this.entity.name.length - 1), 10);
		this.found = false;
	}

	onCollide(_other: Entity) {
		console.info("Collected key", this.index);
		// collided with player
		this.found = true;
		// no longer interested in further collisions
		this.entity.collider!.collisionMask = CollisionType.NONE;
	}

	update(_dt: number) {
		if (this.found) {
			return;
		}
		this.transform.setRotation(Key.rotAxis, App.tCur * 1.3);
	}
}

class Lock extends EntityBehaviour {
	static rotAxis = [0, 0, 1];
	key!: Entity;

	awaken() {
		const index = parseInt(this.entity.name.substr(this.entity.name.length - 1), 10);
		this.key = this.scene.findEntityByName(`key${index}`)!;
	}

	update(_dt: number) {
		if ((this.key.behaviour! as Key).found) {
			return;
		}
		const lrt = (Math.PI / 40) * Math.sin(App.tCur * 2);
		this.transform.setRotation(Lock.rotAxis, lrt);
	}
}

class Door extends EntityBehaviour {
	maze!: Maze;
	state!: "closed" | "opening" | "open";
	openT0!: number;
	keyItems!: Key[];

	awaken() {
		this.state = "closed";
		this.openT0 = 0;

		this.maze = this.scene.findEntityByName("maze")!.behaviour! as Maze;
		this.keyItems = [
			this.scene.findEntityByName("key0")!.behaviour! as Key,
			this.scene.findEntityByName("key1")!.behaviour! as Key,
			this.scene.findEntityByName("key2")!.behaviour! as Key,
			this.scene.findEntityByName("key3")!.behaviour! as Key
		];

		// block the home base
		this.maze.grid.set(27, 27, true);
		this.maze.grid.set(28, 27, true);
		this.maze.grid.set(29, 27, true);
	}

	onCollide(_other: Entity) {
		if (this.state !== "closed") {
			return;
		}

		const allKeys = this.keyItems.every(key => key.found);
		if (allKeys) {
			this.state = "opening";
			this.openT0 = App.tCur;
			this.entity.collider!.collisionMask = CollisionType.NONE;
		}
	}

	update(_dt: number) {
		if (this.state === "opening") {
			const step = Math.max(0, Math.min(1, (App.tCur - this.openT0) / 4));
			this.transform.position[0] = 28.5 + ((Math.random() - 0.5) * 0.03);
			this.transform.position[1] = -3 * step;

			if (step === 1) {
				// unblock
				this.maze.grid.set(27, 27, false);
				this.maze.grid.set(28, 27, false);
				this.maze.grid.set(29, 27, false);
				this.state = "open";
			}
		}
	}
}

class End extends EntityBehaviour {
	onCollide(_other: Entity) {
		this.entity.collider!.collisionMask = CollisionType.NONE;

		const totalSeconds = App.tCur | 0;
		const minutes = (totalSeconds / 60) | 0;
		const seconds = totalSeconds - (minutes * 60);

		$1("#minutes").textContent = "" + minutes;
		$1("#seconds").textContent = "" + seconds;

		App.setScene("victory");
	}
}

class Player extends EntityBehaviour {
	static rotAxis = [0, 1, 0];
	static turnSpeed = Math.PI; // radians / sec
	static speed = 2.3; // grid units / sec

	moveMat = mat2.create();
	movePos = vec2.create();
	viewAngle!: number; // radians
	dieT!: number;
	maze!: Maze;

	awaken() {
		this.viewAngle = Math.PI / -2; // radians
		this.dieT = -1;
		this.maze = this.scene.findEntityByName("maze")!.behaviour! as Maze;
	}

	onCollide(_other: Entity) {
		if (this.dieT < 0) {
			console.info("Player was eaten by Abomination");
			this.dieT = App.tCur;
		}
	}

	update(dt: number) {
		if (this.dieT >= 0) {
			const meltStep = (App.tCur - this.dieT) / 4;
			const meltClamp = clamp01f(meltStep);
			vec3.set(this.transform.scale,
				0.25 + meltClamp * .75,
				Math.max(0.1, 0.25 * Math.pow(1 - meltClamp, 2)),
				0.25 + meltClamp * 0.75
			);

			if (meltStep >= 2) {
				// back to original position
				vec3.set(this.transform.scale, 0.25, 0.25, 0.25);
				vec3.set(this.transform.position, 28.5, this.transform.position[1], 25);
				this.viewAngle = Math.PI / -2; // radians
				this.dieT = -1;
			}
		}
		else {
			// -- rotation
			let turnAngle = 0;
			if (Input.keys[KEY_LEFT] || Input.keys[KEY_A]) {
				turnAngle = -Player.turnSpeed;
			}
			else if (Input.keys[KEY_RIGHT] || Input.keys[KEY_D]) {
				turnAngle = Player.turnSpeed;
			}
			this.viewAngle += turnAngle * dt;

			// -- movement
			let speed = 0;
			if (Input.keys[KEY_UP] || Input.keys[KEY_W]) {
				speed = -Player.speed;
			}
			else if (Input.keys[KEY_DOWN] || Input.keys[KEY_S]) {
				speed = Player.speed;
			}

			if (speed !== 0) {
				mat2.fromRotation(this.moveMat, this.viewAngle);
				mat2.scale(this.moveMat, this.moveMat, [speed * dt, speed * dt]);
				vec2.set(this.movePos, 1, 0);
				vec2.transformMat2(this.movePos, this.movePos, this.moveMat);

				const oldPos = vec2.fromValues(this.transform.position[0], this.transform.position[2]);
				let newPos: MutNumArray = vec2.create();
				vec2.add(newPos, oldPos, this.movePos);

				newPos = this.maze.grid.collideAndResolveCircle(oldPos, newPos, this.entity.collider!.radius);

				// warp tunnel
				if (newPos[0] < 0) {
					newPos[0] += this.maze.grid.width;
				}
				if (newPos[0] >= this.maze.grid.width) {
					newPos[0] -= this.maze.grid.width;
				}
				this.transform.position[0] = newPos[0];
				this.transform.position[2] = newPos[1];
			}
		}

		// -- they all float down here
		this.transform.position[1] = 0.35 + 0.05 * Math.sin(App.tCur * 3);
		this.transform.setRotation(Player.rotAxis, -this.viewAngle);
	}
}

class Abomination extends EntityBehaviour {
	static stepDuration = 0.33;
	static turnDuration = 0.6;
	static rotAxis = [0, 1, 0];

	phase!: "move" | "turn";
	nextDir!: Direction;
	pathStep!: number;
	lastStepT!: number;
	direction!: Direction;
	pathPos!: NumArray;
	maze!: Maze;

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

	awaken() {
		const index = parseInt(this.entity.name!.substr(this.entity.name!.length - 1), 10);
		console.info(`pac${index} awakening`);
		this.phase = "move";
		this.pathStep = 0;
		this.lastStepT = App.tCur;
		this.direction = Abomination.spawnData[index].direction;
		this.pathPos = vec2.clone(Abomination.spawnData[index].pathPos);
		this.transform.setPosition(this.pathPos[0], 0, this.pathPos[1]);
		this.maze = this.scene.findEntityByName("maze")!.behaviour! as Maze;
	}

	update(_dt: number) {
		if (this.phase === "move") {
			if (App.tCur - this.lastStepT > Abomination.stepDuration) {
				this.pathStep++;
				this.entity.meshRenderer!.mesh = assets.meshes["pac" + (1 - (this.pathStep & 1))];
				this.lastStepT = App.tCur;
				const dirVec2 = Abomination.directionVecs[this.direction];
				const dirVec3 = vec3.fromValues(dirVec2[0], 0, dirVec2[1]);

				const moveOffset = vec3.scale([0, 0, 0], dirVec3, this.pathStep / 2);
				vec3.add(this.transform.position, [this.pathPos[0] + 0.5, 0, this.pathPos[1] + 0.5], moveOffset);

				this.transform.setRotation(Abomination.rotAxis, Abomination.rotations[this.direction]);

				// moved 1 full tile
				if (this.pathStep === 2) {
					vec2.add(this.pathPos, this.pathPos, dirVec2);
					this.pathStep = 0;

					const exits = this.maze.grid.pathExits(this.pathPos, this.direction);
					const exit = exits[intRandom(exits.length)];

					if (exit.dir !== this.direction) {
						this.nextDir = exit.dir;
						this.phase = "turn";
					}
				}
			}
		} // move
		else if (this.phase === "turn") {
			let step = Math.max(0, Math.min(1, (App.tCur - this.lastStepT) / Abomination.turnDuration));
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

			this.transform.setRotation(Abomination.rotAxis, fromAngle + rotation * step);

			if (step >= 1.0) {
				this.phase = "move";
				this.direction = this.nextDir;
				// self.nextDir = "";
				this.lastStepT = App.tCur;
			}
		}
	}
}

export class GameScene extends Scene {
	cameraIndex = 0;

	buildEntities(canvas: HTMLCanvasElement) {
		const entityDescs: EntityDescriptor[] = [
			{
				name: "topdowncamera",
				transform: {
					position: [28.5, 60, 32.5],
					rotation: [0, 0, 0, 1],
					scale: [1, 1, 1]
				},
				camera: {
					fovy: 65,
					zNear: 1,
					zFar: 100,
					fogNear: 100.0,
					fogFar: 1000.0,
				},
				behaviour: TopDownCamera
			},
			{
				name: "fixedcamera",
				transform: {
					position: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1, 1, 1]
				},
				camera: {
					fovy: 65,
					zNear: 0.05,
					zFar: 25.0,
					fogNear: 2.0,
					fogFar: 8.0
				},
				behaviour: FixedCamera
			},
			{
				name: "maze",
				transform: {
					position: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1, 1, 1]
				},
				meshRenderer: {
					meshName: "map"
				},
				behaviour: Maze
			},
			{
				name: "player",
				transform: {
					position: [28.5, 0.3, 25],
					rotation: [0, 0, 0, 1],
					scale: [0.25, 0.25, 0.25]
				},
				meshRenderer: {
					meshName: "spookje"
				},
				collider: {
					radius: .25,
					collisionType: CollisionType.PLAYER,
					collisionMask: CollisionType.ENEMY,
				},
				behaviour: Player
			},
			{
				name: "key0",
				transform: {
					position: [4.5, .2, 8.5],
					rotation: [0, 0, 0, 1],
					scale: [0.25, 0.25, 0.25]
				},
				meshRenderer: {
					meshName: "key",
				},
				collider: {
					radius: .5,
					collisionType: CollisionType.KEY,
					collisionMask: CollisionType.PLAYER,
				},
				behaviour: Key
			},
			{
				name: "key1",
				transform: {
					position: [52.5, .2, 8.5],
					rotation: [0, 0, 0, 1],
					scale: [0.25, 0.25, 0.25]
				},
				meshRenderer: {
					meshName: "key"
				},
				collider: {
					radius: .5,
					collisionType: CollisionType.KEY,
					collisionMask: CollisionType.PLAYER,
				},
				behaviour: Key
			},
			{
				name: "key2",
				transform: {
					position: [4.5, .2, 48.5],
					rotation: [0, 0, 0, 1],
					scale: [0.25, 0.25, 0.25]
				},
				meshRenderer: {
					meshName: "key"
				},
				collider: {
					radius: .5,
					collisionType: CollisionType.KEY,
					collisionMask: CollisionType.PLAYER,
				},
				behaviour: Key
			},
			{
				name: "key3",
				transform: {
					position: [52.5, .2, 48.5],
					rotation: [0, 0, 0, 1],
					scale: [0.25, 0.25, 0.25]
				},
				meshRenderer: {
					meshName: "key"
				},
				collider: {
					radius: .5,
					collisionType: CollisionType.KEY,
					collisionMask: CollisionType.PLAYER,
				},
				behaviour: Key
			},
			{
				name: "lock0",
				transform: {
					position: [29.3, 2.3, 26.8],
					rotation: [0, 0, 0, 1],
					scale: [0.005, 0.005, 0.005]
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "lock1",
				transform: {
					position: [27.5, 2.3, 26.8],
					rotation: [0, 0, 0, 1],
					scale: [0.005, 0.005, 0.005]
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "lock2",
				transform: {
					position: [29.3, 0.6, 26.8],
					rotation: [0, 0, 0, 1],
					scale: [0.005, 0.005, 0.005]
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "lock3",
				transform: {
					position: [27.5, 0.6, 26.8],
					rotation: [0, 0, 0, 1],
					scale: [0.005, 0.005, 0.005]
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "door",
				transform: {
					position: [28.5, 0, 27],
					rotation: [0, 0, 0, 1],
					scale: [1, 1, 1],
				},
				meshRenderer: {
					meshName: "door",
					textureName: "door",
				},
				collider: {
					radius: 2,
					collisionType: CollisionType.END,
					collisionMask: CollisionType.PLAYER,
				},
				behaviour: Door
			},
			{
				name: "end",
				transform: {
					position: [28.5, 0, 29.5],
					rotation: quat.create(),
					scale: [1, 1, 1]
				},
				collider: {
					radius: 1,
					collisionType: CollisionType.END,
					collisionMask: CollisionType.PLAYER,
				},
				behaviour: End
			},
			{
				name: "pac0",
				transform: {
					position: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1.25, 1.25, 1.25],
				},
				meshRenderer: {
					meshName: "pac0",
					textureName: "crackpac",
				},
				collider: {
					radius: 1.4,
					collisionType: CollisionType.ENEMY,
					collisionMask: CollisionType.NONE,
				},
				behaviour: Abomination
			},
			{
				name: "pac1",
				transform: {
					position: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1.25, 1.25, 1.25],
				},
				meshRenderer: {
					meshName: "pac0",
					textureName: "crackpac",
				},
				collider: {
					radius: 1.4,
					collisionType: CollisionType.ENEMY,
					collisionMask: CollisionType.NONE,
				},
				behaviour: Abomination
			},
			{
				name: "pac2",
				transform: {
					position: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1.25, 1.25, 1.25],
				},
				meshRenderer: {
					meshName: "pac0",
					textureName: "crackpac",
				},
				collider: {
					radius: 1.4,
					collisionType: CollisionType.ENEMY,
					collisionMask: CollisionType.NONE,
				},
				behaviour: Abomination
			},
			{
				name: "pac3",
				transform: {
					position: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1.25, 1.25, 1.25],
				},
				meshRenderer: {
					meshName: "pac0",
					textureName: "crackpac",
				},
				collider: {
					radius: 1.4,
					collisionType: CollisionType.ENEMY,
					collisionMask: CollisionType.NONE,
				},
				behaviour: Abomination
			},
			{
				name: "pac4",
				transform: {
					position: [0, 0, 0],
					rotation: [0, 0, 0, 1],
					scale: [1.25, 1.25, 1.25],
				},
				meshRenderer: {
					meshName: "pac0",
					textureName: "crackpac",
				},
				collider: {
					radius: 1.4,
					collisionType: CollisionType.ENEMY,
					collisionMask: CollisionType.NONE,
				},
				behaviour: Abomination
			},
		];

		this.createEntities(canvas, assets, entityDescs);
		this.curCamera = this.cameras[1].camera!;
	}

	async load(renderer: SceneRenderer) {
		assets = {
			textures: {},
			meshes: {}
		} as any;

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
		assets.mapData = mapData;
		assets.textures["door"] = stuff[1];
		assets.textures["crackpac"] = stuff[2];
		assets.meshes["map"] = mapData.mesh;
		assets.meshes["pac0"] = stuff[3];
		assets.meshes["pac1"] = stuff[4];
		assets.meshes["key"] = stuff[5];
		assets.meshes["lock"] = stuff[6];
		assets.meshes["spookje"] = stuff[7];
		assets.meshes["door"] = renderer.createMesh(makeDoorGeometry(mapData.cornerColors));

		console.info("Asset load", Date.now() - before, "ms");

		this.buildEntities(renderer.canvas);
	}

	update(dt: number) {
		super.update(dt);
		if (Input.keys[32]) {
			// for (const k of this.keyItems) {
			// 	k.props.found = true;
			// }
		}
		else if (Input.keys[13]) {
			this.cameraIndex = 1 - this.cameraIndex;
			this.curCamera = this.cameras[this.cameraIndex].camera!;
		}
	}

	show() {
		show("canvas");
	}

	hide() {
		hide("canvas");
	}
}
