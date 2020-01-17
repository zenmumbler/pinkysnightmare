import { VertexAttributeRole, Geometry, allocateGeometry } from "stardazed/geometry";
import { assert } from "./util";
import { Float, UInt8 } from "stardazed/core";

export function u8Color(r: number, g: number, b: number) {
	return [r / 255, g / 255, b / 255];
}

export function createStandardTexture(gl: WebGLRenderingContext, fileName: string) {
	return new Promise<WebGLTexture>(resolve => {
		const texture = gl.createTexture()!;
		const image = new Image();
		image.onload = function() {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			// gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.bindTexture(gl.TEXTURE_2D, null);

			resolve(texture);
		};

		image.src = fileName;
	})
}

function getShader(gl: WebGLRenderingContext, id: string) {
	const shaderScript = document.getElementById(id) as HTMLScriptElement;
	assert(shaderScript, "no such shader: " + id);

	let shader;
	if (shaderScript.type === "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER)!;
	} else if (shaderScript.type === "x-shader/x-vertex") {
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
	// vertexNormalAttribute: number;
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
	// program.vertexNormalAttribute = gl.getAttribLocation(program, "vertexNormal");
	program.vertexUVAttribute = gl.getAttribLocation(program, "vertexUV");

	program.projMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
	program.mvMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
	// program.normalMatrixUniform = gl.getUniformLocation(program, "normalMatrix");
	program.textureUniform = gl.getUniformLocation(program, "diffuseSampler");
	program.timeUniform = gl.getUniformLocation(program, "currentTime");

	gl.useProgram(null);

	console.info(program, program);

	return program;
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
	if (uvs) vb.fieldView(3).copyValuesFrom(uvs, vertexCount);
	return geom;
}

export class TriMesh {
	geometry: Geometry;
	gvBuffer: WebGLBuffer;
	giBuffer: WebGLBuffer | undefined;
	indexType = 0;
	vaos: Map<WebGLProgram, WebGLVertexArrayObject>;

	constructor(gl: WebGLRenderingContext, geom: Geometry) {
		this.geometry = geom;

		this.gvBuffer = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.gvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, geom.vertexBuffers[0].data, gl.STATIC_DRAW);

		if (geom.indexBuffer) {
			this.giBuffer = gl.createBuffer()!;
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.giBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.indexBuffer.data, gl.STATIC_DRAW);

			if (geom.indexBuffer.elementType === UInt8) this.indexType = gl.UNSIGNED_BYTE;
			else this.indexType = gl.UNSIGNED_SHORT;
		}

		const extVAO = gl.getExtension("OES_vertex_array_object");
		assert(extVAO, "get with the program!");
		this.vaos = new Map();
	}

	draw(gl: WebGLRenderingContext, program: StandardProgram, texture: WebGLTexture | undefined) {
		const extVAO = gl.getExtension("OES_vertex_array_object")!;
		let vao = this.vaos.get(program);

		if (! vao) {
			vao = extVAO.createVertexArrayOES()!;
			extVAO.bindVertexArrayOES(vao);

			const vertexBuffer = this.geometry.vertexBuffers[0];
			const stride = vertexBuffer.stride;
			const fPos = vertexBuffer.fieldByRole(VertexAttributeRole.Position)!;
			const fCol = vertexBuffer.fieldByRole(VertexAttributeRole.Colour)!;
			const fTex = vertexBuffer.fieldByRole(VertexAttributeRole.UV);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.gvBuffer);
			gl.enableVertexAttribArray(program.vertexPositionAttribute);
			gl.vertexAttribPointer(program.vertexPositionAttribute, 3, gl.FLOAT, false, stride, fPos.byteOffset);

			gl.enableVertexAttribArray(program.vertexColorAttribute);
			gl.vertexAttribPointer(program.vertexColorAttribute, 3, gl.FLOAT, false, stride, fCol.byteOffset);

			if (program.vertexUVAttribute > -1) {
				if (fTex) {
					gl.enableVertexAttribArray(program.vertexUVAttribute);
					gl.vertexAttribPointer(program.vertexUVAttribute, 2, gl.FLOAT, false, stride, fTex.byteOffset);
				}
				else {
					gl.disableVertexAttribArray(program.vertexUVAttribute);
				}
			}
			if (this.giBuffer) {
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.giBuffer);
			}
			this.vaos.set(program, vao);
		}
		else {
			extVAO.bindVertexArrayOES(vao);
		}

		if (texture && program.textureUniform) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.uniform1i(program.textureUniform, 0);
		}
		if (this.giBuffer) {
			gl.drawElements(gl.TRIANGLES, this.geometry.indexBuffer!.count, this.indexType, 0);
		}
		else {
			gl.drawArrays(gl.TRIANGLES, 0, this.geometry.vertexBuffers[0].capacity);
		}

		if (texture && program.textureUniform) {
			gl.bindTexture(gl.TEXTURE_2D, null);
		}

		extVAO.bindVertexArrayOES(null);
	}
}
