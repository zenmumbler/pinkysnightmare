// Pinky's Nightmare
// An entry for LD33 Game Jampo — You are the Monster
// (c) 2015 by Arthur Langereis — @zenmumbler

import { vec2, vec3, mat2, mat3, mat4 } from "stardazed/vector";
import { $1, on, show, hide, assert } from "./util.js";
import { createStandardProgram, createStandardTexture, TriMesh, u8Color, StandardProgram } from "./asset.js";
import { LEVEL_SCALE, genMapMesh, CameraPoint } from "./levelgen.js";
import { loadObjFile } from "./objloader.js";

let gl: WebGLRenderingContext;

interface State {
	t0: number;
	tCur: number;
	tLast: number;

	keys: boolean[];
	meshes: Record<string, TriMesh>;
	textures: Record<string, WebGLTexture>;
	models: Record<string, Model>;
	keyItems: Key[];
	pacs: Abomination[];
	player: Player;
	door: Door;
	grid: Grid;
	end: End;
	camera: Camera;

	modelProgram: StandardProgram;
	texturedProgram: StandardProgram;
	cornerColors: number[][];
}

let state: State;

let active = true, mode = "title";

const KEY_UP = 38, KEY_DOWN = 40, KEY_LEFT = 37, KEY_RIGHT = 39,
	// KEY_SPACE = 32, KEY_RETURN = 13,
	KEY_W = "W".charCodeAt(0), KEY_A = "A".charCodeAt(0), KEY_S = "S".charCodeAt(0), KEY_D = "D".charCodeAt(0);
	// KEY_K = 'K'.charCodeAt(0);


function intRandom(choices: number) {
	return (Math.random() * choices) | 0;
}

function genColorArray(color: number[], times: number) {
	const result = [];
	for (let n = 0; n < times; ++n) {
		result.push(color[0], color[1], color[2]);
	}
	return result;
}


class Model {
	meshes: TriMesh[];
	texture: WebGLTexture | undefined;

	scaleMat = mat4.create();
	rotMat = mat4.create();
	transMat = mat4.create();
	modelMatrix = mat4.create();
	modelViewMatrix = mat4.create();
	normalMatrix = mat3.create();

	constructor(meshes: TriMesh[], texture?: WebGLTexture) {
		this.meshes = meshes;
		this.texture = texture;
	}

	draw(camera: Camera, program: StandardProgram, meshIndex: number) {
		mat4.multiply(this.modelMatrix, this.transMat, this.rotMat);
		mat4.multiply(this.modelMatrix, this.modelMatrix, this.scaleMat);

		// this.debugModelMatrix = mat4.clone(modelMatrix);

		mat4.multiply(this.modelViewMatrix, camera.viewMatrix, this.modelMatrix);
		gl.uniformMatrix4fv(program.mvMatrixUniform, false, this.modelViewMatrix);

		if (program.normalMatrixUniform) {
			mat3.fromMat4(this.normalMatrix, this.modelViewMatrix);
			mat3.invert(this.normalMatrix, this.normalMatrix);
			mat3.transpose(this.normalMatrix, this.normalMatrix);
			gl.uniformMatrix3fv(program.normalMatrixUniform, false, this.normalMatrix);
		}

		this.meshes[meshIndex].draw(gl, program, this.texture);
	}

	setUniformScale(s: number) {
		mat4.fromScaling(this.scaleMat, [s, s, s]);
	}

	setScale(sx: number, sy: number, sz: number) {
		mat4.fromScaling(this.scaleMat, [sx, sy, sz]);
	}

	setPosition(v3: NumArray) {
		mat4.fromTranslation(this.transMat, v3);
	}

	setRotation(axis: NumArray, angle: number) {
		mat4.fromRotation(this.rotMat, angle, axis);
	}
}


function deg2rad(deg: number) {
	return deg * 3.14159265358979323846 / 180.0;
}


class Camera {
	projectionMatrix: Float32Array;
	viewMatrix: Float32Array;
	fixedPoints!: CameraPoint[];

