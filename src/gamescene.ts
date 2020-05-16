import { intRandom, clamp01f, Easing } from "stardazed/core";
import { Vector2, Vector3, Matrix, Quaternion } from "stardazed/vector";
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
		// this.entity.transform.position = new Vector3(28.5, 60, 32.5);
		// this.entity.transform.lookAt(new Vector3(28.5, 0, 32.5), Vector3.forward);
		this.entity.camera!.viewMatrix = Matrix.lookAt(new Vector3(28.5, 60, 32.5), new Vector3(28.5, 0, 32.5), Vector3.forward);
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
		const playerPos = player.transform.position;
		const playerPos2D = playerPos.xz;

		// order viewpoints by distance to player
		this.fixedPoints.sort(function(fpa, fpb) {
			const distA = fpa.pos.sqrDistance(playerPos2D);
			const distB = fpb.pos.sqrDistance(playerPos2D);
			return distA - distB;
		});

		let bestCam = null;
		const minViewDistSq = 3.5 * 3.5;

		for (const camFP of this.fixedPoints) {
			// from this viewpoint, cast a ray to the player and find the first map wall we hit
			const f2p = playerPos2D.sub(camFP.pos);
			const sq = this.maze.grid.castRay(camFP.pos, f2p);

			// calc distances from cam to wall and player
			const camToSquareDistSq = camFP.pos.sqrDistance(sq!.center);
			const camToPlayerDistSq = f2p.sqrMagnitude;

			// if we have a minimum view distance or the player is closer to the cam than the wall then it wins
			if (camToSquareDistSq >= minViewDistSq || camToSquareDistSq > camToPlayerDistSq) {
				bestCam = camFP;
				break;
			}
		}
		if (!bestCam) {
			// console.info("CAM FIND FAIL");
			bestCam = this.fixedPoints[0];
		}

		// place eye at worldspace of cam and treat the viewpoint looking at the home door as a fixed camera
		const camY = bestCam.doorCam ? 5 : 5;
		const camPos = new Vector3(bestCam.pos.x, camY, bestCam.pos.y);

		if (bestCam.doorCam) {
			playerPos.setElements(28.5, 0, 27); // fixed view of the home base
		}
		else {
			playerPos.y = 0.3; // player height oscillates but we don't want a wobbly camera
		}

		// this.entity.transform.position = camPos;
		// this.entity.transform.lookAt(playerPos, Vector3.up);
		this.entity.camera!.viewMatrix = Matrix.lookAt(camPos, playerPos, Vector3.up);
	}
}

class Key extends EntityBehaviour {
	index!: number;
	found!: boolean;

	static rotAxis = Vector3.up;

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
		this.transform.rotation = Quaternion.fromAxisAngle(Key.rotAxis, App.tCur * 40);
	}
}

class Lock extends EntityBehaviour {
	static rotAxis = Vector3.forward;
	key!: Entity;

	awaken() {
		const index = parseInt(this.entity.name.substr(this.entity.name.length - 1), 10);
		this.key = this.scene.findEntityByName(`key${index}`)!;
	}

	update(_dt: number) {
		if ((this.key.behaviour! as Key).found) {
			return;
		}
		const lrt = 5 * Math.sin(App.tCur * 2);
		this.transform.rotation = Quaternion.fromAxisAngle(Lock.rotAxis, lrt);
	}
}

class Door extends EntityBehaviour {
	maze!: Maze;
	state!: "closed" | "opening" | "open";
	openT0!: number;
	keyItems!: Key[];
	origPos!: Vector3;

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

		this.origPos = this.transform.position;
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
			this.transform.position = new Vector3(this.origPos.x + ((Math.random() - 0.5) * 0.03), -3 * step, this.origPos.z);

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
	static rotAxis = Vector3.up;
	static turnSpeed = 180; // degrees / sec
	static speed = 2.3; // grid units / sec

	viewAngle!: number; // degrees
	dieT!: number;
	maze!: Maze;

