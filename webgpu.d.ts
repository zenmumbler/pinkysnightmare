// WebGPU types
// by @zenmumbler
// Up-to-date with spec as of 2020-Jan-17

interface GPUObjectDescriptorBase {
	label?: string;
}

interface GPUObjectBase {
	label?: string;
}

type GPUBufferSize = number; // unsigned long long -> bigint?

type GPUColor = number[] | {
	r: number;
	g: number;
	b: number;
	a: number;
};

type GPUOrigin2D = number[] | {
	x?: number;
	y?: number;
};

type GPUOrigin3D = number[] | {
	x?: number;
	y?: number;
	z?: number;
};

type GPUExtent3D = number[] | {
	width: number;
	height: number;
	depth: number;
};

type GPUExtensionTextureFormat =
	"s3tc-dxt1"; // not real, just a placeholder

type GPUTextureFormat =
	// 8-bit formats
	"r8unorm" |
	"r8snorm" |
	"r8uint" |
	"r8sint" |
	// 16-bit formats
	"r16uint" |
	"r16sint" |
	"r16float" |
	"rg8unorm" |
	"rg8snorm" |
	"rg8uint" |
	"rg8sint" |
	// 32-bit formats
	"r32uint" |
	"r32sint" |
	"r32float" |
	"rg16uint" |
	"rg16sint" |
	"rg16float" |
	"rgba8unorm" |
	"rgba8unorm-srgb" |
	"rgba8snorm" |
	"rgba8uint" |
	"rgba8sint" |
	"bgra8unorm" |
	"bgra8unorm-srgb" |
	// Packed 32-bit formats
	"rgb10a2unorm" |
	"rg11b10float" |
	// 64-bit formats
	"rg32uint" |
	"rg32sint" |
	"rg32float" |
	"rgba16uint" |
	"rgba16sint" |
	"rgba16float" |
	// 128-bit formats
	"rgba32uint" |
	"rgba32sint" |
	"rgba32float" |
	// Depth and stencil formats
	"depth32float" |
	"depth24plus" |
	"depth24plus-stencil8" |
	GPUExtensionTextureFormat;


declare const enum GPUBufferUsageFlags {
	MAP_READ = 0x0001,
	MAP_WRITE = 0x0002,
	COPY_SRC = 0x0004,
	COPY_DST = 0x0008,
	INDEX = 0x0010,
	VERTEX = 0x0020,
	UNIFORM = 0x0040,
	STORAGE = 0x0080,
	INDIRECT = 0x0100,
}

interface GPUBufferDescriptor extends GPUObjectDescriptorBase {
	size: GPUBufferSize;
	usage: GPUBufferUsageFlags;
}

interface GPUBuffer extends GPUObjectBase {
	mapReadAsync(): Promise<ArrayBuffer>;
	mapWriteAsync(): Promise<ArrayBuffer>;
	unmap(): void;
	destroy(): void;
}

type GPUMappedBuffer = [GPUBuffer, ArrayBuffer];


type GPUTextureDimension = "1d" | "2d" | "3d";

declare const enum GPUTextureUsageFlags {
	COPY_SRC = 0x01,
	COPY_DST = 0x02,
	SAMPLED = 0x04,
	STORAGE = 0x08,
	OUTPUT_ATTACHMENT = 0x10,
}

interface GPUTextureDescriptor extends GPUObjectDescriptorBase {
	size: GPUExtent3D;
	arrayLayerCount?: number;
	mipLevelCount?: number;
	sampleCount?: number;
	dimension?: GPUTextureDimension;
	format: GPUTextureFormat;
	usage: GPUTextureUsageFlags;
}

interface GPUTexture extends GPUObjectBase {
	createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
	destroy(): void;
}


type GPUTextureAspect = "all" | "stencil-only" | "depth-only";

type GPUTextureViewDimension = "1d" | "2d" | "2d-array" | "cube" | "cube-array" | "3d";