	constructor(canvas: HTMLCanvasElement) {
		const w = canvas.width;
		const h = canvas.height;
		gl.viewport(0, 0, w, h);

		this.projectionMatrix = mat4.create();
		mat4.perspective(this.projectionMatrix, deg2rad(65), w / h, 0.05, 100.0);
		this.viewMatrix = mat4.create();
	}

	pickClosestVantagePoint() {
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
// 			else {
// 				console.info("rejecting", vec2.str(camFP), "because", vec2.str(sq.center), "blocks view to", vec2.str(playerPos), camToSquareDistSq, camToPlayerDistSq);
// 			}
		}
		if (! bestCam) {
// 			console.info("CAM FIND FAIL");
			bestCam = this.fixedPoints[0];
		}

		// place eye at worldspace of cam and treat the viewpoint looking at the home door as a fixed camera
		const camY = bestCam.doorCam ? 6 : 5;
		const camPos = vec3.fromValues(bestCam[0], camY, bestCam[1]);
		vec3.scale(camPos, camPos, LEVEL_SCALE);

		const playerPos = vec3.clone(state.player.position);
		if (bestCam.doorCam) {
			vec3.set(playerPos, 28.5, 0, 27); // fixed view of the home base
		}
		else {
			playerPos[1] = 0.3; // player height oscillates but we don't want a wobbly camera
		}
		vec3.scale(playerPos, playerPos, LEVEL_SCALE);

		mat4.lookAt(this.viewMatrix, camPos, playerPos, [0, 1, 0]);
	}
}


class Square {
	min: NumArray;
	max: NumArray;
	center: NumArray;

	normals = [
		vec2.fromValues(-1, 0), // left
		vec2.fromValues(1, 0), // right
		vec2.fromValues(0, -1), // top
		vec2.fromValues(0, 1), // bottom
		vec2.fromValues(Math.sqrt(2), Math.sqrt(2)) // inner (hack)
	];

	constructor(x: number, y: number) {
		this.min = vec2.fromValues(x, y);
		this.max = vec2.fromValues(x + 1, y + 1);
		this.center = vec2.fromValues(x + .5, y + .5);
	}

	closestPoint(pt2: NumArray): NumArray {
		const closest = vec2.create();
		vec2.max(closest, this.min, pt2);
		vec2.min(closest, this.max, closest);
		return closest;
	}

	containsPoint(pt2: NumArray): boolean {
		return vec2.equals(this.closestPoint(pt2), pt2);
	}

	normalAtClosestPoint(pt2: NumArray): NumArray {
		const closest = this.closestPoint(pt2);

		if (vec2.equals(closest, pt2)) { // pt2 contained in box
			return vec2.clone(this.normals[4]); // HACK: push out diagonally down right
		}

		if (closest[0] === this.min[0]) {
			return vec2.clone(this.normals[0]);
		}
		else if (closest[0] === this.max[0]) {
			return vec2.clone(this.normals[1]);
		}
		else if (closest[1] === this.min[1]) {
			return vec2.clone(this.normals[2]);
		}

		return vec2.clone(this.normals[3]);
	}

	distanceToPoint(pt2: NumArray): number {
		return vec2.distance(this.closestPoint(pt2), pt2);
	}
}

type Direction = "north" | "south" | "east" | "west";

class Grid {
	cells: boolean[];
	path: boolean[];
	width: number;
	height: number;
	private squares: (Square | null)[];

	constructor(width: number, height: number, cells: boolean[], pathCells: boolean[]) {
		this.squares = [];
		let sqix = 0;
		for (let z = 0; z < height; ++z) {
			for (let x = 0; x < width; ++x) {
				this.squares.push(cells[sqix] ? new Square(x, z) : null);
				++sqix;
			}
		}

		this.cells = cells;
		this.path = pathCells;

		this.width = width;
		this.height = height;
	}

	private at(x: number, z: number) {
		return this.squares[(z >> 0) * this.width + (x >> 0)];
	}

	private pathAt(x: number, z: number) {
		return this.path[(z >> 0) * this.width + (x >> 0)];
	}