	awaken() {
		this.viewAngle = 90;
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
		const newPos = this.transform.position;

		if (this.dieT >= 0) {
			const meltStep = (App.tCur - this.dieT) / 4;
			const meltClamp = clamp01f(meltStep);
			this.transform.scale = new Vector3(
				0.25 + meltClamp * .75,
				Math.max(0.1, 0.25 * Math.pow(1 - meltClamp, 2)),
				0.25 + meltClamp * 0.75
			);

			if (meltStep >= 2) {
				// back to original position
				this.transform.scale = Vector3.splat(0.25);
				newPos.setElements(28.5, 0, 25);
				this.viewAngle = 90;
				this.dieT = -1;
			}
		}
		else {
			// -- rotation
			let turnAngle = 0;
			if (Input.keys[KEY_LEFT] || Input.keys[KEY_A]) {
				turnAngle = Player.turnSpeed;
			}
			else if (Input.keys[KEY_RIGHT] || Input.keys[KEY_D]) {
				turnAngle = -Player.turnSpeed;
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
				const moveMat = Matrix.trs(Vector3.zero, Quaternion.fromAxisAngle(Vector3.up, this.viewAngle), Vector3.splat(speed * dt));
				const movePos = moveMat.transformPoint(Vector3.right);

				const oldPos2D = this.transform.position.xz;
				let newPos2D = oldPos2D.add(movePos.xz);

				newPos2D = this.maze.grid.collideAndResolveCircle(newPos2D, this.entity.collider!.radius);

				// warp tunnel
				if (newPos2D.x < 0) {
					newPos2D.x += this.maze.grid.width;
				}
				if (newPos2D.x >= this.maze.grid.width) {
					newPos2D.x -= this.maze.grid.width;
				}
				newPos.xz = newPos2D;
			}
		}

		// -- they all float down here
		newPos.y = 0.35 + 0.05 * Math.sin(App.tCur * 3);
		this.transform.position = newPos;
		this.transform.rotation = Quaternion.fromAxisAngle(Player.rotAxis, this.viewAngle);
	}
}

class Abomination extends EntityBehaviour {
	static stepDuration = 0.33;
	static turnDuration = 0.6;
	static rotAxis = Vector3.up;

	phase!: "move" | "turn";
	nextDir!: Direction;
	pathStep!: number;
	lastStepT!: number;
	direction!: Direction;
	pathPos!: Vector2;
	maze!: Maze;

	static spawnData: { direction: Direction, pathPos: Vector2 }[] = [
		// { direction: "north", pathPos: new Vector2(43, 18) },
		{ direction: "west", pathPos: new Vector2(26, 24) },
		{ direction: "west", pathPos: new Vector2(13, 4) },
		{ direction: "south", pathPos: new Vector2(4, 43) },
		{ direction: "north", pathPos: new Vector2(49, 52) },
		{ direction: "west", pathPos: new Vector2(28, 36) }
	];
	static rotations = {
		north: Quaternion.fromAxisAngle(Abomination.rotAxis, 180),
		west: Quaternion.fromAxisAngle(Abomination.rotAxis, -90),
		south: Quaternion.fromAxisAngle(Abomination.rotAxis, 0),
		east: Quaternion.fromAxisAngle(Abomination.rotAxis, 90)
	};
	static directionVecs = {
		north: new Vector2(0, -1),
		west: new Vector2(-1, 0),
		south: new Vector2(0, 1),
		east: new Vector2(1, 0)
	};

	awaken() {
		const index = parseInt(this.entity.name!.substr(this.entity.name!.length - 1), 10);
		console.info(`pac${index} awakening`);
		this.phase = "move";
		this.pathStep = 0;
		this.lastStepT = App.tCur;
		this.direction = Abomination.spawnData[index].direction;
		this.pathPos = Abomination.spawnData[index].pathPos.clone();
		this.transform.position = new Vector3(this.pathPos.x, 0, this.pathPos.y);
		this.maze = this.scene.findEntityByName("maze")!.behaviour! as Maze;
	}