interface GPUTextureViewDescriptor extends GPUObjectDescriptorBase {
	format?: GPUTextureFormat;
	dimension?: GPUTextureViewDimension;
	aspect?: GPUTextureAspect;
	baseMipLevel?: number;
	mipLevelCount?: number;
	baseArrayLayer?: number;
	arrayLayerCount?: number;
}

interface GPUTextureView extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_TEXTUREVIEW__?: never;
}


type GPUAddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";

type GPUFilterMode = "nearest" | "linear";

type GPUCompareFunction = "never" | "less" | "equal" | "less-equal" | "greater" | "not-equal" | "greater-equal" | "always";

interface GPUSamplerDescriptor extends GPUObjectDescriptorBase {
	addressModeU?: GPUAddressMode;
	addressModeV?: GPUAddressMode;
	addressModeW?: GPUAddressMode;
	magFilter?: GPUFilterMode;
	minFilter?: GPUFilterMode;
	mipmapFilter?: GPUFilterMode;
	lodMinClamp?: number;
	lodMaxClamp?: number;
	compare?: GPUCompareFunction;
}

interface GPUSampler extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_SAMPLER__?: never;
}


type GPUTextureComponentType = "float" | "sint" | "uint";

declare const enum GPUShaderStageFlags {
	VERTEX = 0x1,
	FRAGMENT = 0x2,
	COMPUTE = 0x4
}

type GPUBindingType = "uniform-buffer" | "storage-buffer" | "readonly-storage-buffer" | "sampler" | "sampled-texture" | "storage-texture";

interface GPUBindGroupLayoutBinding {
	binding: number;
	visibility: GPUShaderStageFlags;
	type: GPUBindingType;
	textureDimension?: GPUTextureDimension;
	textureComponentType?: GPUTextureComponentType;
	multisampled?: boolean;
	hasDynamicOffset?: boolean;
}

interface GPUBindGroupLayoutDescriptor extends GPUObjectDescriptorBase {
	bindings: GPUBindGroupLayoutBinding[];
}

interface GPUBindGroupLayout extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_BINDGROUPLAYOUT__?: never;
}


interface GPUBufferBinding {
	buffer: GPUBuffer;
	offset?: GPUBufferSize;
	size?: GPUBufferSize;
}

type GPUBindingResource = GPUSampler | GPUTextureView | GPUBufferBinding;

interface GPUBindGroupBinding {
	binding: number;
	resource: GPUBindingResource;
}

interface GPUBindGroupDescriptor extends GPUObjectDescriptorBase {
	layout: GPUBindGroupLayout;
	bindings: GPUBindGroupBinding[];
}

interface GPUBindGroup extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_BINDGROUP__?: never;
}


interface GPUPipelineLayoutDescriptor extends GPUObjectDescriptorBase {
	bindGroupLayouts: GPUBindGroupLayout[];
}

interface GPUPipelineLayout extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_PIPELINELAYOUT__?: never;
}


interface GPUShaderModuleDescriptor extends GPUObjectDescriptorBase {
	code: string | Uint32Array;
	// WebKit impl, not in spec
	isWHLSL?: boolean;
}

interface GPUShaderModule extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_SHADERMODULE__?: never;
}


interface GPUPipelineDescriptorBase extends GPUObjectDescriptorBase {
	layout: GPUPipelineLayout;
}

interface GPUProgrammableStageDescriptor {
	module: GPUShaderModule;
	entryPoint: string;
}


interface GPUComputePipelineDescriptor extends GPUPipelineDescriptorBase {
	computeStage: GPUProgrammableStageDescriptor;
}

interface GPUComputePipeline extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_COMPUTEPIPELINE__?: never;
}


type GPUBlendOperation = "add" | "subtract" | "reverse-subtract" | "min" | "max";

type GPUBlendFactor =
	"zero" |
	"one" |
	"src-color" |
	"one-minus-src-color" |
	"src-alpha" |
	"one-minus-src-alpha" |
	"dst-color" |
	"one-minus-dst-color" |
	"dst-alpha" |
	"one-minus-dst-alpha" |
	"src-alpha-saturated" |
	"blend-color" |
	"one-minus-blend-color";

