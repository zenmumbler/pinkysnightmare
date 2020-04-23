import { Vector3 } from "stardazed/vector";
import { VertexAttributeRole, allocateGeometry, VertexAttribute } from "stardazed/geometry";
import { RenderMesh, RenderTexture, RenderProgram } from "./render";
import { MapData } from "./levelgen";

export interface Assets {
	meshes: Record<string, RenderMesh>;
	textures: Record<string, RenderTexture>;
	modelProgram: RenderProgram;
	texturedProgram: RenderProgram;
	mapData: MapData;
}

export function u8Color(r: number, g: number, b: number) {
	return new Vector3(r / 255, g / 255, b / 255);
}

export function quickGeometry(positions: NumArray, normals: NumArray, colours: NumArray, uvs?: NumArray) {
	const vertexCount = (positions.length / 3) | 0;
	const geom = allocateGeometry({
		vertexDescs: [
			{
				attrs: ([
					{ type: "float", width: 3, role: VertexAttributeRole.Position },
					{ type: "float", width: 3, role: VertexAttributeRole.Normal },
					{ type: "float", width: 3, role: VertexAttributeRole.Colour }
				] as VertexAttribute[]).concat(
					uvs ? [
						{ type: "float", width: 2, role: VertexAttributeRole.UV }
					] : []
				),
				valueCount: vertexCount
			}
		],
		indexCount: 0
	});
	const vb = geom.vertexBuffers[0];
	vb.fieldView(0).copyValuesFrom(positions, vertexCount);
	vb.fieldView(1).copyValuesFrom(normals, vertexCount);
	vb.fieldView(2).copyValuesFrom(colours, vertexCount);
	if (uvs) { vb.fieldView(3).copyValuesFrom(uvs, vertexCount); }
	return geom;
}

export function makeDoorGeometry(cornerColors: Vector3[]) {
	const vertexes: number[] = [], normals: number[] = [], colors: number[] = [], uvs = [];

	const xa = -1.5, xb = 1.5,
		h = 3,
		za = 0, zb = .5;

	function vtx(x: number, y: number, z: number) { vertexes.push(x, y, z); }
	function col(c: number) { colors.push(cornerColors[c].x, cornerColors[c].y, cornerColors[c].z); }
	function nrm6(nrm: number[]) { for (let n = 0; n < 6; ++n) { normals.push(nrm[0], nrm[1], nrm[2]); } }

	vtx(xb, h, za); col(0); uvs.push(0, 0);
	vtx(xb, 0, za); col(2); uvs.push(0, 1);
	vtx(xa, 0, za); col(3); uvs.push(1, 1);

	vtx(xa, 0, za); col(3); uvs.push(1, 1);
	vtx(xa, h, za); col(1); uvs.push(1, 0);
	vtx(xb, h, za); col(0); uvs.push(0, 0);

	nrm6([0, 0, -1]);

	vtx(xb, h, zb); col(4); uvs.push(0, 0);
	vtx(xb, h, za); col(4); uvs.push(0, 0);
	vtx(xa, h, za); col(4); uvs.push(0, 0);

	vtx(xa, h, za); col(4); uvs.push(0, 0);
	vtx(xa, h, zb); col(4); uvs.push(0, 0);
	vtx(xb, h, zb); col(4); uvs.push(0, 0);

	nrm6([0, 1, 0]);

	return quickGeometry(vertexes, normals, colors, uvs);
}

export function loadImage(fileName: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = function() {
			resolve(image);
		};
		image.onerror = function() {
			reject(`Could not load image at ${fileName}`);
		};
		image.src = fileName;
	});
}

export async function loadImageData(fileName: string) {
	const image = await loadImage(fileName);
	const canvas = document.createElement("canvas");
	canvas.width = image.width;
	canvas.height = image.height;
	const ctx = canvas.getContext("2d")!;
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(image, 0, 0);
	return ctx.getImageData(0, 0, image.width, image.height);
}
