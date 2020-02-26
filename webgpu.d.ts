// WebGPU types
// by @zenmumbler
// Up-to-date with spec as of 2020-Feb-7

// numeric type aliases
type GPUBufferDynamicOffset = number; // uint32
type GPUFenceValue = number; // uint64, use bigint?
type GPUStencilValue = number; // uint32
type GPUSampleMask = number; // uint32
type GPUDepthBias = number; // int32 (signed)

type GPUSize64 = number; // uint64, use bigint?
type GPUIntegerCoordinate = number; // uint32
type GPUIndex32 = number; // uint32
type GPUSize32 = number; // uint32
type GPUSignedOffset32 = number; // int32 (signed)


interface GPUObjectDescriptorBase {
	label?: string;
}

interface GPUObjectBase {
	label?: string;
}

type GPUColor = number[] | {
	r: number;
	g: number;
	b: number;
	a: number;
};

type GPUOrigin2D = GPUIntegerCoordinate[] | {
	x?: GPUIntegerCoordinate;
	y?: GPUIntegerCoordinate;
};

type GPUOrigin3D = GPUIntegerCoordinate[] | {
	x?: GPUIntegerCoordinate;
	y?: GPUIntegerCoordinate;
	z?: GPUIntegerCoordinate;
};

type GPUExtent3D = GPUIntegerCoordinate[] | {
	width: GPUIntegerCoordinate;
	height: GPUIntegerCoordinate;
	depth: GPUIntegerCoordinate;
};

type GPUExtensionTextureFormat =
	"s3tc-dxt1"; // not real, just a placeholder

type GPUTextureFormatNonSpec =
	"depth32float-stencil8"; // used in WebKit as of 2020-Jan

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
	GPUExtensionTextureFormat |
	GPUTextureFormatNonSpec;


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
	size: GPUSize64;
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
	arrayLayerCount?: GPUIntegerCoordinate;
	mipLevelCount?: GPUIntegerCoordinate;
	sampleCount?: GPUSize32;
	dimension?: GPUTextureDimension;
	format: GPUTextureFormat;
	usage: GPUTextureUsageFlags;
}

interface GPUTexture extends GPUObjectBase {
	createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
	// in impl
	createDefaultView(): GPUTextureView;
	destroy(): void;
}


type GPUTextureAspect = "all" | "stencil-only" | "depth-only";

type GPUTextureViewDimension = "1d" | "2d" | "2d-array" | "cube" | "cube-array" | "3d";

interface GPUTextureViewDescriptor extends GPUObjectDescriptorBase {
	format?: GPUTextureFormat;
	dimension?: GPUTextureViewDimension;
	aspect?: GPUTextureAspect;
	baseMipLevel?: GPUIntegerCoordinate;
	mipLevelCount?: GPUIntegerCoordinate;
	baseArrayLayer?: GPUIntegerCoordinate;
	arrayLayerCount?: GPUIntegerCoordinate;
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
	binding: GPUIndex32;
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
	offset?: GPUSize64;
	size?: GPUSize64;
}

type GPUBindingResource = GPUSampler | GPUTextureView | GPUBufferBinding;

interface GPUBindGroupBinding {
	binding: GPUIndex32;
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
	depthBias?: GPUDepthBias;
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
	stencilReadMask?: GPUStencilValue;
	stencilWriteMask?: GPUStencilValue;
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
	offset: GPUSize64;
	shaderLocation: GPUIndex32;
}

interface GPUVertexBufferLayoutDescriptor {
	// in spec
	arrayStride?: GPUSize64;
	// in impl
	stride?: GPUSize64;
	// in spec
	attributes?: GPUVertexAttributeDescriptor[];
	// in impl
	attributeSet?: GPUVertexAttributeDescriptor[];
	stepMode?: GPUInputStepMode;
}

interface GPUVertexStateDescriptor {
	indexFormat?: GPUIndexFormat;
	vertexBuffers?: GPUVertexBufferLayoutDescriptor[];
}


type GPUPrimitiveTopology = "point-list" | "line-list" | "line-strip" | "triangle-list" | "triangle-strip";

interface GPURenderPipelineDescriptor extends GPUPipelineDescriptorBase {
	vertexStage: GPUProgrammableStageDescriptor;
	fragmentStage?: GPUProgrammableStageDescriptor;
	primitiveTopology: GPUPrimitiveTopology;
	rasterizationState?: GPURasterizationStateDescriptor;
	colorStates?: GPUColorStateDescriptor[];
	depthStencilState?: GPUDepthStencilStateDescriptor;
	// in spec
	vertexState?: GPUVertexStateDescriptor;
	// in impl
	vertexInput?: GPUVertexStateDescriptor;
	sampleCount?: GPUSize32;
	sampleMask?: GPUSampleMask;
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
	offset?: GPUSize64;
	rowPitch?: GPUSize32;
	imageHeight?: GPUSize32;
}

