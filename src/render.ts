import { UInt8 } from "stardazed/core";
import { Matrix } from "stardazed/vector";
import { Geometry, VertexAttributeRole, StepMode } from "stardazed/geometry";
import { assert } from "./util";
import { loadImageData } from "./asset";

export interface RenderProgram {
	readonly program: any;
}

export interface RenderTexture {
	readonly texture: any;
}

export interface RenderMesh {
	draw(modelViewMatrix: Matrix, program: RenderProgram, texture?: RenderTexture): void;
}

export interface RenderCommand {
	modelMatrix: Matrix;
	mesh: RenderMesh;
	program: RenderProgram;
	texture?: RenderTexture;
}

export interface RenderPass {
	draw(cmd: RenderCommand): void;
	finish(): void;
}

export interface Renderer {
	readonly canvas: HTMLCanvasElement;

	setup(canvas: HTMLCanvasElement): void;
	createMesh(geom: Geometry): RenderMesh;
	createTexture(fileName: string): Promise<RenderTexture>;
	createProgram(name: string): RenderProgram;

	createPass(projMatrix: Matrix, viewMatrix: Matrix, fogLimits: Float32List): RenderPass;
}

// ------- GL

type StandardProgram = WebGLProgram & {
	vertexPositionAttribute: number;
	vertexColorAttribute: number;
	vertexUVAttribute: number;

	projMatrixUniform: WebGLUniformLocation | null;
	mvMatrixUniform: WebGLUniformLocation | null;
	textureUniform: WebGLUniformLocation | null;
	fogLimitsUniform: WebGLUniformLocation | null;
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

	draw(modelViewMatrix: Matrix, program: RenderProgram, texture: RenderTexture | undefined) {
		const gl = this.gl;
		const extVAO = gl.getExtension("OES_vertex_array_object")!;
		let vao = this.vaos.get(program);

		const glProgram  = program.program as StandardProgram;
		gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, modelViewMatrix.data);

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
			gl.drawElements(gl.TRIANGLES, this.geometry.indexBuffer!.length, this.indexType, 0);
		}
		else {
			gl.drawArrays(gl.TRIANGLES, 0, this.geometry.vertexBuffers[0].length);
		}

		if (texture && glProgram.textureUniform) {
			gl.bindTexture(gl.TEXTURE_2D, null);
		}

		extVAO.bindVertexArrayOES(null);
	}
}

export class WebGLRenderer implements Renderer {
	gl!: WebGLRenderingContext;
	canvas!: HTMLCanvasElement;

	setup(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
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
		program.fogLimitsUniform = gl.getUniformLocation(program, "fogLimits");

		gl.useProgram(null);

		return {program};
	}

	createMesh(geom: Geometry): RenderMesh {
		return new GLMesh(this.gl, geom);
	}

	createPass(projMatrix: Matrix, viewMatrix: Matrix, fogLimits: Float32List) {
		const gl = this.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		const cmds = new Map<RenderProgram, RenderCommand[]>();
		let mvMatrix: Matrix;

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
					gl.uniformMatrix4fv(glProgram.projMatrixUniform, false, projMatrix.data);
					gl.uniform2fv(glProgram.fogLimitsUniform, fogLimits);
					for (const cmd of cmdList) {
						mvMatrix = viewMatrix.mul(cmd.modelMatrix);
						cmd.mesh.draw(mvMatrix, program, cmd.texture);
					}
				}
			}
		};
		return pass;
	}
}

// ------- GPU

export class WebGPURenderer implements Renderer {
	device!: GPUDevice;
	swapChain!: GPUSwapChain;
	rpd!: GPURenderPassDescriptor;
	canvas!: HTMLCanvasElement;

