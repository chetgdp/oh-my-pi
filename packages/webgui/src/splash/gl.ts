/**
 * Narrow WebGL2 surface used by the splash scene. webgui type-checks without
 * the DOM lib (see src/lib/dom.ts), so the members used are declared here.
 */

/** Opaque WebGL object handle (texture, buffer, program, ...). */
export type GLHandle = object;
export type GLLocation = object | null;

export interface GL2 {
	readonly FRAMEBUFFER: number;
	readonly RENDERBUFFER: number;
	readonly TEXTURE_2D: number;
	readonly TEXTURE0: number;
	readonly TEXTURE_MIN_FILTER: number;
	readonly TEXTURE_MAG_FILTER: number;
	readonly TEXTURE_WRAP_S: number;
	readonly TEXTURE_WRAP_T: number;
	readonly LINEAR: number;
	readonly NEAREST: number;
	readonly LINEAR_MIPMAP_LINEAR: number;
	readonly REPEAT: number;
	readonly CLAMP_TO_EDGE: number;
	readonly COLOR_ATTACHMENT0: number;
	readonly DEPTH_ATTACHMENT: number;
	readonly DEPTH_COMPONENT24: number;
	readonly ARRAY_BUFFER: number;
	readonly ELEMENT_ARRAY_BUFFER: number;
	readonly STATIC_DRAW: number;
	readonly FLOAT: number;
	readonly UNSIGNED_SHORT: number;
	readonly SYNC_GPU_COMMANDS_COMPLETE: number;
	readonly TIMEOUT_EXPIRED: number;
	readonly RGBA16F: number;
	readonly RGBA32F: number;
	readonly VERTEX_SHADER: number;
	readonly FRAGMENT_SHADER: number;
	readonly COMPILE_STATUS: number;
	readonly LINK_STATUS: number;
	readonly TRIANGLES: number;
	readonly COLOR_BUFFER_BIT: number;
	readonly DEPTH_BUFFER_BIT: number;
	readonly DEPTH_TEST: number;

	getExtension(name: string): Record<string, unknown> | null;
	getParameter(pname: number): unknown;
	isContextLost(): boolean;

	createShader(type: number): GLHandle;
	shaderSource(shader: GLHandle, src: string): void;
	compileShader(shader: GLHandle): void;
	getShaderParameter(shader: GLHandle, pname: number): unknown;
	getShaderInfoLog(shader: GLHandle): string | null;
	deleteShader(shader: GLHandle): void;
	createProgram(): GLHandle;
	attachShader(program: GLHandle, shader: GLHandle): void;
	bindAttribLocation(program: GLHandle, index: number, name: string): void;
	linkProgram(program: GLHandle): void;
	getProgramParameter(program: GLHandle, pname: number): unknown;
	getProgramInfoLog(program: GLHandle): string | null;
	getUniformLocation(program: GLHandle, name: string): GLLocation;
	useProgram(program: GLHandle): void;

	createTexture(): GLHandle;
	bindTexture(target: number, tex: GLHandle | null): void;
	texStorage2D(target: number, levels: number, fmt: number, w: number, h: number): void;
	texParameteri(target: number, pname: number, v: number): void;
	texParameterf(target: number, pname: number, v: number): void;
	generateMipmap(target: number): void;
	activeTexture(unit: number): void;
	deleteTexture(tex: GLHandle): void;

	createFramebuffer(): GLHandle;
	bindFramebuffer(target: number, fb: GLHandle | null): void;
	framebufferTexture2D(target: number, attach: number, texTarget: number, tex: GLHandle, level: number): void;
	framebufferRenderbuffer(target: number, attach: number, rbTarget: number, rb: GLHandle): void;
	drawBuffers(bufs: number[]): void;
	deleteFramebuffer(fb: GLHandle): void;
	createRenderbuffer(): GLHandle;
	bindRenderbuffer(target: number, rb: GLHandle): void;
	renderbufferStorage(target: number, fmt: number, w: number, h: number): void;
	deleteRenderbuffer(rb: GLHandle): void;

	createVertexArray(): GLHandle;
	bindVertexArray(vao: GLHandle | null): void;
	createBuffer(): GLHandle;
	bindBuffer(target: number, buf: GLHandle): void;
	bufferData(target: number, data: ArrayBufferView, usage: number): void;
	enableVertexAttribArray(index: number): void;
	vertexAttribPointer(index: number, size: number, type: number, norm: boolean, stride: number, offset: number): void;

	viewport(x: number, y: number, w: number, h: number): void;
	clearColor(r: number, g: number, b: number, a: number): void;
	clear(mask: number): void;
	enable(cap: number): void;
	disable(cap: number): void;
	drawArrays(mode: number, first: number, count: number): void;
	drawElements(mode: number, count: number, type: number, offset: number): void;
	flush(): void;
	fenceSync(condition: number, flags: number): GLHandle | null;
	clientWaitSync(sync: GLHandle, flags: number, timeout: number): number;
	deleteSync(sync: GLHandle): void;

	uniform1i(loc: GLLocation, v: number): void;
	uniform1ui(loc: GLLocation, v: number): void;
	uniform1f(loc: GLLocation, v: number): void;
	uniform2f(loc: GLLocation, a: number, b: number): void;
	uniform3f(loc: GLLocation, a: number, b: number, c: number): void;
	uniform4f(loc: GLLocation, a: number, b: number, c: number, d: number): void;
	uniform1fv(loc: GLLocation, v: number[]): void;
	uniform3fv(loc: GLLocation, v: number[]): void;
	uniform4fv(loc: GLLocation, v: number[]): void;
}

export interface SplashCanvas {
	width: number;
	height: number;
	getContext(kind: "webgl2", opts: { antialias: boolean; alpha: boolean }): GL2 | null;
}
