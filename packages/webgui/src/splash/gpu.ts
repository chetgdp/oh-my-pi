/**
 * Narrow WebGPU surface used by the splash (scene-gpu.ts, gpu-bench.ts).
 * webgui type-checks without the DOM lib (see src/lib/dom.ts), so the
 * members used are declared here; descriptors are passed through untyped.
 */

/** Opaque WebGPU objects (views, samplers, bind groups, layouts, command buffers). */
export type GpuHandle = object;

export interface GpuCompilationMessage {
	type: "error" | "warning" | "info";
	message: string;
	lineNum: number;
}
export interface GpuShaderModule {
	getCompilationInfo(): Promise<{ messages: GpuCompilationMessage[] }>;
}
export interface GpuTexture {
	createView(d?: { baseMipLevel?: number; mipLevelCount?: number }): GpuHandle;
	destroy(): void;
}
export interface GpuBuffer {
	destroy(): void;
}
export interface GpuPipeline {
	getBindGroupLayout(i: number): GpuHandle;
}
export interface GpuPass {
	setPipeline(p: GpuPipeline): void;
	setBindGroup(i: number, g: GpuHandle, dynamicOffsets?: number[]): void;
	setVertexBuffer(slot: number, b: GpuBuffer, offset?: number): void;
	setIndexBuffer(b: GpuBuffer, format: "uint16" | "uint32"): void;
	draw(n: number): void;
	drawIndexed(n: number): void;
	end(): void;
}
export interface GpuDeviceLostInfo {
	reason: "destroyed" | "unknown";
	message: string;
}
export interface GpuDevice {
	createShaderModule(d: { code: string }): GpuShaderModule;
	createRenderPipelineAsync(d: object): Promise<GpuPipeline>;
	createTexture(d: { size: [number, number]; format: string; usage: number; mipLevelCount?: number }): GpuTexture;
	createBuffer(d: { size: number; usage: number }): GpuBuffer;
	createBindGroup(d: object): GpuHandle;
	createSampler(d: object): GpuHandle;
	createCommandEncoder(): {
		beginRenderPass(d: object): GpuPass;
		finish(): GpuHandle;
	};
	queue: {
		submit(c: GpuHandle[]): void;
		writeBuffer(b: GpuBuffer, o: number, d: ArrayBufferView): void;
		onSubmittedWorkDone(): Promise<void>;
	};
	readonly lost: Promise<GpuDeviceLostInfo>;
	destroy(): void;
}
export interface GpuAdapter {
	info?: Record<string, unknown>;
	features: Set<string>;
	isFallbackAdapter?: boolean;
	requestDevice(): Promise<GpuDevice>;
}
export interface Gpu {
	requestAdapter(o?: { powerPreference?: string }): Promise<GpuAdapter | null>;
	getPreferredCanvasFormat(): string;
}
export interface GpuCanvasContext {
	configure(d: { device: GpuDevice; format: string; alphaMode: "opaque" | "premultiplied" }): void;
	getCurrentTexture(): GpuTexture;
}

// GPUTextureUsage / GPUBufferUsage bits
export const TEX_BINDING = 0x04;
export const TEX_ATTACHMENT = 0x10;
export const BUF_VERTEX = 0x20;
export const BUF_INDEX = 0x10;
export const BUF_UNIFORM = 0x40;
export const BUF_COPY_DST = 0x08;
