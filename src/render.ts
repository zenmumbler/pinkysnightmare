import { UInt8 } from "stardazed/core";
import { mat4 } from "stardazed/vector";
import { Geometry, VertexAttributeRole } from "stardazed/geometry";
import { assert } from "./util";
import { loadImageData } from "./asset";

export class RenderModel {
	private meshes: RenderMesh[];
	private texture: RenderTexture | undefined;

	private scaleMat = mat4.create();
	private rotMat = mat4.create();
	private transMat = mat4.create();
	private modelMatrix = mat4.create();
	private modelViewMatrix = mat4.create();

	constructor(meshes: RenderMesh[], texture?: RenderTexture) {
		this.meshes = meshes;
		this.texture = texture;
	}

	draw(viewMatrix: Float32Array, program: RenderProgram, meshIndex: number) {
		mat4.multiply(this.modelMatrix, this.transMat, this.rotMat);
		mat4.multiply(this.modelMatrix, this.modelMatrix, this.scaleMat);

		mat4.multiply(this.modelViewMatrix, viewMatrix, this.modelMatrix);
		this.meshes[meshIndex].draw(this.modelViewMatrix, program, this.texture);
	}

	setUniformScale(s: number) {
		mat4.fromScaling(this.scaleMat, [s, s, s]);
	}

	setScale(sx: number, sy: number, sz: number) {
		mat4.fromScaling(this.scaleMat, [sx, sy, sz]);
	}

	setPosition(v3: NumArray) {
		mat4.fromTranslation(this.transMat, v3);
	}

	setRotation(axis: NumArray, angle: number) {
		mat4.fromRotation(this.rotMat, angle, axis);
	}
}

export interface RenderProgram {
	readonly program: any;
}

export interface RenderTexture {
	readonly texture: any;
}

export interface RenderMesh {
	draw(modelViewMatrix: Float32Array, program: RenderProgram, texture?: RenderTexture): void;
}

export interface RenderCommand {
	model: RenderModel;
	program: RenderProgram;
	meshIndex?: number;
}

export interface RenderPass {
	draw(cmd: RenderCommand): void;
	finish(): void;
}

export interface Renderer {
	setup(canvas: HTMLCanvasElement): void;
	createMesh(geom: Geometry): RenderMesh;
	createTexture(fileName: string): Promise<RenderTexture>;
	createProgram(name: string): RenderProgram;
	createModel(meshes: RenderMesh[], texture?: RenderTexture): RenderModel;

	createPass(projMatrix: Float32Array, viewMatrix: Float32Array): RenderPass;
}

// ------- GL

type StandardProgram = WebGLProgram & {
	vertexPositionAttribute: number;
	vertexColorAttribute: number;
	vertexUVAttribute: number;

	projMatrixUniform: WebGLUniformLocation | null;
	mvMatrixUniform: WebGLUniformLocation | null;
	textureUniform: WebGLUniformLocation | null;
};

class GLMesh {
	gl: WebGLRenderingContext;
	geometry: Geometry;
	gvBuffer: WebGLBuffer;
	giBuffer: WebGLBuffer | undefined;
	indexType = 0;
	vaos: Map<WebGLProgram, WebGLVertexArrayObject>;

	constructor(gl: WebGLRenderingContext, geom: Geometry) {
		this.gl = gl;
		this.geometry = geom;

		this.gvBuffer = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.gvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, geom.vertexBuffers[0].data, gl.STATIC_DRAW);

		if (geom.indexBuffer) {
			this.giBuffer = gl.createBuffer()!;
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.giBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.indexBuffer.data, gl.STATIC_DRAW);

			if (geom.indexBuffer.elementType === UInt8) { this.indexType = gl.UNSIGNED_BYTE; }
			else { this.indexType = gl.UNSIGNED_SHORT; }
		}

		const extVAO = gl.getExtension("OES_vertex_array_object");
		assert(extVAO, "get with the program!");
		this.vaos = new Map();
	}

	draw(modelViewMatrix: Float32Array, program: RenderProgram, texture: RenderTexture | undefined) {
		const gl = this.gl;
		const extVAO = gl.getExtension("OES_vertex_array_object")!;
		let vao = this.vaos.get(program);

		const glProgram  = program.program as StandardProgram;
		gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, modelViewMatrix);

		if (! vao) {
			vao = extVAO.createVertexArrayOES()!;
			extVAO.bindVertexArrayOES(vao);

			const vertexBuffer = this.geometry.vertexBuffers[0];
			const stride = vertexBuffer.stride;
			const fPos = vertexBuffer.fieldByRole(VertexAttributeRole.Position)!;
			const fCol = vertexBuffer.fieldByRole(VertexAttributeRole.Colour)!;
			const fTex = vertexBuffer.fieldByRole(VertexAttributeRole.UV);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.gvBuffer);
			gl.enableVertexAttribArray(glProgram.vertexPositionAttribute);
			gl.vertexAttribPointer(glProgram.vertexPositionAttribute, 3, gl.FLOAT, false, stride, fPos.byteOffset);

			gl.enableVertexAttribArray(glProgram.vertexColorAttribute);
			gl.vertexAttribPointer(glProgram.vertexColorAttribute, 3, gl.FLOAT, false, stride, fCol.byteOffset);

			if (glProgram.vertexUVAttribute > -1) {
				if (fTex) {
					gl.enableVertexAttribArray(glProgram.vertexUVAttribute);
					gl.vertexAttribPointer(glProgram.vertexUVAttribute, 2, gl.FLOAT, false, stride, fTex.byteOffset);
				}
				else {
					gl.disableVertexAttribArray(glProgram.vertexUVAttribute);
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

		if (texture && glProgram.textureUniform) {
			const glTexture = texture.texture as WebGLTexture;
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, glTexture);
			gl.uniform1i(glProgram.textureUniform, 0);
		}
		if (this.giBuffer) {
			gl.drawElements(gl.TRIANGLES, this.geometry.indexBuffer!.count, this.indexType, 0);
		}
		else {
			gl.drawArrays(gl.TRIANGLES, 0, this.geometry.vertexBuffers[0].capacity);
		}

		if (texture && glProgram.textureUniform) {
			gl.bindTexture(gl.TEXTURE_2D, null);
		}

		extVAO.bindVertexArrayOES(null);
	}
}