interface GPUBlendDescriptor {
	srcFactor?: GPUBlendFactor;
	dstFactor?: GPUBlendFactor;
	operation?: GPUBlendOperation;
}

declare const enum GPUColorWriteFlags {
	RED = 0x1,
	GREEN = 0x2,
	BLUE = 0x4,
	ALPHA = 0x8,
	ALL = 0xF,
}

interface GPUColorStateDescriptor {
	format: GPUTextureFormat;
	alphaBlend?: GPUBlendDescriptor;
	colorBlend?: GPUBlendDescriptor;
	writeMask?: GPUColorWriteFlags;
}

type GPUFrontFace = "ccw" | "cw";

type GPUCullMode = "none" | "front" | "back";

interface GPURasterizationStateDescriptor {
	frontFace?: GPUFrontFace;
	cullMode?: GPUCullMode;
	depthBias?: number;
	depthBiasSlopeScale?: number;
	depthBiasClamp?: number;
}


type GPUStencilOperation = "keep" | "zero" | "replace" | "invert" | "increment-clamp" | "decrement-clamp" | "increment-wrap" | "decrement-wrap";

interface GPUStencilStateFaceDescriptor {
	compare?: GPUCompareFunction;
	failOp?: GPUStencilOperation;
	depthFailOp?: GPUStencilOperation;
	passOp?: GPUStencilOperation;
}

interface GPUDepthStencilStateDescriptor {
	format: GPUTextureFormat;
	depthWriteEnabled?: boolean;
	depthCompare?: GPUCompareFunction;
	stencilFront?: GPUStencilStateFaceDescriptor;
	stencilBack?: GPUStencilStateFaceDescriptor;
	stencilReadMask?: number;
	stencilWriteMask?: number;
}


type GPUIndexFormat = "uint16" | "uint32";

type GPUVertexFormat =
	"uchar2" | "uchar4" |
	"char2" | "char4" |
	"uchar2norm" | "uchar4norm" |
	"char2norm" | "char4norm" |
	"ushort2" | "ushort4" |
	"short2" | "short4" |
	"ushort2norm" | "ushort4norm" |
	"short2norm" | "short4norm" |
	"half2" | "half4" |
	"float" | "float2" | "float3" | "float4" |
	"uint" | "uint2" | "uint3" | "uint4" |
	"int" | "int2" | "int3" | "int4";

type GPUInputStepMode = "vertex" | "instance";

interface GPUVertexAttributeDescriptor {
	format: GPUVertexFormat;
	offset: GPUBufferSize;
	shaderLocation: number;
}

interface GPUVertexBufferLayoutDescriptor {
	arrayStride: number;
	attributes: GPUVertexAttributeDescriptor[];
	stepMode?: GPUInputStepMode;
}

interface GPUVertexStateDescriptor {
	indexFormat?: GPUIndexFormat;
	vertexBuffers?: GPUVertexBufferLayoutDescriptor[];
}


type GPUPrimitiveTopology = "point-list" | "line-list" | "line-strip" | "triangle-list" | "triangle-strip";

interface GPURenderPipelineDescriptor extends GPUObjectDescriptorBase {
	vertexStage: GPUProgrammableStageDescriptor;
	fragmentStage?: GPUProgrammableStageDescriptor;
	primitiveTopology: GPUPrimitiveTopology;
	rasterizationState?: GPURasterizationStateDescriptor;
	colorStates?: GPUColorStateDescriptor[];
	depthStencilState?: GPUDepthStencilStateDescriptor;
	vetexState?: GPUVertexStateDescriptor;
	sampleCount?: number;
	sampleMask?: number;
	alphaToCoverageEnabled?: boolean;
}

interface GPURenderPipeline extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_RENDERPIPELINE__?: never;
}


interface GPUCommandBufferDescriptor extends GPUObjectBase {
	// no properties, no need for branding
}

interface GPUCommandBuffer extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_COMMANDBUFFER__?: never;
}


interface GPUBufferCopyView {
	buffer: GPUBuffer;
	offset?: GPUBufferSize;
	rowPitch?: number;
	imageHeight?: number;
}