interface GPUTextureCopyView {
	texture: GPUTexture;
	mipLevel?: GPUIntegerCoordinate;
	arrayLayer?: GPUIntegerCoordinate;
	origin?: GPUOrigin3D;
}

interface GPUImageBitmapCopyView {
	imageBitmap: ImageBitmap;
	origin: GPUOrigin2D;
}

interface GPUProgrammablePassEncoder {
	setBindGroup(index: GPUIndex32, bindGroup: GPUBindGroup, dynamicOffets?: GPUBufferDynamicOffset[]): void;
	setBindGroup(index: GPUIndex32, bindGroup: GPUBindGroup, dynamicOffsetsData: Uint32Array,
		dynamicOffsetsDataStart: GPUSize64, dynamicOffsetsDataLength: GPUSize64): void;

	pushDebugGroup(groupLabel: string): void;
	popDebugGroup(): void;
	insertDebugMarker(markerLabel: string): void;
}

interface GPUComputePassDescriptor extends GPUObjectDescriptorBase {
	// no properties, no need for branding
}

interface GPUComputePassEncoder extends GPUObjectBase, GPUProgrammablePassEncoder {
	setPipeline(pipeline: GPUComputePipeline): void;
	dispatch(x: GPUSize32, y?: GPUSize32, z?: GPUSize32): void;
	dispatchIndirect(indirectBuffer: GPUBuffer, indirectOffset: GPUSize64): void;

	endPass(): void;
}


interface GPURenderEncodeBase {
	setPipeline(pipeline: GPURenderPipeline): void;

	setIndexBuffer(buffer: GPUBuffer, offset?: GPUSize64): void;
	setVertexBuffer(slot: GPUIndex32, buffer: GPUBuffer, offset?: GPUSize64): void;
	// in impl
	setVertexBuffers(unknown: number, buffers: GPUBuffer[], offsets: GPUSize64[]): void;

	draw(vertexCount: GPUSize32, instanceCount: GPUSize32, firstVertex: GPUSize32, firstInstance: GPUSize32): void;
	drawIndexed(indexCount: GPUSize32, instanceCount: GPUSize32, firstIndex: GPUSize32, baseVertex: GPUSignedOffset32, firstInstance: GPUSize32): void;

	drawIndirect(indirectBuffer: GPUBuffer, indirectOffset: GPUSize64): void;
	drawIndexedIndirect(indirectBuffer: GPUBuffer, indirectOffset: GPUSize64): void;
}

type GPULoadOp = "load";

type GPUStoreOp = "store" | "clear";

interface GPURenderPassColorAttachmentDescriptor {
	attachment: GPUTextureView;
	resolveTarget?: GPUTextureView;

	// in spec
	loadValue?: GPULoadOp | GPUColor;
	// in impl
	loadOp?: "load" | "clear";
	// in impl
	clearColor?: GPUColor;

	storeOp?: GPUStoreOp;
}

interface GPURenderPassDepthStencilAttachmentDescriptor {
	attachment: GPUTextureView;

	// in spec
	depthLoadValue?: GPULoadOp | number;
	// in impl
	depthLoadOp?: "load" | "clear";
	// in impl
	clearDepth?: number;
	depthStoreOp: GPUStoreOp;

	// mandatory in spec, optional in impl
	stencilLoadValue?: GPULoadOp | GPUStencilValue;
	// mandatory in spec, optional in impl
	stencilStoreOp?: GPUStoreOp;
}

interface GPURenderPassDescriptor extends GPUObjectDescriptorBase {
	colorAttachments: GPURenderPassColorAttachmentDescriptor[];
	depthStencilAttachment?: GPURenderPassDepthStencilAttachmentDescriptor;
}

interface GPURenderPassEncoder extends GPUObjectBase, GPUProgrammablePassEncoder, GPURenderEncodeBase {
	setViewport(x: number, y: number, width: number, height: number, minDepth: number, maxDepth: number): void;
	setScissorRect(x: GPUIntegerCoordinate, y: GPUIntegerCoordinate, width: GPUIntegerCoordinate, height: GPUIntegerCoordinate): void;
	setBlendColor(color: GPUColor): void;
	setStencilReference(reference: GPUStencilValue): void;

	executeBundles(bundles: GPURenderBundle[]): void;
	endPass(): void;
}


interface GPUCommandEncoderDescriptor extends GPUObjectDescriptorBase {
	// no properties, no need for branding
}

interface GPUCommandEncoder extends GPUObjectBase {
	beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
	beginComputePass(descriptor: GPUComputePassDescriptor): GPUComputePassEncoder;

