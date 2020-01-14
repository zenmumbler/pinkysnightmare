import { assert } from "./util.js";

export function u8Color(r, g, b) {
	return [r / 255, g / 255, b / 255];
}

export function TriMesh(gl, vertexArray, normalArray, colorArray, uvArray) {
	assert(vertexArray && vertexArray.length && (vertexArray.length % 9 == 0), "vertex array must be a triangle soup"); // 3 vtx * 3 floats
	assert(normalArray && (normalArray.length == vertexArray.length), "normal array must be same size as vertex array");
	assert(colorArray && (colorArray.length == vertexArray.length), "color array must be same size as vertex array");
	if (uvArray)
		assert((uvArray.length / 2) == (vertexArray.length / 3), "each vertex needs a uv");

	this.vertexBuffer = gl.createBuffer();
	this.normalBuffer = gl.createBuffer();
	this.colorBuffer = gl.createBuffer();
	this.uvBuffer = uvArray ? gl.createBuffer() : null;

	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);

	if (this.uvBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvArray), gl.STATIC_DRAW);
	}

	this.elements = vertexArray.length / 3;

	this.draw = function (program, texture) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.enableVertexAttribArray(program.vertexPositionAttribute);
		gl.vertexAttribPointer(program.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.enableVertexAttribArray(program.vertexColorAttribute);
		gl.vertexAttribPointer(program.vertexColorAttribute, 3, gl.FLOAT, false, 0, 0);

		if (program.vertexNormalAttribute > -1) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
			gl.enableVertexAttribArray(program.vertexNormalAttribute);
			gl.vertexAttribPointer(program.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);
		}

		if (program.vertexUVAttribute > -1) {
			if (this.uvBuffer) {
				gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
				gl.enableVertexAttribArray(program.vertexUVAttribute);
				gl.vertexAttribPointer(program.vertexUVAttribute, 2, gl.FLOAT, false, 0, 0);
			}
			else {
				gl.disableVertexAttribArray(program.vertexUVAttribute);
			}
		}

		if (texture && program.textureUniform) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.uniform1i(program.textureUniform, 0);
		}

		gl.drawArrays(gl.TRIANGLES, 0, this.elements);

		if (texture && program.textureUniform) {
			gl.bindTexture(gl.TEXTURE_2D, null);
		}
	};
}