	pathExits(curPos: NumArray, curDir: Direction) {
		const x = curPos[0], z = curPos[1], exits: { pos: number[], dir: Direction }[] = [];
		assert(this.pathAt(x, z), "you're not on a path!");

		if ((curDir !== "south") && this.pathAt(x, z - 1)) {
			exits.push({ pos: [x, z - 1], dir: "north" });
		}
		if ((curDir !== "east") && this.pathAt(x - 1, z)) {
			exits.push({ pos: [x - 1, z], dir: "west" });
		}
		if ((curDir !== "north") && this.pathAt(x, z + 1)) {
			exits.push({ pos: [x, z + 1], dir: "south" });
		}
		if ((curDir !== "west") && this.pathAt(x + 1, z)) {
			exits.push({ pos: [x + 1, z], dir: "east" });
		}
		return exits;
	}

	set(x: number, z: number, occupied: boolean) {
		const sq = occupied ? new Square(x, z) : null;
		this.squares[(z >> 0) * this.width + (x >> 0)] = sq;
	}

	castRay(from: NumArray, direction: NumArray): Square | null {
		// adapted from sample code at: http://lodev.org/cgtutor/raycasting.html
		vec2.normalize(direction, direction);

		// calculate ray position and direction
		const rayPosX = from[0];
		const rayPosY = from[1];
		const rayDirX = direction[0];
		const rayDirY = direction[1];
		// which box of the map we're in
		let mapX = rayPosX << 0;
		let mapY = rayPosY << 0;

		// length of ray from current position to next x or y-side
		let sideDistX, sideDistY;

		// length of ray from one x or y-side to next x or y-side
		const deltaDistX = Math.sqrt(1 + (rayDirY * rayDirY) / (rayDirX * rayDirX));
		const deltaDistY = Math.sqrt(1 + (rayDirX * rayDirX) / (rayDirY * rayDirY));

		// what direction to step in x or y-direction (either +1 or -1)
		let stepX, stepY;

		let tests = 0; // limit search depth
		// calculate step and initial sideDist
		if (rayDirX < 0) {
			stepX = -1;
			sideDistX = (rayPosX - mapX) * deltaDistX;
		}
		else {
			stepX = 1;
			sideDistX = (mapX + 1.0 - rayPosX) * deltaDistX;
		}
		if (rayDirY < 0) {
			stepY = -1;
			sideDistY = (rayPosY - mapY) * deltaDistY;
		}
		else {
			stepY = 1;
			sideDistY = (mapY + 1.0 - rayPosY) * deltaDistY;
		}

		while (++tests < 200) {
			// jump to next map square, OR in x-direction, OR in y-direction
			if (sideDistX < sideDistY) {
				sideDistX += deltaDistX;
				mapX += stepX;
			}
			else {
				sideDistY += deltaDistY;
				mapY += stepY;
			}

			const sq = this.at(mapX, mapY);
			if (sq) { return sq; }
		}

		return null;
	}

	collideAndResolveCircle(posFrom: NumArray, posTo: NumArray, radius: number): NumArray {
		const direction = vec2.create();
		vec2.subtract(direction, posTo, posFrom);

		const toCheck: Square[] = [];
		const minX = (posTo[0] - radius) << 0, maxX = (posTo[0] + radius) << 0;
		const minZ = (posTo[1] - radius) << 0, maxZ = (posTo[1] + radius) << 0;

		for (let tz = minZ; tz <= maxZ; ++tz) {
			for (let tx = minX; tx <= maxX; ++tx) {
				const sq = this.at(tx, tz);
				if (sq) { toCheck.push(sq); }
			}
		}

		if (! toCheck.length) {
			return posTo;
		}

		let closestSquare = null, closestDist = 99999;
		for (const sq of toCheck) {
			const dist = sq.distanceToPoint(posTo);
			if (dist < closestDist) {
				closestDist = dist;
				closestSquare = sq;
			}
		}

		if (closestSquare && closestDist < radius) {
			// not perfect but will work for now
			const planeNormal = closestSquare.normalAtClosestPoint(posTo);
			vec2.scale(planeNormal, planeNormal, radius - closestDist);
			vec2.add(posTo, posTo, planeNormal);
		}

		return posTo;
	}
}