	async setup(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const adapter = await navigator.gpu.requestAdapter();
		const device = await adapter.requestDevice();

		const context = canvas.getContext("gpu")!;
		const format = await (context.getSwapChainPreferredFormat ? context.getSwapChainPreferredFormat(device) : "bgra8unorm");

		this.swapChain = context.configureSwapChain({
			device,
			format
		});
		this.device = device;

		const depthTexture = device.createTexture({
			size: {
				width: canvas.width,
				height: canvas.height,
				depth: 1
			},
			arrayLayerCount: 1,
			mipLevelCount: 1,
			sampleCount: 1,
			dimension: "2d",
			format: "depth32float-stencil8",
			usage: GPUTextureUsageFlags.OUTPUT_ATTACHMENT
		});

		this.rpd = {
			colorAttachments: [{
				attachment: null as any as GPUTextureView, // filled in at rendertime
				loadOp: "clear",
				storeOp: "store",
				clearColor: { r: 0.1, g: .0, b: .05, a: 1.0 }
			}],
			depthStencilAttachment: {
				attachment: depthTexture.createDefaultView(),
				depthLoadOp: "clear",
				depthStoreOp: "store",
				clearDepth: 1.0
			}
		};
	}

	createVertexState(geom: Geometry) {
		const vb = geom.vertexBuffers[0];
		const ib = geom.indexBuffer;
		const vertexBuffer = this.createBufferWithContents(vb.data, GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST);
		const indexBuffer = ib ? this.createBufferWithContents(ib.data, GPUBufferUsageFlags.INDEX | GPUBufferUsageFlags.COPY_DST) : undefined;
		const indexFormat: GPUIndexFormat | undefined = ib ? (ib.elementType.byteLength === 2 ? "uint16" : "uint32") : undefined;

		// create gpu buffer layout
		const posField = vb.fieldByRole(VertexAttributeRole.Position)!;
		const colField = vb.fieldByRole(VertexAttributeRole.Colour)!;
		// const texField = vb.fieldByRole(VertexAttributeRole.UV)!;
		const vertexState: GPUVertexStateDescriptor = {
			vertexBuffers: [
				{
					attributeSet: [
						{
							shaderLocation: 0,
							offset: posField.byteOffset,
							format: "float3" as GPUVertexFormat
						},
						{
							shaderLocation: 1,
							offset: colField.byteOffset,
							format: "float3" as GPUVertexFormat
						}
					],
					stride: vb.stride,
					stepMode: vb.stepMode === StepMode.Vertex ? "vertex" : "instance"
				}
			],
			indexFormat
		};

		return {
			vertexBuffer,
			indexBuffer,
			vertexState
		};
	}

	createMesh(geom: Geometry): RenderMesh {
		const { vertexBuffer, indexBuffer, vertexState } = this.createVertexState(geom);
		const pipelines = new Map<GPUShaderModule, GPURenderPipeline>();
		const renderer = this;
		// const matrix = new Float32Array(1 * 16);
		let uniformBuffer: GPUBuffer | undefined;
		let bindGroup: GPUBindGroup | undefined;

		return {
			draw(modelViewMatrix: Matrix, program: RenderProgram, texture?: RenderTexture) {
				if (uniformBuffer === undefined) {
					uniformBuffer = renderer.createBufferWithContents(modelViewMatrix.data, GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.MAP_WRITE);
				}

				const module = program.program.module as GPUShaderModule;
				const bindGroupLayout = program.program.bindGroupLayout as GPUBindGroupLayout;
				if (bindGroup === undefined) {
					bindGroup = renderer.device.createBindGroup({
						layout: bindGroupLayout,
						bindings: [
							{
								binding: 0,
								resource: { buffer: uniformBuffer, size: 16 * 4 }
							}
						]
					});
				}

				let pipeline: GPURenderPipeline;
				if (! pipelines.has(module)) {
					pipeline = renderer.createPipeline(module, bindGroupLayout, vertexState);
					pipelines.set(module, pipeline);
				}
				else {
					pipeline = pipelines.get(module)!;
				}

				const pass = texture!.texture as GPURenderPassEncoder;
				pass.setPipeline(pipeline);
				pass.setVertexBuffers(0, [vertexBuffer], [0]);
				if (indexBuffer) {
					pass.setIndexBuffer(indexBuffer, 0);
				}
				pass.setBindGroup(0, bindGroup);
				if (geom.indexBuffer) {
					pass.drawIndexed(geom.indexBuffer.length, 1, 0, 0, 0);
				}
				else {
					pass.draw(geom.vertexBuffers[0].length, 1, 0, 0);
				}

				// uniformBuffer.mapWriteAsync().then(data => {
				// 	const dv = new Float32Array(data);
				// 	dv.set(modelViewMatrix);
				// 	uniformBuffer.unmap();
				// });
			}
		};
	}