	update(_dt: number) {
		if (this.phase === "move") {
			if (App.tCur - this.lastStepT > Abomination.stepDuration) {
				this.pathStep++;
				this.entity.meshRenderer!.mesh = assets.meshes["pac" + (1 - (this.pathStep & 1))];
				this.lastStepT = App.tCur;
				const dirVec2 = Abomination.directionVecs[this.direction];
				const dirVec3 = new Vector3(dirVec2.x, 0, dirVec2.y);

				const moveOffset = dirVec3.mul(this.pathStep / 2);
				this.transform.position = new Vector3(this.pathPos.x + 0.5, 0, this.pathPos.y + 0.5).add(moveOffset);
				this.transform.rotation = Abomination.rotations[this.direction];

				// moved 1 full tile
				if (this.pathStep === 2) {
					this.pathPos = this.pathPos.add(dirVec2);
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
			const step = Math.max(0, Math.min(1, (App.tCur - this.lastStepT) / Abomination.turnDuration));
			const fromRot = Abomination.rotations[this.direction];
			const toRot = Abomination.rotations[this.nextDir];
			this.transform.rotation = Quaternion.slerp(fromRot, toRot, step, Easing.bounceOut);

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
					position: new Vector3(28.5, 60, 32.5),
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
					position: Vector3.zero,
				},
				camera: {
					fovy: 65,
					zNear: 0.0125,
					zFar: 25.0,
					fogNear: 2.0,
					fogFar: 8.0
				},
				behaviour: FixedCamera
			},
			{
				name: "maze",
				transform: {
					position: Vector3.zero,
				},
				meshRenderer: {
					meshName: "map"
				},
				behaviour: Maze
			},
			{
				name: "player",
				transform: {
					position: new Vector3(28.5, 0.3, 25),
					scale: new Vector3(0.25, 0.25, 0.25)
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
					position: new Vector3(4.5, .2, 8.5),
					scale: new Vector3(0.25, 0.25, 0.25)
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
					position: new Vector3(52.5, .2, 8.5),
					scale: new Vector3(0.25, 0.25, 0.25)
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
					position: new Vector3(4.5, .2, 48.5),
					scale: new Vector3(0.25, 0.25, 0.25)
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
					position: new Vector3(52.5, .2, 48.5),
					scale: new Vector3(0.25, 0.25, 0.25)
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
					position: new Vector3(29.3, 2.3, 26.8),
					scale: new Vector3(0.005, 0.005, 0.005)
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "lock1",
				transform: {
					position: new Vector3(27.5, 2.3, 26.8),
					scale: new Vector3(0.005, 0.005, 0.005)
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "lock2",
				transform: {
					position: new Vector3(29.3, 0.6, 26.8),
					scale: new Vector3(0.005, 0.005, 0.005)
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "lock3",
				transform: {
					position: new Vector3(27.5, 0.6, 26.8),
					scale: new Vector3(0.005, 0.005, 0.005)
				},
				meshRenderer: {
					meshName: "lock"
				},
				behaviour: Lock
			},
			{
				name: "door",
				transform: {
					position: new Vector3(28.5, 0, 27),
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
					position: new Vector3(28.5, 0, 29.5),
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
					position: Vector3.zero,
					scale: new Vector3(1.25, 1.25, 1.25),
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
					position: Vector3.zero,
					scale: new Vector3(1.25, 1.25, 1.25),
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
					position: Vector3.zero,
					scale: new Vector3(1.25, 1.25, 1.25),
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
					position: Vector3.zero,
					scale: new Vector3(1.25, 1.25, 1.25),
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
					position: Vector3.zero,
					scale: new Vector3(1.25, 1.25, 1.25),
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

		async function meshFromOBJFile(filePath: string, fixedColour: Vector3) {
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
			// const cam = this.curCamera?.transform;
			// if (cam) {
			// 	console.info(cam.position, cam.modelMatrix.getColumn(3).xyz);
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
