// Pinky's Nightmare
// An entry for LD33 Game Jampo — You are the Monster
// (c) 2015-6 by Arthur Langereis — @zenmumbler

/// <reference path="../../stardazed-tx/build/stardazed-tx.d.ts" />

import io = sd.io;
import math = sd.math;
import world = sd.world;
import render = sd.render;
import meshdata = sd.meshdata;
import dom = sd.dom;
import asset = sd.asset;

var state = {
	rctx: <render.RenderContext>null,
	scene: <world.Scene>null,
	
	t0: 0,
	tCur: 0,
	tLast: 0,

	camera: <Camera>null,
	player: <Player>null,
	door: <Door>null,
	end: <End>null,
	grid: <Grid>null,

	meshes: <{ [index: string]: world.MeshInstance }>{},
	textures: <{ [index: string]: render.Texture }>{},
	models: <{ [index: string]: Model }>{},

	cornerColors: <sd.Float3[]>[],

	keyItems: <Key[]>[],
	pacs: <Abomination[]>[]
};

var active = true, mode = "title";


function u8Color(r: number, g: number, b: number): ArrayOfNumber {
	return [r/255, g/255, b/255];
}


class Renderable {
	constructor(public mesh: world.MeshInstance, public material: asset.Material) {}
}


function makeSimpleMaterial(texture: render.Texture): asset.Material {
	const mat = asset.makeMaterial("");
	if (texture) {
		mat.albedoTexture = { name: "tex", texture: texture };
	}
	return mat;
}


class Model {
	entities: world.EntityInfo[] = [];
	curIndex = 0;

	constructor(...renderables: Renderable[]) {
		sd.assert(renderables.length > 0, "must have some things to show for a Model");

		for (const r of renderables) {
			this.entities.push(state.scene.makeEntity({
				mesh: r.mesh,
				stdModel: { materials: [r.material] }
			}));
		}

		this.setActiveIndex(0);
	}

	setActiveIndex(index: number) {
		for (var i = 0; i < this.entities.length; ++i) {
			state.scene.stdModelMgr.setEnabled(this.entities[i].stdModel, i == index);
		}
	}

	setUniformScale(s: number) {
		for (var e of this.entities) {
			state.scene.transformMgr.setScale(e.transform, [s, s, s]);
		}
	}

	setScale(sx: number, sy: number, sz: number) {
		for (var e of this.entities) {
			state.scene.transformMgr.setScale(e.transform, [sx, sy, sz]);
		}
	}

	setPosition(v3: sd.Float3) {
		for (var e of this.entities) {
			state.scene.transformMgr.setPosition(e.transform, v3);
		}
	}

	setRotation(axis: sd.Float3, angle: number) {
		for (var e of this.entities) {
			state.scene.transformMgr.setRotation(e.transform, quat.setAxisAngle([], axis, angle));
		}
	}
}


class Camera {
	w: number;
	h: number;
	projectionMatrix: sd.Float4x4;
	viewMatrix: sd.Float4x4;

	constructor(rctx: render.RenderContext, private fixedPoints: CameraMarker[]) {
		this.w = rctx.gl.drawingBufferWidth;
		this.h = rctx.gl.drawingBufferHeight;

		this.projectionMatrix = mat4.create();
		mat4.perspective(this.projectionMatrix, math.deg2rad(65), this.w / this.h, 0.05, 100.0);
		this.viewMatrix = mat4.create();
	}

	pickClosestVantagePoint() {
		var playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);

		// order viewpoints by distance to player
		this.fixedPoints.sort(function(fpa, fpb) {
			var distA = vec2.squaredDistance(fpa, playerPos);
			var distB = vec2.squaredDistance(fpb, playerPos);
			return (distA < distB) ? -1 : ((distB < distA) ? 1 : 0);
		});

		var bestCam: CameraMarker = null;
		var minViewDistSq = 3.5 * 3.5;
		var temp = vec2.create(), f2p = vec2.create();

