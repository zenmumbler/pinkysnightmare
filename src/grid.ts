import { vec2 } from "stardazed/vector";
import { assert } from "./util";

export class Square {
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

export type Direction = "north" | "south" | "east" | "west";

export class Grid {
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
