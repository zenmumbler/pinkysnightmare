// Part of Pinky's Nightmare
// (c) 2015-6 by Arthur Langereis - @zenmumbler

import { Vector2, Vector3, Vector4 } from "stardazed/vector";
import { u8Color, quickGeometry, loadImageData } from "./asset.js";
import { RenderMesh, Renderer } from "./render";

export interface CameraPoint {
	pos: Vector2;
	doorCam: boolean;
};

export interface MapData {
	cameras: CameraPoint[];
	grid: boolean[];
	path: boolean[];
	gridW: number;
	gridH: number;
	mesh: RenderMesh;
	cornerColors: Vector3[];
}

function buildMapFromImageData(renderer: Renderer, pix: ImageData): MapData {
	const data = pix.data, pixw = pix.width, pixh = pix.height;
	let inuse = 0, offset = 0, gridOffset = 0;

	const HEIGHT = 6.0;       // will appear inf high

	const vertexes: number[] = [], normals: number[] = [], colours: number[] = [], cameras: CameraPoint[] = [], grid = [], path = [];

	function vtx(x: number, y: number, z: number) { vertexes.push(x, y, z); }
	function nrm6(nrm: Vector3) { for (let n = 0; n < 6; ++n) { normals.push(nrm.x, nrm.y, nrm.z); } }
	function col6(colT: Vector3, colB: Vector3) {
		colours.push(colT.x, colT.y, colT.z);
		colours.push(colB.x, colB.y, colB.z);
		colours.push(colB.x, colB.y, colB.z);

		colours.push(colB.x, colB.y, colB.z);
		colours.push(colT.x, colT.y, colT.z);
		colours.push(colT.x, colT.y, colT.z);
	}

	const north = new Vector3(0, 0, -1),        // normals of the sides
		west = new Vector3(-1, 0, 0),
		south = new Vector3(0, 0, 1),
		east = new Vector3(1, 0, 0);
	const corners = [
		new Vector2(0, 0),
		new Vector2(pixw, 0),
		new Vector2(0, pixh),
		new Vector2(pixw, pixh)
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
	const homeBaseMin = new Vector2(21, 26),
		homeBaseMax = new Vector2(35, 34);
	const doorCameraLoc = new Vector2(28, 23);

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

				const posXZ = new Vector2(x, z);

				if (data[offset + 2] === 255) {
					path[gridOffset] = true;
				}

				if (data[offset + 1] === 255) {
					if (posXZ.equals(doorCameraLoc)) {
						cameras.push({
							pos: new Vector2(x + .5, z + .1),
							doorCam: true
						});
					}
					else {
						cameras.push({
							pos: new Vector2(x + .5, z + .5),
							doorCam: false
						});
					}
				}

				if ((data[offset + 1] === 0) && (data[offset + 2] === 0)) {
					++inuse;
					grid[gridOffset] = true;

					// determine color to use
					let topColor: Vector3;
					let botColor: Vector3;

					if (x >= homeBaseMin[0] && x <= homeBaseMax[0] && z >= homeBaseMin[1] && z <= homeBaseMax[1]) {
						topColor = cornerColors[4].clone();
						botColor = topColor.mul(0.6);
					}
					else {
						// calculate interpolated color by distance from the 4 corners of the field
						const cornerDist = new Vector4(
							corners[0].sqrDistance(posXZ),
							corners[1].sqrDistance(posXZ),
							corners[2].sqrDistance(posXZ),
							corners[3].sqrDistance(posXZ)
						);

						cornerDist.setNormalized();

						cornerDist.x = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist.x)), 2);
						cornerDist.y = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist.y)), 2);
						cornerDist.z = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist.z)), 2);
						cornerDist.w = Math.pow(.5 + (.5 * Math.cos(Math.PI * cornerDist.w)), 2);

						topColor = cornerColors[0].mul(cornerDist.x)
							.mulAdd(cornerColors[1], cornerDist.y)
							.mulAdd(cornerColors[2], cornerDist.z)
							.mulAdd(cornerColors[3], cornerDist.w);

						botColor = topColor.mul(botDarkenFactor);
						topColor = topColor.mul(topDarkenFactor);
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
					col6(topColor, botColor);

					// wall left
					vtx(xa, h, za);
					vtx(xa, 0, za);
					vtx(xa, 0, zb);

					vtx(xa, 0, zb);
					vtx(xa, h, zb);
					vtx(xa, h, za);

					nrm6(west);
					col6(topColor, botColor);

					// wall bottom
					vtx(xa, h, zb);
					vtx(xa, 0, zb);
					vtx(xb, 0, zb);

					vtx(xb, 0, zb);
					vtx(xb, h, zb);
					vtx(xa, h, zb);

					nrm6(south);
					col6(topColor, botColor);

					// wall right
					vtx(xb, h, zb);
					vtx(xb, 0, zb);
					vtx(xb, 0, za);

					vtx(xb, 0, za);
					vtx(xb, h, za);
					vtx(xb, h, zb);

					nrm6(east);
					col6(topColor, botColor);
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