interface GPUTextureCopyView {
	texture: GPUTexture;
	mipLevel?: number;
	arrayLayer?: number;
	origin?: GPUOrigin3D;
}

interface GPUImageBitmapCopyView {
	imageBitmap: ImageBitmap;
	origin: GPUOrigin2D;
}

interface GPUProgrammablePassEncoder {
	setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffets?: number[]): void;
	setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsetsData: Uint32Array,
		dynamicOffsetsDataStart: number, dynamicOffsetsDataLength: number): void;
	
	pushDebugGroup(groupLabel: string): void;
	popDebugGroup(): void;
	insertDebugMarker(markerLabel: string): void;
}

interface GPUComputePassDescriptor extends GPUObjectDescriptorBase {
	// no properties, no need for branding
}

interface GPUComputePassEncoder extends GPUObjectBase, GPUProgrammablePassEncoder {
	
}

interface GPUCommandEncoderDescriptor extends GPUObjectDescriptorBase {
	// no properties, no need for branding
}

interface GPUCommandEncoder extends GPUObjectBase {
	beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
	beginComputePass(descriptor: GPUComputePassDescriptor): GPUComputePassEncoder;

	copyBufferToBuffer(
		source: GPUBuffer, sourceOffset: GPUBufferSize,
		desination: GPUBuffer, destinationOffset: GPUBufferSize,
		size: GPUBufferSize
	): void;
	copyBufferToTexture(
		source: GPUBufferCopyView,
		destination: GPUTextureCopyView,
		copySize: GPUExtent3D
	): void;
	copyTextureToBuffer(
		source: GPUTextureCopyView,
		destination: GPUBufferCopyView,
		copySize: GPUExtent3D
	): void;
	copyTextureToTexture(
		source: GPUTextureCopyView,
		destination: GPUTextureCopyView,
		copySize: GPUExtent3D
	): void;

	pushDebugGroup(groupLabel: string): void;
	popDebugGroup(): void;
	insertDebugMarker(markerLabel: string): void;

	finish(descriptor?: GPUCommandBufferDescriptor): GPUCommandBuffer;
}


interface GPURenderBundleEncoderDescriptor extends GPUObjectDescriptorBase {
}

interface GPURenderBundleEncoder extends GPUObjectBase {
}


interface GPUQueue {
}


type GPUExtensionName = "anisotropic-filtering";

interface GPULimits {
	maxBindGroups?: number;
	maxDynamicUniformBuffersPerPipelineLayout?: number;
	maxDynamicStorageBuffersPerPipelineLayout?: number;
	maxSampledTexturesPerShaderStage?: number;
	maxSamplersPerShaderStage?: number;
	maxStorageBuffersPerShaderStage?: number;
	maxStorageTexturesPerShaderStage?: number;
	maxUniformBuffersPerShaderStage?: number;
}

interface GPUDevice extends GPUObjectBase, EventTarget {
	readonly adapter: GPUAdapter;
	readonly extensions: ReadonlyArray<GPUExtensionName>;
	readonly limits: GPULimits;

	// in spec, not in impl
	readonly defaultQueue: GPUQueue;
	// in impl, not in spec
	getQueue(): GPUQueue;

	createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
	createBufferMapped(descriptor: GPUBufferDescriptor): GPUMappedBuffer;
	createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
	createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
	createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
	createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
	createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
	createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
	createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
	createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
	createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
	createRenderBundleEncoder(descriptor: GPURenderBundleEncoderDescriptor): GPURenderBundleEncoder;
}

interface GPUDeviceDescriptor {
	extensions?: GPUExtensionName[];
	limits?: GPULimits;
}


interface GPUAdapter {
	readonly name: string;
	readonly extensions: ReadonlyArray<GPUExtensionName>;

	requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

type GPUPowerPreference = "low-power" | "high-performance";

interface GPURequestAdapterOptions {
	powerPreference?: GPUPowerPreference;
}


interface GPU {
	requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter>;
}

interface Navigator {
	readonly gpu: GPU;
}