		for (var cx=0; cx < this.fixedPoints.length; ++cx) {
			// from this viewpoint, cast a ray to the player and find the first map wall we hit
			var camFP = this.fixedPoints[cx];
			vec2.subtract(temp, playerPos, camFP);
			vec2.copy(f2p, temp);
			var sq = state.grid.castRay(camFP, temp);

			// calc distances from cam to wall and player
			var camToSquareDistSq = vec2.squaredDistance(camFP, sq.center);
			var camToPlayerDistSq = vec2.length(f2p);
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
		var camY = bestCam.doorCam ? 6 : 5;
		var camPos = vec3.fromValues(bestCam[0], camY, bestCam[1]);
		vec3.scale(camPos, camPos, LEVEL_SCALE);

		var playerPos = vec3.clone(state.player.position);
		if (bestCam.doorCam) {
			vec3.set(playerPos, 28.5, 0, 27); // fixed view of the home base
		}
		else {
			playerPos[1] = 0.3; // player height oscillates but we don't want a wobbly camera
		}
		vec3.scale(playerPos, playerPos, LEVEL_SCALE);

 		mat4.lookAt(this.viewMatrix, camPos, playerPos, [0,1,0]);
	}
}


class Square {
	private normals = [
		vec2.fromValues(-1, 0), // left
		vec2.fromValues(1, 0), // right
		vec2.fromValues(0, -1), // top
		vec2.fromValues(0, 1), // bottom
		vec2.fromValues(Math.sqrt(2), Math.sqrt(2)) // inner (hack)
	];

	min: sd.Float2;
	max: sd.Float2;
	center: sd.Float2;	

	constructor(x: number, y: number) {
		this.min = vec2.fromValues(x, y);
		this.max = vec2.fromValues(x + 1, y + 1);
		this.center = vec2.fromValues(x + .5, y + .5);
	}

	closestPoint(pt2: sd.Float2) {
		var closest = vec2.create();
		vec2.max(closest, this.min, pt2);
		vec2.min(closest, this.max, closest);
		return closest;
	}
	
	containsPoint(pt2: sd.Float2) {
		return vec2.equals(this.closestPoint(pt2), pt2);
	}
	
	normalAtClosestPoint(pt2: sd.Float2) {
		var closest = this.closestPoint(pt2);
		
		if (vec2.equals(closest, pt2)) { // pt2 contained in box
			return vec2.clone(this.normals[4]); // HACK: push out diagonally down right
		}
		
		if (closest[0] == this.min[0]) {
			return vec2.clone(this.normals[0]);
		}
		else if (closest[0] == this.max[0]) {
			return vec2.clone(this.normals[1]);
		}
		else if (closest[1] == this.min[1]) {
			return vec2.clone(this.normals[2]);
		}

		return vec2.clone(this.normals[3]);
	}

	distanceToPoint(pt2: sd.Float2) {
		return vec2.distance(this.closestPoint(pt2), pt2);
	}
}


class Grid {
	private squares: Square[];

	constructor(public width: number, public height: number, public cells: boolean[], public pathCells: boolean[]) {
		this.squares = [];
		var sqix = 0;

		for (var z = 0; z < height; ++z) {
			for (var x = 0; x < width; ++x) {
				if (cells[sqix])
					this.squares[sqix] = new Square(x, z);
				else
					this.squares[sqix] = null;

				++sqix;
			}
		}
	}


	at(x: number, z: number) {
		return this.squares[(z>>0) * this.width + (x>>0)];
	}
	
	pathAt(x: number, z: number) {
		return this.pathCells[(z>>0) * this.width + (x>>0)];
	}
	
	pathExits(curPos: sd.Float2, curDir: string) {
		var x = curPos[0], z = curPos[1], exits: { pos: sd.Float2; dir: string }[] = [];
		sd.assert(this.pathAt(x, z), "you're not on a path!");

		if ((curDir != "south") && this.pathAt(x, z-1))
			exits.push({ pos: [x, z-1], dir: "north" });

		if ((curDir != "east") && this.pathAt(x - 1, z))
			exits.push({ pos: [x-1, z], dir: "west" });

		if ((curDir != "north") && this.pathAt(x, z + 1))
			exits.push({ pos: [x, z+1], dir: "south" });

		if ((curDir != "west") && this.pathAt(x + 1, z))
			exits.push({ pos: [x+1, z], dir: "east" });
		
		return exits;
	}

