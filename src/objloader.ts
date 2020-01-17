// Part of Pinky's Nightmare
// (c) 2015 by Arthur Langereis - @zenmumbler

import { Float } from "stardazed/core";
import { VertexAttributeStream, VertexAttributeRole, VertexAttributeMapping, GeometryBuilder } from "stardazed/geometry";

interface OBJPreProcSource {
	lines: string[];
	mtlFilePath?: string;

	positionCount: number;
	normalCount: number;
	uvCount: number;

	vertexCount: number;
}


function preflightOBJSource(text: string) {
	const preproc: OBJPreProcSource = {
		lines: [],
		positionCount: 0,
		normalCount: 0,
		uvCount: 0,
		vertexCount: 0
	};

	// split text into lines and remove trailing/leading whitespace and empty lines
	preproc.lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

	// scan for the mtllib declaration (if any) and do a counting preflight
	for (const line of preproc.lines) {
		const tokens = line.split(/ +/);
		const directive = tokens[0];
		if (directive === "v") { preproc.positionCount += 1; }
		else if (directive === "vn") { preproc.normalCount += 1; }
		else if (directive === "vt") { preproc.uvCount += 1; }
		else if (directive === "f") { preproc.vertexCount += tokens.length - 1; }
		else if (directive === "mtllib") {
			if (tokens[1]) {
				preproc.mtlFilePath = tokens[1];
			}
			else {
				console.warn("OBJ parser: ignoring empty mtllib reference.");
			}
		}
	}

	return preproc;
}


function loadObj(preproc: OBJPreProcSource, fixedColour: number[]) {
	const positions: Float32Array = new Float32Array(preproc.positionCount * 3);
	const positionIndexes = new Uint32Array(preproc.vertexCount);
	const streams: VertexAttributeStream[] = [];
	let normalValues: Float32Array | undefined;
	let uvValues: Float32Array | undefined;
	let normalIndexes: Uint32Array | undefined;
	let uvIndexes: Uint32Array | undefined;
	let posIx = 0, normIx = 0, uvIx = 0, vertexIx = 0; //, curMatIx = 0;

	if (preproc.normalCount > 0) {
		normalValues = new Float32Array(preproc.normalCount * 3);
		normalIndexes = new Uint32Array(preproc.vertexCount);

		streams.push({
			name: "normals",
			includeInMesh: true,
			mapping: VertexAttributeMapping.Vertex,
			attr: { type: Float, width: 3, role: VertexAttributeRole.Normal },
			values: normalValues,
			indexes: normalIndexes
		});
	}
	if (preproc.uvCount > 0) {
		uvValues = new Float32Array(preproc.uvCount * 2);
		uvIndexes = new Uint32Array(preproc.vertexCount);

		streams.push({
			name: "uvs",
			includeInMesh: true,
			mapping: VertexAttributeMapping.Vertex,
			attr: { type: Float, width: 2, role: VertexAttributeRole.UV },
			values: uvValues,
			indexes: uvIndexes
		});
	}
	streams.push({
		name: "colour",
		includeInMesh: true,
		mapping: VertexAttributeMapping.SingleValue,
		attr: { type: Float, width: 3, role: VertexAttributeRole.Colour },
		values: new Float32Array(fixedColour)
	});

	const builder = new GeometryBuilder({ positions, positionIndexes, streams });

	// map each material's name to its index
	// let nextNamedMatIx = 0;

	// convert a face index to zero-based int or -1 for empty index
	function fxtoi(fx: string) { return (+fx) - 1; }

	for (const line of preproc.lines) {
		const tokens = line.split(/ +/);
		switch (tokens[0]) {
			case "v":
				positions[posIx] = parseFloat(tokens[1]);
				positions[posIx + 1] = parseFloat(tokens[2]);
				positions[posIx + 2] = parseFloat(tokens[3]);
				posIx += 3;
				break;
			case "vn":
				normalValues![normIx] = parseFloat(tokens[1]);
				normalValues![normIx + 1] = parseFloat(tokens[2]);
				normalValues![normIx + 2] = parseFloat(tokens[3]);
				normIx += 3;
				break;
			case "vt":
				uvValues![uvIx] = parseFloat(tokens[1]);
				uvValues![uvIx + 1] = -parseFloat(tokens[2]);
				uvIx += 2;
				break;
			case "f": {
				const vi: number[] = [];
				for (let fvix = 1; fvix < tokens.length; ++fvix) {
					const fix = tokens[fvix].split("/").map(fxtoi);
					positionIndexes[vertexIx] = fix[0];
					if (uvIndexes && fix[1] > -1) {
						uvIndexes[vertexIx] = fix[1];
					}
					if (normalIndexes && fix[2] > -1) {
						normalIndexes[vertexIx] = fix[2];
					}
					vi.push(vertexIx);
					vertexIx += 1;
				}

				builder.addPolygon(vi, vi);
				break;
			}
			case "usemtl": {
				// const newMatIx = modelMeta.materialIndexMap[tokens[1]];
				// if (newMatIx === undefined) {
				// 	modelMeta.materialIndexMap[tokens[1]] = nextNamedMatIx;
				// 	curMatIx = nextNamedMatIx;
				// 	nextNamedMatIx += 1;
				// }
				// else {
				// 	curMatIx = newMatIx;
				// }
				// builder.setGroup(curMatIx);
				break;
			}

			default: break;
		}
	}

	return builder.complete();
}

export async function loadObjFile(fileName: string, fixedColour: number[]) {
	const resp = await fetch(fileName);
	const text = await resp.text();
	const preproc = preflightOBJSource(text);
	return loadObj(preproc, fixedColour);
}
