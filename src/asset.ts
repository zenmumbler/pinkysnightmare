import { assert } from "./util";

export function u8Color(r: number, g: number, b: number) {
	return [r / 255, g / 255, b / 255];
}

export function createStandardTexture(gl: WebGLRenderingContext, fileName: string, then: (t: WebGLTexture) => void) {
	const texture = gl.createTexture()!;
	const image = new Image();
	image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		// gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);

		then(texture);
	};

	image.src = fileName;
}

function getShader(gl: WebGLRenderingContext, id: string) {
	const shaderScript = document.getElementById(id) as HTMLScriptElement;
	assert(shaderScript, "no such shader: " + id);

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER)!;
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER)!;
	} else {
		assert(false, id + " does not seem to be a shader");
	}

	gl.shaderSource(shader, shaderScript.textContent || "");
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		assert(false, "bad shader");
	}

	return shader;
}

export type StandardProgram = WebGLProgram & {
	vertexPositionAttribute: number;
	vertexColorAttribute: number;
	vertexNormalAttribute: number;
	vertexUVAttribute: number;

	projMatrixUniform: WebGLUniformLocation | null;
	mvMatrixUniform: WebGLUniformLocation | null;
	normalMatrixUniform: WebGLUniformLocation | null;
	textureUniform: WebGLUniformLocation | null;
	timeUniform: WebGLUniformLocation | null;
};

export function createStandardProgram(gl: WebGLRenderingContext, vertID: string, fragID: string) {
	const program = gl.createProgram()! as StandardProgram;
	gl.attachShader(program, getShader(gl, vertID));
	gl.attachShader(program, getShader(gl, fragID));
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}

	gl.useProgram(program);

	program.vertexPositionAttribute = gl.getAttribLocation(program, "vertexPos_model");
	program.vertexColorAttribute = gl.getAttribLocation(program, "vertexColor");
	program.vertexNormalAttribute = gl.getAttribLocation(program, "vertexNormal");
	program.vertexUVAttribute = gl.getAttribLocation(program, "vertexUV");

	program.projMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
	program.mvMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
	program.normalMatrixUniform = gl.getUniformLocation(program, "normalMatrix");
	program.textureUniform = gl.getUniformLocation(program, "diffuseSampler");
	program.timeUniform = gl.getUniformLocation(program, "currentTime");

	gl.useProgram(null);

	return program;
}


export class TriMesh {
	vertexBuffer: WebGLBuffer;
	normalBuffer: WebGLBuffer;
	colorBuffer: WebGLBuffer;
	uvBuffer: WebGLBuffer | null;
	elements: number;

	constructor(gl: WebGLRenderingContext, vertexArray: number[], normalArray: number[], colorArray: number[], uvArray ?: number[]) {
		assert(vertexArray.length % 9 === 0, "vertex array must be a triangle soup"); // 3 vtx * 3 floats
		assert(normalArray.length === vertexArray.length, "normal array must be same size as vertex array");
		assert(colorArray.length === vertexArray.length, "color array must be same size as vertex array");
		if (uvArray)
			assert((uvArray.length / 2) === (vertexArray.length / 3), "each vertex needs a uv");

		this.vertexBuffer = gl.createBuffer()!;
		this.normalBuffer = gl.createBuffer()!;
		this.colorBuffer = gl.createBuffer()!;
		this.uvBuffer = uvArray ? gl.createBuffer() : null;

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexArray), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);

		if (this.uvBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvArray!), gl.STATIC_DRAW);
		}

		this.elements = vertexArray.length / 3;
	}

	draw(gl: WebGLRenderingContext, program: StandardProgram, texture: WebGLTexture | undefined) {
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
	}
}
