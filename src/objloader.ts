// Part of Pinky's Nightmare
// (c) 2015 by Arthur Langereis - @zenmumbler

import { assert } from "./util.js";

export interface ObjData {
	elements: number;
	vertexes: number[];
	normals: number[];
	uvs: number[];
}

function loadObj(text: string, then: (d: ObjData) => void) {
	const t0 = performance.now();
	const lines = text.split("\n");
	const vv: number[][] = [], nn: number[][] = [], tt: number[][] = [];
	const vertexes: number[] = [], normals: number[] = [], uvs: number[] = [];

	function vtx(vx: number, tx: number, nx: number) {
		assert(vx < vv.length, "vx out of bounds " + vx);
		assert(tx < tt.length, "tx out of bounds " + tx);
		assert(nx < nn.length, "nx out of bounds " + nx);

		const v = vv[vx],
			t = tx > -1 ? tt[tx] : null,
			n = nn[nx];

		vertexes.push(v[0], v[1], v[2]);
		normals.push(n[0], n[1], n[2]);
		if (t)
			uvs.push(t[0], t[1]);
	}

	// convert a face index to zero-based int or -1 for empty index
	function fxtoi(fx: string) {return (+fx) - 1;}

	lines.forEach(function(line) {
		var tokens = line.split(" ");
		switch (tokens[0]) {
			case "v":
				vv.push([parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])]);
				break;
			case "vn":
				nn.push([parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])]);
				break;
			case "vt":
				tt.push([parseFloat(tokens[1]), parseFloat(tokens[2])]);
				break;
			case "f":
				vtx.apply(null, tokens[1].split("/").map(fxtoi) as any);
				vtx.apply(null, tokens[2].split("/").map(fxtoi) as any);
				vtx.apply(null, tokens[3].split("/").map(fxtoi) as any);
				break;

			default: break;
		}
	});

	var t1 = performance.now();
	console.info("obj v:", vertexes.length / 3, "n:", normals.length / 3, "t:", uvs.length / 2, "took:", (t1-t0) | 0, "ms");
	then({ elements: vertexes.length / 3, vertexes, normals, uvs });
}


export function loadObjFile(fileName: string, then: (d: ObjData) => void) {
	const xhr = new XMLHttpRequest();
	xhr.open("GET", fileName);

	xhr.onreadystatechange = function() {
		if (xhr.readyState != 4) return;
		assert(xhr.status == 200 || xhr.status === 0);
		loadObj(xhr.responseText, then);
	};
	xhr.send();
}