export class WebGLRenderer implements Renderer {
	gl!: WebGLRenderingContext;

	setup(canvas: HTMLCanvasElement) {
		try {
			this.gl = canvas.getContext("webgl")!;
		} catch (e) {
		}
	
		assert(this.gl, "Could not initialise WebGL");

		this.gl.clearColor(0.1, 0.0, 0.05, 1.0);
		this.gl.enable(this.gl.DEPTH_TEST);
		const w = canvas.width;
		const h = canvas.height;
		this.gl.viewport(0, 0, w, h);
	}

	createTexture(fileName: string) {
		return new Promise<RenderTexture>(async (resolve) => {
			const gl = this.gl;
			const imageData = await loadImageData(fileName);

			const texture = gl.createTexture()!;
			gl.bindTexture(gl.TEXTURE_2D, texture);
			// gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.bindTexture(gl.TEXTURE_2D, null);

			resolve({texture});
		});
	}

	createShader(id: string) {
		const gl = this.gl;
		const shaderScript = document.getElementById(id) as HTMLScriptElement;
		assert(shaderScript, "no such shader: " + id);
	
		let shader: WebGLShader;
		if (shaderScript.type === "x-shader/x-fragment") {
			shader = gl.createShader(gl.FRAGMENT_SHADER)!;
		} else if (shaderScript.type === "x-shader/x-vertex") {
			shader = gl.createShader(gl.VERTEX_SHADER)!;
		} else {
			assert(false, id + " does not seem to be a shader");
		}
	
		gl.shaderSource(shader, shaderScript.textContent || "");
		gl.compileShader(shader);
	
		if (! gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			assert(false, gl.getShaderInfoLog(shader) || "bad shader");
		}
	
		return shader;
	}

	createProgram(name: string) {
		const gl = this.gl;

		const program = gl.createProgram()! as StandardProgram;
		gl.attachShader(program, this.createShader(`${name}Vert`));
		gl.attachShader(program, this.createShader(`${name}Frag`));
		gl.linkProgram(program);
	
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			alert("Could not initialise shaders");
		}
	
		gl.useProgram(program);
	
		program.vertexPositionAttribute = gl.getAttribLocation(program, "vertexPos_model");
		program.vertexColorAttribute = gl.getAttribLocation(program, "vertexColor");
		program.vertexUVAttribute = gl.getAttribLocation(program, "vertexUV");
	
		program.projMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
		program.mvMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
		program.textureUniform = gl.getUniformLocation(program, "diffuseSampler");
	
		gl.useProgram(null);
	
		return {program};
	}

	createMesh(geom: Geometry): RenderMesh {
		return new GLMesh(this.gl, geom);
	}

	createModel(meshes: RenderMesh[], texture?: RenderTexture) {
		return new RenderModel(meshes, texture);
	}

	createPass(projMatrix: Float32Array, viewMatrix: Float32Array) {
		const gl = this.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		const cmds = new Map<RenderProgram, RenderCommand[]>();

		const pass: RenderPass = {
			draw(cmd: RenderCommand) {
				if (! cmds.has(cmd.program)) {
					cmds.set(cmd.program, []);
				}
				cmds.get(cmd.program)!.push(cmd);
			},
			finish() {
				for (const [program, cmdList] of cmds) {
					const glProgram = program.program as StandardProgram;
					gl.useProgram(glProgram);
					gl.uniformMatrix4fv(glProgram.projMatrixUniform, false, projMatrix);
					for (const cmd of cmdList) {
						cmd.model.draw(viewMatrix, program, cmd.meshIndex || 0);
					}
				}
			}
		};
		return pass;
	}
}

// ------- GPU
/*
export class WebGPURenderer implements Renderer {
	setup(canvas: HTMLCanvasElement) {

	}
}
*/