	createBufferWithContents(contents: TypedArray, usage: GPUBufferUsageFlags) {
		const [buffer, arrayBuffer] = this.device.createBufferMapped({
			size: contents.byteLength,
			usage
		});
		const destView = new (contents.constructor as any)(arrayBuffer) as TypedArray;
		destView.set(contents);
		buffer.unmap();
		return buffer;
	}

	async createTexture(fileName: string): Promise<RenderTexture> {
		const { device } = this;

		const imageData = await loadImageData(fileName);

		const textureSize = {
			width: imageData.width,
			height: imageData.height,
			depth: 1
		};

		const texture = device.createTexture({
			size: textureSize,
			arrayLayerCount: 1,
			mipLevelCount: 1,
			sampleCount: 1,
			dimension: "2d",
			format: "rgba8unorm",
			usage: GPUTextureUsageFlags.COPY_DST | GPUTextureUsageFlags.SAMPLED
		});

		const textureDataBuffer = this.createBufferWithContents(imageData.data, GPUBufferUsageFlags.COPY_SRC);

		const dataCopyView = {
			buffer: textureDataBuffer,
			offset: 0,
			rowPitch: imageData.width * 4,
			imageHeight: 0
		};
		const textureCopyView = {
			texture,
			mipLevel: 0,
			arrayLayer: 0,
			origin: { x: 0, y: 0, z: 0 }
		};
		const blitCommandEncoder = device.createCommandEncoder();
		blitCommandEncoder.copyBufferToTexture(dataCopyView, textureCopyView, textureSize);
		device.getQueue().submit([blitCommandEncoder.finish()]);

		return { texture };
	}

	createPipeline(module: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout, vertexInput: GPUVertexStateDescriptor) {
		const pipelineLayout = this.device.createPipelineLayout({
			bindGroupLayouts: [bindGroupLayout]
		});
		return this.device.createRenderPipeline({
			layout: pipelineLayout,

			vertexStage: {
				module,
				entryPoint: "vertex_main"
			},
			fragmentStage: {
				module,
				entryPoint: "fragment_main"
			},

			primitiveTopology: "triangle-list",
			colorStates: [{
				format: "bgra8unorm",
				alphaBlend: {
					srcFactor: "one",
					dstFactor: "zero",
					operation: "add"
				},
				colorBlend: {
					srcFactor: "one",
					dstFactor: "zero",
					operation: "add"
				},
				writeMask: GPUColorWriteFlags.ALL
			}],
			depthStencilState: {
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth32float-stencil8" /* AL added */
			},
			vertexInput
		});
	}

	createProgram(name: string): RenderProgram {
		const shaderScript = document.getElementById(`${name}GPU`) as HTMLScriptElement;
		assert(shaderScript, "no such shader: " + name);

		const module = this.device.createShaderModule({
			code: shaderScript.textContent || "",
			isWHLSL: true
		});
		const bindGroupLayout = this.device.createBindGroupLayout({
			bindings: [{
				binding: 0,
				visibility: GPUShaderStageFlags.VERTEX,
				type: "uniform-buffer"
			}]
		});

		return { program: { module, bindGroupLayout } };
	}

	createPass(projMatrix: Matrix, viewMatrix: Matrix, _fogLimits: Float32List): RenderPass {
		const encoder = this.device.createCommandEncoder();
		const rpd = this.rpd;
		rpd.colorAttachments[0].attachment = this.swapChain.getCurrentTexture().createDefaultView();
		const pass = encoder.beginRenderPass(rpd);
		const pv = projMatrix.mul(viewMatrix);

		const renderer = this;
		return {
			draw(cmd: RenderCommand) {
				cmd.texture = { texture: pass };
				cmd.mesh.draw(pv, cmd.program, { texture: pass });
			},
			finish() {
				pass.endPass();
				renderer.device.getQueue().submit([encoder.finish()]);
			}
		};
	}
}
