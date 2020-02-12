// Part of Pinky's Nightmare
// (c) 2015-6 by Arthur Langereis - @zenmumbler

import { vec2, vec3, vec4, Vector3 } from "stardazed/vector";
import { u8Color, quickGeometry, loadImageData } from "./asset.js";
import { RenderMesh, Renderer } from "./render";

export type CameraPoint = NumArray & { doorCam: boolean };

export interface MapData {
	cameras: CameraPoint[];
	grid: boolean[];
	path: boolean[];
	gridW: number;
	gridH: number;
	mesh: RenderMesh;
	cornerColors: number[][];
}

function buildMapFromImageData(renderer: Renderer, pix: ImageData): MapData {
	const data = pix.data, pixw = pix.width, pixh = pix.height;
	let inuse = 0, offset = 0, gridOffset = 0;

	const HEIGHT = 5.0;       // will appear inf high

	const vertexes: number[] = [], normals: number[] = [], colours: number[] = [], cameras: CameraPoint[] = [], grid = [], path = [];

	function vtx(x: number, y: number, z: number) { vertexes.push(x, y, z); }
	function nrm6(nrm: NumArray) { for (let n = 0; n < 6; ++n) { normals.push(nrm[0], nrm[1], nrm[2]); } }
	function col6(colT: NumArray, colB: NumArray) {
		colours.push(colT[0], colT[1], colT[2]);
		colours.push(colB[0], colB[1], colB[2]);
		colours.push(colB[0], colB[1], colB[2]);

		colours.push(colB[0], colB[1], colB[2]);
		colours.push(colT[0], colT[1], colT[2]);
		colours.push(colT[0], colT[1], colT[2]);
	}

	const north = [0, 0, -1],        // normals of the sides
		west  = [-1, 0, 0],
		south = [0, 0, 1],
		east  = [1, 0, 0];
	const corners = [
		[0, 0],
		[pixw, 0],
		[0, pixh],
		[pixw, pixh]
	];

	const cornerColors = [
		u8Color(32, 43, 222),
		u8Color(255, 184, 71),
		u8Color(255, 37, 0),
		u8Color(0, 252, 222),

		u8Color(0xff, 0xd7, 0x00)  // homebase
	];

	const topDarkenFactor = 0.65,
		botDarkenFactor = 0.30;    // bottom vertices are darker than top ones

	// home base in the grid
	const homeBaseMin = [21, 26],
		homeBaseMax = [35, 34];
	const doorCameraLoc = [28, 23];

	for (let z = 0; z < pixh; ++z) {
		for (let x = 0; x < pixw; ++x) {
			grid[gridOffset] = false;
			path[gridOffset] = false;

			if ((data[offset + 0] !== 0 && data[offset + 0] !== 255) ||
				(data[offset + 1] !== 0 && data[offset + 1] !== 255) ||
				(data[offset + 2] !== 0 && data[offset + 2] !== 255)) {
				console.info(x, z, data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
			}

			if (data[offset] === 0) {
				const xa = x,
					xb = (x + 1),
					za = z,
					zb = (z + 1),
					h = HEIGHT;

				if (data[offset + 2] === 255) {
					path[gridOffset] = true;
				}

				if (data[offset + 1] === 255) {
					if (vec2.equals([x, z], doorCameraLoc)) {
						const dc: any = vec2.fromValues(x + .5, z + .1);
						dc.doorCam = true;
						cameras.push(dc);
					}
					else {
						const dc: any = vec2.fromValues(x + .5, z + .5);
						dc.doorCam = false;
						cameras.push(dc);
					}
				}

				if ((data[offset + 1] === 0) && (data[offset + 2] === 0)) {
					++inuse;
					grid[gridOffset] = true;

					// determine color to use
					let topColor: Vector3;
					let botColor: Vector3;

					if (x >= homeBaseMin[0] && x <= homeBaseMax[0] && z >= homeBaseMin[1] && z <= homeBaseMax[1]) {
						topColor = Vector3.fromArray(cornerColors[4]);
						botColor = topColor.mul(0.6);
					}
					else {
						// calculate interpolated color by distance from the 4 corners of the field
						const cornerDist = vec4.create();
						cornerDist[0] = vec2.squaredDistance(corners[0], [x, z]);
						cornerDist[1] = vec2.squaredDistance(corners[1], [x, z]);
						cornerDist[2] = vec2.squaredDistance(corners[2], [x, z]);
						cornerDist[3] = vec2.squaredDistance(corners[3], [x, z]);

						vec4.normalize(cornerDist, cornerDist);

						cornerDist[0] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[0])), 2);
						cornerDist[1] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[1])), 2);
						cornerDist[2] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[2])), 2);
						cornerDist[3] = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist[3])), 2);

						topColor = Vector3.fromArray(cornerColors[0]).mul(cornerDist[0])
							.mulAdd(Vector3.fromArray(cornerColors[1]), cornerDist[1])
							.mulAdd(Vector3.fromArray(cornerColors[2]), cornerDist[2])
							.mulAdd(Vector3.fromArray(cornerColors[3]), cornerDist[3]);
						// vec3.scaleAndAdd(topColor, topColor, cornerColors[0], cornerDist[0]); // may exceed 1 for factors, but will be clamped by gpu
						// vec3.scaleAndAdd(topColor, topColor, cornerColors[1], cornerDist[1]);
						// vec3.scaleAndAdd(topColor, topColor, cornerColors[2], cornerDist[2]);
						// vec3.scaleAndAdd(topColor, topColor, cornerColors[3], cornerDist[3]);

						botColor = topColor.mul(botDarkenFactor);
						topColor = topColor.mul(topDarkenFactor);
						// vec3.scale(botColor, topColor, botDarkenFactor);
						// vec3.scale(topColor, topColor, topDarkenFactor);
					}

					// ccw
					// wall top
					vtx(xb, h, za);
					vtx(xb, 0, za);
					vtx(xa, 0, za);

					vtx(xa, 0, za);
					vtx(xa, h, za);
					vtx(xb, h, za);

					nrm6(north);
					col6(topColor.asArray(), botColor.asArray());

					// wall left
					vtx(xa, h, za);
					vtx(xa, 0, za);
					vtx(xa, 0, zb);

					vtx(xa, 0, zb);
					vtx(xa, h, zb);
					vtx(xa, h, za);

					nrm6(west);
					col6(topColor.asArray(), botColor.asArray());

					// wall bottom
					vtx(xa, h, zb);
					vtx(xa, 0, zb);
					vtx(xb, 0, zb);

					vtx(xb, 0, zb);
					vtx(xb, h, zb);
					vtx(xa, h, zb);

					nrm6(south);
					col6(topColor.asArray(), botColor.asArray());

					// wall right
					vtx(xb, h, zb);
					vtx(xb, 0, zb);
					vtx(xb, 0, za);

					vtx(xb, 0, za);
					vtx(xb, h, za);
					vtx(xb, h, zb);

					nrm6(east);
					col6(topColor.asArray(), botColor.asArray());
				}
			}

			offset += 4;
			gridOffset++;
		}
	}

	console.info("map inuse", inuse);
	console.info("vtx", vertexes.length, "cams", cameras.length);

	const geom = quickGeometry(vertexes, normals, colours);

	return {
		cameras,
		grid,
		path,
		gridW: pixw,
		gridH: pixh,
		mesh: renderer.createMesh(geom),
		cornerColors
	};
}


export async function genMapMesh(renderer: Renderer) {
	const pix = await loadImageData("assets/levelx_.png");
	const t0 = performance.now();
	const map = buildMapFromImageData(renderer, pix);
	const t1 = performance.now();
	console.info("mapGen took", (t1 - t0), "ms");
	return map;
}