	set(x: number, z: number, occupied: boolean) {
		var sq = occupied ? new Square(x, z) : null;
		this.squares[(z>>0) * this.width + (x>>0)] = sq;
	}
	
	
	castRay(from: sd.Float2, direction: sd.Float2): Square {
		// adapted from sample code at: http://lodev.org/cgtutor/raycasting.html
		vec2.normalize(direction, direction);

		//calculate ray position and direction 
		var rayPosX = from[0];
		var rayPosY = from[1];
		var rayDirX = direction[0];
		var rayDirY = direction[1];
		//which box of the map we're in  
		var mapX = rayPosX << 0;
		var mapY = rayPosY << 0;

		//length of ray from current position to next x or y-side
		var sideDistX: number, sideDistY: number;

		//length of ray from one x or y-side to next x or y-side
		var deltaDistX = Math.sqrt(1 + (rayDirY * rayDirY) / (rayDirX * rayDirX));
		var deltaDistY = Math.sqrt(1 + (rayDirX * rayDirX) / (rayDirY * rayDirY));

		//what direction to step in x or y-direction (either +1 or -1)
		var stepX: number, stepY: number;

		var tests = 0; // limit search depth
		//calculate step and initial sideDist
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
			//jump to next map square, OR in x-direction, OR in y-direction
			if (sideDistX < sideDistY) {
				sideDistX += deltaDistX;
				mapX += stepX;
			}
			else {
				sideDistY += deltaDistY;
				mapY += stepY;
			}

			var sq = this.at(mapX, mapY);
			if (sq) return sq;
		} 

		return null;
	}


	collideAndResolveCircle(posFrom: Float32Array, posTo: Float32Array, radius: number): Float32Array {
		var direction = vec2.create();
		vec2.subtract(direction, posTo, posFrom);

		var toCheck = <Square[]>[];
		var minX = (posTo[0] - radius)<<0, maxX = (posTo[0] + radius)<<0;
		var minZ = (posTo[1] - radius)<<0, maxZ = (posTo[1] + radius)<<0;

		for (var tz = minZ; tz <= maxZ; ++tz) {
			for (var tx = minX; tx <= maxX; ++tx) {
				var sq = this.at(tx, tz);
				if (sq) toCheck.push(sq);
			}
		}

		if (! toCheck.length)
			return posTo;

		var closestSquare = <Square>null, closestDist = 99999;
		toCheck.forEach((sq) => {
			var dist = sq.distanceToPoint(posTo);
			if (dist < closestDist) {
				closestDist = dist;
				closestSquare = sq;
			}
		});

		if (closestSquare && closestDist < radius) {
			// not perfect but will work for now
			var planeNormal = closestSquare.normalAtClosestPoint(posTo);
			vec2.scale(planeNormal, planeNormal, radius - closestDist);
			vec2.add(posTo, posTo, planeNormal);
		}

		return posTo;
	}
}


class Key {
	private static keyPositions = [
		[4.5, .2, 8.5],
		[52.5, .2, 8.5],
		[4.5, .2, 48.5],
		[52.5, .2, 48.5]
	];

	private static lockPositions = [
		[29.3, 2.3, 26.8],
		[27.5, 2.3, 26.8],
		[29.3, 0.6, 26.8],
		[27.5, 0.6, 26.8]
	];

	keyModel: Model;
	lockModel: Model;
	found = false;
	keyPosition = vec3.create();
	lockPosition = vec3.create();
	radius = 0.5;

	private scaledPos = vec3.create();
	private rotAxis = vec3.fromValues(0, 1, 0);

	private lockRotAxis = [0, 0, 1];
	private lockRotMax = Math.PI / 40;

	
	constructor(public index: number) {
		this.keyModel = new Model({ mesh: state.meshes["key"], material: makeSimpleMaterial(null) });
		this.lockModel = new Model({ mesh: state.meshes["lock"], material: makeSimpleMaterial(null) });

		this.keyModel.setUniformScale(1);
		this.lockModel.setUniformScale(0.02);

		vec3.copy(this.keyPosition, Key.keyPositions[this.index]);
		vec3.scale(this.scaledPos, this.keyPosition, LEVEL_SCALE);
		this.keyModel.setPosition(this.scaledPos);

		vec3.copy(this.lockPosition, Key.lockPositions[this.index]);
		vec3.scale(this.scaledPos, this.lockPosition, LEVEL_SCALE);
		this.lockModel.setPosition(this.scaledPos);
	}