class Key {
	keyModel: Model;
	lockModel: Model;
	index: number;
	found: boolean;
	keyPosition: NumArray;
	lockPosition: NumArray;
	radius: number;
	rotAxis: NumArray;
	lockRotAxis: NumArray;
	lockRotMax: number;

	constructor(index: number) {
		this.keyModel = new Model([state.meshes["key"]]);
		this.lockModel = new Model([state.meshes["lock"]]);
		this.index = index;
		this.found = false;
		this.keyPosition = vec3.create();
		this.lockPosition = vec3.create();
		this.radius = 0.5;

		this.keyModel.setUniformScale(1);
		this.lockModel.setUniformScale(0.02);

		const scaledPos = vec3.create();
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
		vec3.scale(scaledPos, this.keyPosition, LEVEL_SCALE);
		this.keyModel.setPosition(scaledPos);

		vec3.copy(this.lockPosition, lockPositions[this.index]);
		vec3.scale(scaledPos, this.lockPosition, LEVEL_SCALE);
		this.lockModel.setPosition(scaledPos);
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

	draw() {
		if (! this.found) {
			this.keyModel.setRotation(this.rotAxis, state.tCur * 1.3);
			this.keyModel.draw(state.camera, state.modelProgram, 0);

			const lrt = this.lockRotMax * Math.sin(state.tCur * 2);
			this.lockModel.setRotation(this.lockRotAxis, lrt);
			this.lockModel.draw(state.camera, state.modelProgram, 0);
		}
	}
}


function makeDoorMesh(cornerColors: number[][]) {
	const vertexes: number[] = [], normals: number[] = [], colors: number[] = [], uvs = [];

	const xa = -1.5, xb = 1.5,
		h = 3,
		za = 0, zb = .5;

	function vtx(x: number, y: number, z: number) { vertexes.push(x, y, z); }
	function col(c: number[]) { colors.push(c[0], c[1], c[2]); }
	function nrm6(nrm: number[]) { for (let n = 0; n < 6; ++n) { normals.push(nrm[0], nrm[1], nrm[2]); } }

	vtx(xb, h, za); col(cornerColors[0]); uvs.push(0, 0);
	vtx(xb, 0, za); col(cornerColors[2]); uvs.push(0, 1);
	vtx(xa, 0, za); col(cornerColors[3]); uvs.push(1, 1);

	vtx(xa, 0, za); col(cornerColors[3]); uvs.push(1, 1);
	vtx(xa, h, za); col(cornerColors[1]); uvs.push(1, 0);
	vtx(xb, h, za); col(cornerColors[0]); uvs.push(0, 0);

	nrm6([0, 0, -1]);

	vtx(xb, h, zb); col(cornerColors[4]); uvs.push(0, 0);
	vtx(xb, h, za); col(cornerColors[4]); uvs.push(0, 0);
	vtx(xa, h, za); col(cornerColors[4]); uvs.push(0, 0);

	vtx(xa, h, za); col(cornerColors[4]); uvs.push(0, 0);
	vtx(xa, h, zb); col(cornerColors[4]); uvs.push(0, 0);
	vtx(xb, h, zb); col(cornerColors[4]); uvs.push(0, 0);

	nrm6([0, 1, 0]);

	return new TriMesh(gl, vertexes, normals, colors, uvs);
}


class Door {
	mesh: TriMesh;
	model: Model;
	state: "closed" | "opening" | "open";
	position: MutNumArray;
	openT0 = 0;

	constructor() {
		this.mesh = makeDoorMesh(state.cornerColors);
		this.model = new Model([this.mesh], state.textures["door"]);

		this.state = "closed";

		this.position = vec3.fromValues(28.5, 0, 27);

		this.model.setUniformScale(4);

		const scaledPos = vec3.create();
		vec3.scale(scaledPos, this.position, LEVEL_SCALE);
		this.model.setPosition(scaledPos);

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
			const scaledPos = vec3.scale([], this.position, LEVEL_SCALE);
			this.model.setPosition(scaledPos);

			if (step === 1) {
				// unblock
				state.grid.set(27, 27, false);
				state.grid.set(28, 27, false);
				state.grid.set(29, 27, false);
				this.state = "open";
			}
		}
	}

