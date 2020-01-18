import { VertexAttributeRole, allocateGeometry } from "stardazed/geometry";
import { Float } from "stardazed/core";

export function u8Color(r: number, g: number, b: number) {
	return [r / 255, g / 255, b / 255];
}

export function quickGeometry(positions: NumArray, normals: NumArray, colours: NumArray, uvs?: NumArray) {
	const vertexCount = (positions.length / 3) | 0;
	const geom = allocateGeometry({
		vertexDescs: [
			{
				attrs: [
					{ type: Float, width: 3, role: VertexAttributeRole.Position },
					{ type: Float, width: 3, role: VertexAttributeRole.Normal },
					{ type: Float, width: 3, role: VertexAttributeRole.Colour }
				].concat(
					uvs ? [
						{ type: Float, width: 2, role: VertexAttributeRole.UV }
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