	copyBufferToBuffer(
		source: GPUBuffer, sourceOffset: GPUSize64,
		desination: GPUBuffer, destinationOffset: GPUSize64,
		size: GPUSize64
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


interface GPURenderBundleDescriptor extends GPUObjectDescriptorBase {
	// no properties, no need for branding
}

interface GPURenderBundle extends GPUObjectBase {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_RENDERBUNDLE__?: never;
}

interface GPURenderBundleEncoderDescriptor extends GPUObjectDescriptorBase {
	colorFormats: GPUTextureFormat[];
	depthStencilFormat?: GPUTextureFormat;
	sampleCount?: GPUSize32;
}

interface GPURenderBundleEncoder extends GPUObjectBase, GPUProgrammablePassEncoder, GPURenderEncodeBase {
	finish(descriptor?: GPURenderBundleDescriptor): GPURenderBundle;
}


interface GPUQueue extends GPUObjectBase {
	submit(commandBuffers: GPUCommandBuffer[]): void;

	createFence(descriptor?: GPUFenceDescriptor): GPUFence;
	signal(fence: GPUFence, signalValue: GPUFenceValue): void;

	copyImageBitmapToTexture(
		source: GPUImageBitmapCopyView,
		destination: GPUTextureCopyView,
		copySize: GPUExtent3D
	): void;
}


interface GPUFenceDescriptor extends GPUObjectDescriptorBase {
	initialValue?: GPUFenceValue;
}

interface GPUFence extends GPUObjectBase {
	getCompletedValue(): GPUFenceValue;
	onCompletion(completionValue: GPUFenceValue): Promise<void>;
}


interface GPUCanvasContext {
	configureSwapChain(descriptor: GPUSwapChainDescriptor): GPUSwapChain;
	getSwapChainPreferredFormat(device: GPUDevice): Promise<GPUTextureFormat>;
}

interface GPUSwapChainDescriptor extends GPUObjectDescriptorBase {
	device: GPUDevice;
	format: GPUTextureFormat;
	usage?: GPUTextureUsageFlags;
}

interface GPUSwapChain extends GPUObjectBase {
	getCurrentTexture(): GPUTexture;
}

interface HTMLCanvasElement {
    getContext(contextId: "gpu"): GPUCanvasContext | null;
}


interface GPUDeviceLostInfo {
	readonly message: string;
}

interface GPUOutOfMemoryError {
	// no properties, added branding field for TS disambiguation
	readonly __WEBGPU_OUTOFMEMORYERROR__?: never;
}
interface GPUOutOfMemoryErrorConstructor {
	new(): GPUOutOfMemoryError;
}
declare const GPUOutOfMemoryError: GPUOutOfMemoryErrorConstructor;

interface GPUValidationError {
	readonly message: string;
	readonly __WEBGPU_VALIDATIONERROR__?: never;
}
interface GPUValidationErrorConstructor {
	new(message: string): GPUValidationError;
}
declare const GPUValidationError: GPUValidationErrorConstructor;

type GPUError = GPUOutOfMemoryError | GPUValidationError;

type GPUErrorFilter = "none" | "out-of-memory" | "validation";


interface GPUUncapturedErrorEvent extends Event {
	readonly error: GPUError;
}
interface GPUUncapturedErrorEventInit extends EventInit {
	error: GPUError;
}
interface GPUUncapturedErrorEventConstructor {
	new(type: string, gpuUncapturedErrorEventInitDict: GPUUncapturedErrorEventInit): GPUUncapturedErrorEvent;
}
declare const GPUUncapturedErrorEvent: GPUUncapturedErrorEventConstructor;


type GPUExtensionName = "texture-compression-bc";

interface GPULimits {
	maxBindGroups?: GPUSize32;
	maxDynamicUniformBuffersPerPipelineLayout?: GPUSize32;
	maxDynamicStorageBuffersPerPipelineLayout?: GPUSize32;
	maxSampledTexturesPerShaderStage?: GPUSize32;
	maxSamplersPerShaderStage?: GPUSize32;
	maxStorageBuffersPerShaderStage?: GPUSize32;
	maxStorageTexturesPerShaderStage?: GPUSize32;
	maxUniformBuffersPerShaderStage?: GPUSize32;
}

interface GPUDeviceDescriptor {
	extensions?: GPUExtensionName[];
	limits?: GPULimits;
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

	// fatal errors (§20.1)
	readonly lost: Promise<GPUDeviceLostInfo>;

	// error scopes (§20.2)
	pushErrorScope(filter: GPUErrorFilter): void;
	popErrorScope(): Promise<GPUError | void>;

	// telemetry (§20.3)
	onuncapturederror: ((event: GPUUncapturedErrorEvent) => any) | null;
}


type GPUPowerPreference = "low-power" | "high-performance";

interface GPURequestAdapterOptions {
	powerPreference?: GPUPowerPreference;
}

interface GPUAdapter {
	readonly name: string;
	readonly extensions: ReadonlyArray<GPUExtensionName>;

	requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

interface GPU {
	requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter>;
}

interface Navigator {
	readonly gpu: GPU;
}