	draw() {
		this.model.draw(state.camera, state.texturedProgram, 0);
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

			const totalSeconds = this.T << 0;
			const minutes = (totalSeconds / 60) << 0;
			const seconds = totalSeconds - (minutes * 60);

			$1("#minutes").textContent = "" + minutes;
			$1("#seconds").textContent = "" + seconds;

			hide("canvas");
			show("#victory");
			mode = "victory";
		}
	}

	draw() {
	}
}


class Player {
	model = new Model([state.meshes["spookje"]]);
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
		this.model.setUniformScale(1);
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
			const meltClamp = Math.max(0, Math.min(1, meltStep));
			this.model.setScale(1 + meltClamp * 3, Math.max(0.1, Math.pow(1 - meltClamp, 2)), 1 + meltClamp * 3);

			if (meltStep >= 2) {
				// back to original position
				this.model.setUniformScale(1);
				this.moveTo2D(28.5, 25);
				this.viewAngle = Math.PI / -2; // radians
				this.dieT = -1;
			}
		}
		else {
			// -- rotation
			let turnAngle = 0;
			if (state.keys[KEY_LEFT] || state.keys[KEY_A]) {
				turnAngle = -this.turnSpeed;
			}
			else if (state.keys[KEY_RIGHT] || state.keys[KEY_D]) {
				turnAngle = this.turnSpeed;
			}
			this.viewAngle += turnAngle * dt;

			// -- movement
			let speed = 0;
			if (state.keys[KEY_UP] || state.keys[KEY_W]) {
				speed = -this.speed;
			}
			else if (state.keys[KEY_DOWN] || state.keys[KEY_S]) {
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

	draw() {
		const scaledPos = vec3.scale([], this.position, LEVEL_SCALE);
		this.model.setPosition(scaledPos);
		this.model.setRotation(this.rotAxis, -this.viewAngle);
		this.model.draw(state.camera, state.modelProgram, 0);
	}
}


class Abomination {
	model = new Model([state.meshes["pac1"], state.meshes["pac2"]], state.textures["crackpac"]);
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
		{ direction: "north", pathPos: [43, 18] },
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
		this.model.setUniformScale(5);
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
				const scaledPos = vec3.set([0, 0, 0], this.pathPos[0] + 0.5, 0, this.pathPos[1] + 0.5);
				vec3.add(scaledPos, scaledPos, moveOffset);

				vec3.scale(scaledPos, scaledPos, LEVEL_SCALE);
				this.model.setPosition(scaledPos);
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

	draw() {
		this.model.draw(state.camera, state.texturedProgram, 1 - (this.pathStep & 1));
	}
}


function drawScene(camera: Camera) {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// -- PLAIN MODELS
	gl.useProgram(state.modelProgram);
	gl.uniformMatrix4fv(state.modelProgram.projMatrixUniform, false, camera.projectionMatrix);
	if (state.modelProgram.timeUniform) {
		gl.uniform1f(state.modelProgram.timeUniform, state.tCur);
	}

	state.models["map"].draw(camera, state.modelProgram, 0);
	state.player.draw();
	state.keyItems.forEach(function(key) { key.draw(); });

	// -- TEXTURED MODELS
	gl.useProgram(state.texturedProgram);
	gl.uniformMatrix4fv(state.texturedProgram.projMatrixUniform, false, camera.projectionMatrix);
	if (state.texturedProgram.timeUniform) {
		gl.uniform1f(state.texturedProgram.timeUniform, state.tCur);
	}

	state.door.draw();
	state.pacs.forEach(function(pac) { pac.draw(); });
}

function setupGL(then: (c: Camera) => void) {
	const canvas = document.getElementById("stage") as HTMLCanvasElement;
	try {
		gl = canvas.getContext("webgl")!;
	} catch (e) {
		// gl = null;
	}

	if (! gl) {
		alert("Could not initialise WebGL");
	}
	else {
		gl.clearColor(0.1, 0.0, 0.05, 1.0);
		gl.enable(gl.DEPTH_TEST);
		then(new Camera(canvas));
	}
}

function nextFrame() {
	state.tCur = (Date.now() / 1000.0) - state.t0;
	const dt = state.tCur - state.tLast;
	const camera = state.camera;

	// -- update
	state.end.update(dt);
	camera.pickClosestVantagePoint();
	state.player.update(dt);
	state.keyItems.forEach(function(key) { key.update(dt); });
	state.door.update(dt);
	state.pacs.forEach(function(pac) { pac.update(dt); });

	// -- render
	drawScene(camera);

	state.tLast = state.tCur;

	if (active && (state.end.T < 0)) {
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


function init() {
	state = {
		keys: [],
		keyItems: [],
		textures: {},
		meshes: {},
		models: {},
		pacs: []
	} as any as State;

	setupGL(function(camera) {
		state.camera = camera;
		state.modelProgram = createStandardProgram(gl, "standardVert", "standardFrag");
		state.texturedProgram = createStandardProgram(gl, "texturedVert", "texturedFrag");

		window.onkeydown = function(evt: KeyboardEvent) {
			const kc = evt.keyCode;
			state.keys[kc] = true;
			if (! evt.metaKey) {
				evt.preventDefault();
			}
		};
		window.onkeyup = function(evt: KeyboardEvent) {
			const kc = evt.keyCode;
			state.keys[kc] = false;
			if (! evt.metaKey) {
				evt.preventDefault();
			}
		};
		window.onblur = function() { active = false; state.keys = []; };
		window.onfocus = function() {
			active = true;
			if (mode === "game") {
				state.tLast = (Date.now() / 1000.0) - state.t0;
				nextFrame();
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

		genMapMesh(gl, function(mapData) {
			state.meshes["map"] = mapData.mesh;
			state.models["map"] = new Model([mapData.mesh]);
			state.camera.fixedPoints = mapData.cameras;
			state.grid = new Grid(mapData.gridW, mapData.gridH, mapData.grid, mapData.path);
			state.cornerColors = mapData.cornerColors;

			const pacColor = u8Color(213, 215, 17);

			// Promises are for wimps
			createStandardTexture(gl, "assets/doortex.png", function(doorTex) {
				state.textures["door"] = doorTex;

				createStandardTexture(gl, "assets/crackpac.png", function(pacTex) {
					state.textures["crackpac"] = pacTex;

					loadObjFile("assets/pac1.obj", function(pac1Data) {
						const pac1Colors = genColorArray(pacColor, pac1Data.elements);
						state.meshes["pac1"] = new TriMesh(gl, pac1Data.vertexes, pac1Data.normals, pac1Colors, pac1Data.uvs);

						loadObjFile("assets/pac2.obj", function(pac2Data) {
							const pac2Colors = genColorArray(pacColor, pac2Data.elements);
							state.meshes["pac2"] = new TriMesh(gl, pac2Data.vertexes, pac2Data.normals, pac2Colors, pac2Data.uvs);

							loadObjFile("assets/key.obj", function(keyData) {
								const keyColors = genColorArray(u8Color(201, 163, 85), keyData.elements);
								state.meshes["key"] = new TriMesh(gl, keyData.vertexes, keyData.normals, keyColors);

								loadObjFile("assets/lock.obj", function(lockData) {
									const lockColors = genColorArray(u8Color(0x66, 0x77, 0x88), lockData.elements);
									state.meshes["lock"] = new TriMesh(gl, lockData.vertexes, lockData.normals, lockColors);

									loadObjFile("assets/spookje.obj", function(spookjeData) {
										const spookjeColors = genColorArray(u8Color(255, 184, 221), spookjeData.elements);
										state.meshes["spookje"] = new TriMesh(gl, spookjeData.vertexes, spookjeData.normals, spookjeColors);

										showTitle();
									});
								});
							});
						});
					});
				});
			});

		}); // map
	});
}

on(window, "load", init);