	update(_dt: number) {
		if (this.found)
			return;

		var playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
		var myPos = vec2.fromValues(this.keyPosition[0], this.keyPosition[2]);
		
		var maxRadius = Math.max(this.radius, state.player.radius);
		if (vec2.distance(playerPos, myPos) < maxRadius) {
			this.found = true;

			// disable models
			this.keyModel.setActiveIndex(-1);
			this.lockModel.setActiveIndex(-1);
		}

		if (!this.found) {
			this.keyModel.setRotation(this.rotAxis, state.tCur * 1.3);

			var lrt = this.lockRotMax * Math.sin(state.tCur * 2);
			this.lockModel.setRotation(this.lockRotAxis, lrt)
		}
	}
}


function makeDoorMesh(cornerColors: sd.Float3[]) {
	var md = new meshdata.MeshData();
	var vb = new meshdata.VertexBuffer(meshdata.AttrList.Pos3Norm3Colour3UV2());
	md.vertexBuffers.push(vb);
	md.primitiveGroups.push({
		type: meshdata.PrimitiveType.Triangle,
		fromElement: 0,
		elementCount: 4 * 3,
		materialIx: 0
	});
	vb.allocate(6 * 2);
	var vertexes = new meshdata.VertexBufferAttributeView(vb, vb.attrByRole(meshdata.VertexAttributeRole.Position));
	var normals = new meshdata.VertexBufferAttributeView(vb, vb.attrByRole(meshdata.VertexAttributeRole.Normal));
	var colors = new meshdata.VertexBufferAttributeView(vb, vb.attrByRole(meshdata.VertexAttributeRole.Colour));
	var uvs = new meshdata.VertexBufferAttributeView(vb, vb.attrByRole(meshdata.VertexAttributeRole.UV));

	var vi = 0, ni = 0;

	var xa = -1.5, xb = 1.5,
		h = 3,
		za = 0, zb = .5;

	function vtx(x: number, y: number, z: number) { vec3.set(vertexes.refItem(vi), x, y, z); }
	function col(c: sd.Float3) { vec3.copy(colors.refItem(vi), c); }
	function nrm6(nrm: sd.Float3) { for (var n = 0; n < 6; ++n) vec3.copy(normals.refItem(ni++), nrm); }

	vtx(xb, h, za); col(cornerColors[0]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;
	vtx(xb, 0, za); col(cornerColors[2]); vec2.set(uvs.refItem(vi), 0, 1); ++vi;
	vtx(xa, 0, za); col(cornerColors[3]); vec2.set(uvs.refItem(vi), 1, 1); ++vi;

	vtx(xa, 0, za); col(cornerColors[3]); vec2.set(uvs.refItem(vi), 1, 1); ++vi;
	vtx(xa, h, za); col(cornerColors[1]); vec2.set(uvs.refItem(vi), 1, 0); ++vi;
	vtx(xb, h, za); col(cornerColors[0]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;

	nrm6([0, 0, -1]);

	vtx(xb, h, zb); col(cornerColors[4]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;
	vtx(xb, h, za); col(cornerColors[4]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;
	vtx(xa, h, za); col(cornerColors[4]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;

	vtx(xa, h, za); col(cornerColors[4]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;
	vtx(xa, h, zb); col(cornerColors[4]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;
	vtx(xb, h, zb); col(cornerColors[4]); vec2.set(uvs.refItem(vi), 0, 0); ++vi;

	nrm6([0, 1, 0]);
	
	return state.scene.meshMgr.create(md);
}


class Door {
	state = "closed";
	position = vec3.fromValues(28.5, 0, 27);
	mesh: world.MeshInstance;
	model: Model;
	openT0 = 0;

	private scaledPos = vec3.create();

	constructor() {
		this.mesh = makeDoorMesh(state.cornerColors);
		this.model = new Model({ mesh: this.mesh, material: makeSimpleMaterial(state.textures["door"]) });
		this.model.setUniformScale(4);

		vec3.scale(this.scaledPos, this.position, LEVEL_SCALE);
		this.model.setPosition(this.scaledPos);

		// block the home base	
		state.grid.set(27, 27, true);
		state.grid.set(28, 27, true);
		state.grid.set(29, 27, true);
	}

	update(_dt: number) {
		if (this.state == "closed") {
			var allKeys = state.keyItems.every(function(key) { return key.found; });

			if (allKeys) {
				var playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
				var myPos = vec2.fromValues(this.position[0], this.position[2]);

				if (vec2.distance(playerPos, myPos) < 2) {
					this.state = "opening";
					this.openT0 = state.tCur;
				}
			}
		}
		else if (this.state == "opening") {
			var step = Math.max(0, Math.min(1, (state.tCur - this.openT0) / 4));
			this.position[0] = 28.5 + ((Math.random() - 0.5) * 0.03);
			this.position[1] = -3 * step;
			vec3.scale(this.scaledPos, this.position, LEVEL_SCALE);
			this.model.setPosition(this.scaledPos);
			
			if (step == 1) {
				// unblock
				state.grid.set(27, 27, false);
				state.grid.set(28, 27, false);
				state.grid.set(29, 27, false);
				this.state = "open";
			}
		}
	}
}


class End {
	position = [28.5, 29.5];
	radius = 1;
	fadeSec = 4;
	T = -1;

	constructor() {
	}

	update(_dt: number) {
		var playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
		if (vec2.distance(playerPos, this.position) < this.radius) {
			this.T = state.tCur;

			var totalSeconds = this.T << 0;
			var minutes = (totalSeconds / 60) << 0;
			var seconds = totalSeconds - (minutes * 60);

			dom.$1("#minutes").textContent = "" + minutes;
			dom.$1("#seconds").textContent = "" + seconds;
			
			dom.hide("canvas");
			dom.show("#victory");
			mode = "victory";
		}
	}
}


class Player {
	private scaledPos = vec3.create();
	private rotAxis = vec3.fromValues(0, 1, 0);

	private moveMat = mat2.create();
	private movePos = vec2.create();

	position = vec3.fromValues(0, 0.3, 0); // grid units
	viewAngle = Math.PI / -2; // radians
	turnSpeed = Math.PI; // radians / sec
	speed = 2.3; // grid units / sec
	radius = .25; // grid units
	dieT = -1;

	model: Model;
	
	constructor() {
		this.model = new Model({ mesh: state.meshes["spookje"], material: makeSimpleMaterial(null) });
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
			var meltStep = (state.tCur - this.dieT) / 4;
			var meltClamp = Math.max(0, Math.min(1, meltStep));
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
			var turnAngle = 0;
			if (io.keyboard.down(io.Key.LEFT) || io.keyboard.down(io.Key.A)) {
				turnAngle = -this.turnSpeed;
			}
			else if (io.keyboard.down(io.Key.RIGHT) || io.keyboard.down(io.Key.D)) {
				turnAngle = this.turnSpeed;
			}
			this.viewAngle += turnAngle * dt;

			// -- movement
			var speed = 0;
			if (io.keyboard.down(io.Key.UP) || io.keyboard.down(io.Key.W)) {
				speed = -this.speed;
			}
			else if (io.keyboard.down(io.Key.DOWN) || io.keyboard.down(io.Key.S)) {
				speed = this.speed;
			}

			if (speed != 0) {
				mat2.fromRotation(this.moveMat, this.viewAngle);
				mat2.scale(this.moveMat, this.moveMat, [speed * dt, speed * dt]);
				vec2.set(this.movePos, 1, 0);
				vec2.transformMat2(this.movePos, this.movePos, this.moveMat);

				var oldPos = vec2.fromValues(this.position[0], this.position[2]);
				var newPos = vec2.create();
				vec2.add(newPos, oldPos, this.movePos);

				newPos = state.grid.collideAndResolveCircle(oldPos, newPos, this.radius);
			
				// warp tunnel
				if (newPos[0] < 0)
					newPos[0] += state.grid.width;
				if (newPos[0] >= state.grid.width)
					newPos[0] -= state.grid.width;

				this.position[0] = newPos[0];
				this.position[2] = newPos[1];
			}
		}

		// -- they all float down here
		this.position[1] = 0.35 + 0.05 * Math.sin(state.tCur * 3);

		vec3.scale(this.scaledPos, this.position, LEVEL_SCALE);
		this.model.setPosition(this.scaledPos);
		this.model.setRotation(this.rotAxis, -this.viewAngle);
	}
}


class Abomination {
	private static spawnData = [
		{ direction: "north", pathPos: [43, 18] },
		{ direction: "west", pathPos: [13, 4] },
		{ direction: "south", pathPos: [4, 43] },
		{ direction: "north", pathPos: [49, 52] },
		{ direction: "west", pathPos: [28, 36] }
	];

	private static rotations: { [index: string]: number } = {
		north: Math.PI,
		west: Math.PI / -2,
		south: 0,
		east: Math.PI / 2
	};

	private static directionVecs: { [index: string]: sd.Float2 } = {
		north: [0, -1],
		west: [-1, 0],
		south: [0, 1],
		east: [1, 0]
	};

	model: Model;
	phase = "move";
	direction: string;
	nextDir = "";
	pathPos: sd.Float2;
	pathStep = 0;
	lastStepT = 0;
	stepDuration = 0.33;
	turnDuration = 0.6;
	radius = 1.4;

	private rotAxis = vec3.fromValues(0, 1, 0);
	private scaledPos = vec3.create();
	private moveOffset = vec3.create();

	constructor(index: number) {
		this.direction = Abomination.spawnData[index].direction;
		this.pathPos = vec2.clone(Abomination.spawnData[index].pathPos);

		var mat = makeSimpleMaterial(state.textures["crackpac"]);
		this.model = new Model({ mesh: state.meshes["pac1"], material: mat }, { mesh: state.meshes["pac2"], material: mat });
		this.model.setUniformScale(5);
	}
	

	update(_dt: number) {
		if (this.phase == "move") {
			if (state.tCur - this.lastStepT > this.stepDuration) {
				this.pathStep++;
				this.lastStepT = state.tCur;
				var dirVec2 = Abomination.directionVecs[this.direction];
				var dirVec3 = vec3.fromValues(dirVec2[0], 0, dirVec2[1]);

				vec3.scale(this.moveOffset, dirVec3, this.pathStep / 2);
				vec3.set(this.scaledPos, this.pathPos[0] + 0.5, 0, this.pathPos[1] + 0.5);
				vec3.add(this.scaledPos, this.scaledPos, this.moveOffset);

				vec3.scale(this.scaledPos, this.scaledPos, LEVEL_SCALE);
				this.model.setPosition(this.scaledPos);
				this.model.setRotation(this.rotAxis, Abomination.rotations[this.direction]);
				
				// moved 1 full tile
				if (this.pathStep == 2) {
					vec2.add(this.pathPos, this.pathPos, dirVec2);
					this.pathStep = 0;

					var exits = state.grid.pathExits(this.pathPos, this.direction);
					var exit = exits[math.intRandom(exits.length - 1)];
					
					if (exit.dir != this.direction) {
						this.nextDir = exit.dir;
						this.phase = "turn";
					}
				}
			}
		} // move
		else if (this.phase == "turn") {
			var step = Math.max(0, Math.min(1, (state.tCur - this.lastStepT) / this.turnDuration));
			step = step * step;
		
			var fromAngle = Abomination.rotations[this.direction];
			var toAngle = Abomination.rotations[this.nextDir];
			var rotation = toAngle - fromAngle;
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
				this.nextDir = "";
				this.lastStepT = state.tCur;
			}
		}
		
		// -- check collisions against player
		var playerPos = vec2.fromValues(state.player.position[0], state.player.position[2]);
		
		var maxRadius = Math.max(this.radius, state.player.radius);
		if (vec2.distance(playerPos, this.pathPos) < maxRadius) {
			state.player.die();
		}

		this.model.setActiveIndex(1 - (this.pathStep & 1));
	}
}


function drawScene(camera: Camera) {
	var rpd = render.makeRenderPassDescriptor();
	vec4.set(rpd.clearColour, 0.1, 0.0, 0.05, 1);
	rpd.clearMask = render.ClearMask.ColourDepth;

	render.runRenderPass(state.rctx, state.scene.meshMgr, rpd, null, (renderPass) => {
		renderPass.setDepthTest(render.DepthTest.Less);
		renderPass.setFaceCulling(render.FaceCulling.Back);

		state.scene.stdModelMgr.updateLightData(camera);
		state.scene.stdModelMgr.draw(state.scene.stdModelMgr.all(), renderPass, camera, null, { colour: [0.1, 0.0, 0.05], offset: 8, depth: 32, density: 0.95 }, world.RenderMode.Forward);
	});
}


function nextFrame() {
	state.tCur = (Date.now() / 1000.0) - state.t0;
	var dt = state.tCur - state.tLast;
	var camera = state.camera;

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

	if (active && (state.end.T < 0))
		requestAnimationFrame(nextFrame);
}


function run() {
	dom.show("canvas");
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
	dom.hide("canvas");
	dom.hide("#victory");
	dom.show("#run");
}


function init() {
	// -- create managers
	var canvas = <HTMLCanvasElement>document.getElementById("stage");
	var rctx = render.makeRenderContext(canvas);

	state.rctx = rctx;
	state.scene = new world.Scene(rctx);

	var dirLite = state.scene.makeEntity({
		light: {
			type: world.LightType.Directional,
			ambientIntensity: 1,
			diffuseIntensity: 0,
			colour: [1, 1, 1],
		}
	});
	state.scene.lightMgr.setDirection(dirLite.light, [0, -1, 0]);
	state.scene.stdModelMgr.setActiveLights([dirLite.light], -1);

	dom.on("#run", "click", function() {
		dom.hide("#run");
		dom.hide("#victory");
		run();
	});

	dom.on("#victory", "click", function() {
		location.reload();
	});

	genMapMesh().then(mapData => {
		state.meshes["map"] = state.scene.meshMgr.create(mapData.meshData);
		state.models["map"] = new Model({ mesh: state.meshes["map"], material: makeSimpleMaterial(null) });

		state.camera = new Camera(rctx, mapData.cameras);
		state.grid = new Grid(mapData.gridW, mapData.gridH, mapData.grid, mapData.path);
		state.cornerColors = mapData.cornerColors;

		var resources = [
			asset.loadOBJFile("data/models/pac1.obj", true).then(pac1Obj => {
				state.meshes["pac1"] = state.scene.meshMgr.create(pac1Obj.meshes[0].meshData);
			}),
			asset.loadOBJFile("data/models/pac2.obj", true).then(pac2Obj => {
				state.meshes["pac2"] = state.scene.meshMgr.create(pac2Obj.meshes[0].meshData);
			}),
			asset.loadOBJFile("data/models/key.obj", true).then(keyObj => {
				state.meshes["key"] = state.scene.meshMgr.create(keyObj.meshes[0].meshData);
			}),
			asset.loadOBJFile("data/models/lock.obj", true).then(lockObj => {
				state.meshes["lock"] = state.scene.meshMgr.create(lockObj.meshes[0].meshData);
			}),
			asset.loadOBJFile("data/models/spookje.obj", true).then(spookjeObj => {
				state.meshes["spookje"] = state.scene.meshMgr.create(spookjeObj.meshes[0].meshData);
			}),
			render.loadSimpleTexture(rctx, "data/tex2D/doortex.png", false).then(doorTex => {
				state.textures["door"] = doorTex;
			}),
			render.loadSimpleTexture(rctx, "data/tex2D/crackpac.png", false).then(crackTex => {
				state.textures["crackpac"] = crackTex;
			})
		];

		Promise.all(resources).then(() => {
			showTitle();
		});
	});
}

dom.on(window, "load", init);
