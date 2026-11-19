/**
 * WebGPU gate scene (lazy chunk): the WebGL scene in scene.ts on WebGPU, same
 * passes, shaders ported to WGSL (./wgsl/), same public API. Chosen where the
 * browser has WebGPU (chunks.ts `loadScene`): WebGL on Windows compiles the
 * main shader through FXC for ~30 s, WebGPU in ~1.4 s.
 */
import type { SplashCanvas } from "./gl";
import {
	BUF_COPY_DST,
	BUF_INDEX,
	BUF_UNIFORM,
	BUF_VERTEX,
	type Gpu,
	type GpuBuffer,
	type GpuCanvasContext,
	type GpuDevice,
	type GpuHandle,
	type GpuPipeline,
	type GpuTexture,
	TEX_ATTACHMENT,
	TEX_BINDING,
} from "./gpu";
import {
	BEYOND,
	camera,
	clamp01,
	D0,
	EYE,
	GR,
	GRID_DA,
	GRID_IN,
	gridData,
	LEN,
	NN,
	OP,
	ROUGH,
	SETTLE,
	view,
} from "./scene-shared";
import { skyAt } from "./sky";
import ASSEMBLE from "./wgsl/assemble.wgsl" with { type: "text" };
import COMMON from "./wgsl/common.wgsl" with { type: "text" };
import EVOLVE from "./wgsl/evolve.wgsl" with { type: "text" };
import FFT from "./wgsl/fft.wgsl" with { type: "text" };
import INIT from "./wgsl/init.wgsl" with { type: "text" };
import MAIN from "./wgsl/main.wgsl" with { type: "text" };
import MIP from "./wgsl/mip.wgsl" with { type: "text" };
import OCEAN from "./wgsl/ocean.wgsl" with { type: "text" };

const F16 = "rgba16float";
const MIPS = Math.log2(NN) + 1;
/** Uniform buffer offset alignment (minUniformBufferOffsetAlignment default). */
const SLOT = 256;

interface Band {
	offset: number;
	count: number;
}

interface Pipelines {
	init: GpuPipeline;
	evolve: GpuPipeline;
	fft: GpuPipeline;
	assemble: GpuPipeline;
	mip: GpuPipeline;
	ocean: GpuPipeline;
	main: GpuPipeline;
}

/** One fullscreen-triangle render pass into `targets` (views). */
interface PassSpec {
	targets: GpuHandle[];
	pipeline: GpuPipeline;
	bind: GpuHandle;
}

export class GpuGateScene {
	#device: GpuDevice;
	#ctx: GpuCanvasContext;
	#canvas: SplashCanvas;
	#p: Pipelines;
	#vbo: GpuBuffer;
	#ibo: GpuBuffer;
	#bands: Band[];
	#uEvolve: GpuBuffer;
	#uOcean: GpuBuffer;
	#uMain: GpuBuffer;
	#evolveBind: GpuHandle;
	#evolveTargets: GpuHandle[];
	#fftPasses: PassSpec[] = [];
	#assemblePasses: PassSpec[] = [];
	#mipPasses: PassSpec[] = [];
	#oceanBind: GpuHandle;
	#gw = 0;
	#gh = 0;
	#gViews: GpuHandle[] = [];
	#gDepth: GpuHandle | null = null;
	#gTextures: GpuTexture[] = [];
	#mainBind: GpuHandle | null = null;
	#t0 = performance.now();
	#hour: number;
	/** Resolution multiplier on top of the 1.5 MP cap (app background frame-rate guard). */
	#scale = 1;
	#evolveData = new Float32Array(8);
	#oceanData = new Float32Array(16);
	#mainData = new Float32Array(36);

	private constructor(device: GpuDevice, ctx: GpuCanvasContext, canvas: SplashCanvas, p: Pipelines, hour: number) {
		this.#device = device;
		this.#ctx = ctx;
		this.#canvas = canvas;
		this.#p = p;
		this.#hour = hour;

		const grid = gridData();
		this.#vbo = this.#buffer(grid.gv.byteLength, BUF_VERTEX | BUF_COPY_DST);
		device.queue.writeBuffer(this.#vbo, 0, grid.gv);
		this.#ibo = this.#buffer(grid.idx.byteLength, BUF_INDEX | BUF_COPY_DST);
		device.queue.writeBuffer(this.#ibo, 0, grid.idx);
		this.#bands = grid.counts.map((count, band) => ({ offset: band * grid.bandRows * grid.NA * 8, count }));

		// sim targets: h0 fp32, IFFT ping-pong fp16 (bandwidth-bound), outputs fp16 mipmapped + anisotropic
		const h0 = this.#tex(NN, 4 * NN, "rgba32float", 1);
		const pp = [0, 1].map(() => [this.#tex(NN, 4 * NN, F16, 1), this.#tex(NN, 4 * NN, F16, 1)]);
		const ppViews = pp.map(t => t.map(x => x.createView()));
		const OD = LEN.map(() => this.#tex(NN, NN, F16, MIPS));
		const OS = LEN.map(() => this.#tex(NN, NN, F16, MIPS));

		// H0 spectrum, once
		const jp = (ws: number, fk: number) => {
			const f = fk * 1000;
			return [0.076 * ((GR * f) / (ws * ws)) ** -0.22, 22 * ((ws * f) / (GR * GR)) ** -0.33];
		};
		const rad = (d: number) => (d * Math.PI) / 180;
		const wnd = jp(OP.windSpeed, OP.fetchKm);
		const swl = jp(OP.swellWindSpeed, OP.swellFetchKm);
		const init = new ArrayBuffer(112);
		const initF = new Float32Array(init);
		initF.set([OP.waveScale, rad(OP.windDirection), OP.spreadBlend, OP.windSwell], 0);
		initF.set([OP.swellScale * OP.waveScale, rad(OP.swellDirection), 1, OP.swellSwell], 4);
		initF.set([wnd[0], wnd[1], OP.gamma, OP.shortWavesFade, swl[0], swl[1], OP.gamma, OP.shortWavesFade], 8);
		initF.set(LEN, 16);
		// cascade c owns [cut[c-1], cut[c]); each cut sits at 6 fundamentals of the next cascade
		initF.set([...LEN.slice(1).map(l => ((2 * Math.PI) / l) * 6), 0], 20);
		initF[24] = OP.capillaryFade;
		new Uint32Array(init)[25] = 1337;
		const uInit = this.#buffer(112, BUF_UNIFORM | BUF_COPY_DST);
		device.queue.writeBuffer(uInit, 0, initF);

		this.#uEvolve = this.#buffer(32, BUF_UNIFORM | BUF_COPY_DST);
		this.#evolveData.set(LEN, 0);
		this.#evolveBind = this.#bind(p.evolve, [{ buffer: this.#uEvolve }, h0.createView()]);
		this.#evolveTargets = ppViews[0];

		// 16 IFFT stages: (sub, vertical) per stage never change, so their uniforms and bind groups are built once
		const uFft = this.#buffer(16 * SLOT, BUF_UNIFORM | BUF_COPY_DST);
		const fftData = new Int32Array((16 * SLOT) / 4);
		let s = 0;
		for (let dir = 0; dir < 2; dir++) {
			for (let k = 1; k <= 8; k++) {
				const stage = dir * 8 + k - 1;
				fftData[(stage * SLOT) / 4] = 1 << k;
				fftData[(stage * SLOT) / 4 + 1] = dir;
				this.#fftPasses.push({
					targets: ppViews[s ^ 1],
					pipeline: p.fft,
					bind: this.#bind(p.fft, [{ buffer: uFft, offset: stage * SLOT, size: 8 }, ...ppViews[s]]),
				});
				s ^= 1;
			}
		}
		device.queue.writeBuffer(uFft, 0, fftData);

		const uAsm = this.#buffer(4 * SLOT, BUF_UNIFORM | BUF_COPY_DST);
		const asm = new ArrayBuffer(4 * SLOT);
		for (let c = 0; c < 4; c++) {
			new Int32Array(asm, c * SLOT, 1)[0] = c;
			new Float32Array(asm, c * SLOT + 4, 1)[0] = OP.choppiness;
			this.#assemblePasses.push({
				targets: [
					OD[c].createView({ baseMipLevel: 0, mipLevelCount: 1 }),
					OS[c].createView({ baseMipLevel: 0, mipLevelCount: 1 }),
				],
				pipeline: p.assemble,
				bind: this.#bind(p.assemble, [{ buffer: uAsm, offset: c * SLOT, size: 8 }, ...ppViews[s]]),
			});
		}
		device.queue.writeBuffer(uAsm, 0, new Uint8Array(asm));

		for (let c = 0; c < 4; c++) {
			for (let m = 1; m < MIPS; m++) {
				const level = (t: GpuTexture, l: number) => t.createView({ baseMipLevel: l, mipLevelCount: 1 });
				this.#mipPasses.push({
					targets: [level(OD[c], m), level(OS[c], m)],
					pipeline: p.mip,
					bind: this.#bind(p.mip, [level(OD[c], m - 1), level(OS[c], m - 1)]),
				});
			}
		}

		this.#uOcean = this.#buffer(64, BUF_UNIFORM | BUF_COPY_DST);
		this.#oceanData.set(LEN, 4);
		this.#oceanData[12] = GRID_IN;
		this.#oceanData[13] = OP.windSpeed;
		this.#oceanData[14] = OP.waveScale * ROUGH;
		const sampler = device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			magFilter: "linear",
			minFilter: "linear",
			mipmapFilter: "linear",
			maxAnisotropy: 16,
		});
		this.#oceanBind = this.#bind(p.ocean, [
			{ buffer: this.#uOcean },
			sampler,
			...[OD[0], OD[1], OD[2], OS[0], OS[1], OS[2], OS[3]].map(t => t.createView()),
		]);
		this.#uMain = this.#buffer(144, BUF_UNIFORM | BUF_COPY_DST);

		const enc = device.createCommandEncoder();
		const pass = enc.beginRenderPass({ colorAttachments: [this.#attach(h0.createView())] });
		pass.setPipeline(p.init);
		pass.setBindGroup(0, this.#bind(p.init, [{ buffer: uInit }]));
		pass.draw(3);
		pass.end();
		device.queue.submit([enc.finish()]);
	}

	/**
	 * Request adapter and device, then compile every pipeline off the main thread. Rejects
	 * before touching `canvas` when WebGPU, an adapter or a device is missing, so the caller
	 * can still give the same canvas to the WebGL scene.
	 */
	static async load(canvas: SplashCanvas, hour: number): Promise<GpuGateScene> {
		// WebGPU is outside the narrow navigator type (no DOM lib); presence is checked right below
		const nav = globalThis.navigator as { gpu?: Gpu };
		const gpu = nav.gpu;
		if (!gpu) throw new Error("WebGPU unavailable");
		const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
		if (!adapter) throw new Error("no WebGPU adapter");
		const device = await adapter.requestDevice();
		// SplashCanvas declares only the webgl2 overload; the webgpu one returns a GPUCanvasContext
		const gpuCanvas = canvas as unknown as { getContext(kind: "webgpu"): GpuCanvasContext | null };
		const ctx = gpuCanvas.getContext("webgpu");
		if (!ctx) {
			device.destroy();
			throw new Error("WebGPU canvas context unavailable");
		}
		const format = gpu.getPreferredCanvasFormat();
		ctx.configure({ device, format, alphaMode: "opaque" });
		try {
			const sim = (code: string) => device.createShaderModule({ code: COMMON + code });
			const pair = { format: F16 };
			const quad = (module: GpuHandle, targets: object[], extra: object = {}) =>
				device.createRenderPipelineAsync({
					layout: "auto",
					vertex: { module, entryPoint: "vs" },
					fragment: { module, entryPoint: "fs", targets },
					primitive: { topology: "triangle-list" },
					...extra,
				});
			const oceanModule = device.createShaderModule({ code: OCEAN });
			const [init, evolve, fft, assemble, mip, ocean, main] = await Promise.all([
				quad(sim(INIT), [{ format: "rgba32float" }]),
				quad(sim(EVOLVE), [pair, pair]),
				quad(sim(FFT), [pair, pair]),
				quad(sim(ASSEMBLE), [pair, pair]),
				quad(device.createShaderModule({ code: MIP }), [pair, pair]),
				device.createRenderPipelineAsync({
					layout: "auto",
					vertex: {
						module: oceanModule,
						entryPoint: "vs",
						buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }],
					},
					fragment: { module: oceanModule, entryPoint: "fs", targets: [pair, pair] },
					primitive: { topology: "triangle-list" },
					depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
				}),
				quad(device.createShaderModule({ code: MAIN }), [{ format }]),
			]);
			const scene = new GpuGateScene(device, ctx, canvas, { init, evolve, fft, assemble, mip, ocean, main }, hour);
			// draw the all-branches frame once and wait for the GPU, as the WebGL scene does with its fence
			scene.#draw(performance.now(), 1, 1, 1);
			await device.queue.onSubmittedWorkDone();
			return scene;
		} catch (err) {
			device.destroy();
			throw err;
		}
	}

	/** Calls `cb` when the device is lost for any reason other than {@link destroy}. */
	onLost(cb: () => void): void {
		void this.#device.lost.then(info => {
			if (info.reason !== "destroyed") cb();
		});
	}

	/** Time of day for the following frames (local hours, 0..24). */
	setHour(hour: number): void {
		this.#hour = hour;
	}

	/** Render at `scale` x the capped resolution from the next frame on (1 = full). */
	setScale(scale: number): void {
		this.#scale = scale;
	}

	/** Draw the start frame (gate at 60 m): the splash's first frame. */
	start(now: number): void {
		this.#draw(now, D0, 0, 0);
	}

	/** App background frame: open water, camera far enough past the gate that the gate and every rock are behind it. */
	beyond(now: number): void {
		this.#draw(now, -BEYOND, 0, 0);
	}

	/** One frame at dolly progress `t` (0..1); see GateScene.frame. Returns whether the camera is past the gate plane. */
	frame(now: number, t: number): boolean {
		const dist = D0 - (D0 + BEYOND) * t;
		if (dist > 0) {
			const z = D0 / Math.max(dist, 0.01);
			this.#draw(now, dist, clamp01((z - 1) / 24), clamp01((z - 25) / 20));
		} else {
			const s = clamp01(1 + dist / SETTLE);
			this.#draw(now, dist, s, s);
		}
		return dist <= 0;
	}

	/** Release the GPU memory right away instead of at GC. */
	destroy(): void {
		this.#device.destroy();
		this.#canvas.width = 1;
		this.#canvas.height = 1;
	}

	#buffer(size: number, usage: number): GpuBuffer {
		return this.#device.createBuffer({ size, usage });
	}

	#tex(w: number, h: number, format: string, mipLevelCount: number): GpuTexture {
		return this.#device.createTexture({ size: [w, h], format, usage: TEX_ATTACHMENT | TEX_BINDING, mipLevelCount });
	}

	#bind(p: GpuPipeline, resources: object[]): GpuHandle {
		return this.#device.createBindGroup({
			layout: p.getBindGroupLayout(0),
			entries: resources.map((resource, binding) => ({ binding, resource })),
		});
	}

	#attach(view: GpuHandle): object {
		return { view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] };
	}

	/** Ocean G-buffer at the canvas resolution, depth-tested; rebuilt (with the main bind group) on resize. */
	#gbuf(w: number, h: number): void {
		if (this.#mainBind && this.#gw === w && this.#gh === h) return;
		for (const t of this.#gTextures) t.destroy();
		this.#gw = w;
		this.#gh = h;
		const usage = TEX_ATTACHMENT | TEX_BINDING;
		const gA = this.#device.createTexture({ size: [w, h], format: F16, usage });
		const gB = this.#device.createTexture({ size: [w, h], format: F16, usage });
		const gD = this.#device.createTexture({ size: [w, h], format: "depth24plus", usage: TEX_ATTACHMENT });
		this.#gTextures = [gA, gB, gD];
		this.#gViews = [gA.createView(), gB.createView()];
		this.#gDepth = gD.createView();
		this.#mainBind = this.#bind(this.#p.main, [{ buffer: this.#uMain }, ...this.#gViews]);
	}

	#draw(now: number, dist: number, pa: number, pc: number): void {
		const device = this.#device;
		const w = view.innerWidth;
		const h = view.innerHeight;
		const c = camera(w, h);
		const t = (now - this.#t0) / 1000;
		let dpr = Math.min(view.devicePixelRatio || 1, 2);
		if (w * h * dpr * dpr > 1.5e6) dpr = Math.sqrt(1.5e6 / (w * h));
		dpr *= this.#scale;
		const bw = Math.round(w * dpr);
		const bh = Math.round(h * dpr);
		if (this.#canvas.width !== bw || this.#canvas.height !== bh) {
			this.#canvas.width = bw;
			this.#canvas.height = bh;
		}
		this.#gbuf(bw, bh);

		this.#evolveData[4] = t; // wrapped to the sim loop in evolve.wgsl
		device.queue.writeBuffer(this.#uEvolve, 0, this.#evolveData);
		const o = this.#oceanData;
		o.set([(2 * c.f) / w, (2 * c.f) / h, 1 - (2 * c.L) / h, GRID_DA], 0);
		o.set([0, EYE, -dist, t], 8);
		device.queue.writeBuffer(this.#uOcean, 0, o);
		const m = this.#mainData;
		const k = skyAt(this.#hour, w, h);
		m.set(k.ZC, 0);
		m.set(k.HC, 4);
		m.set(k.SC, 8);
		m.set(k.KD, 12);
		m.set(k.KC, 16);
		m.set(k.PT, 20);
		m[3] = t;
		m[7] = c.L;
		m[11] = bw / w;
		m[15] = c.f;
		m[19] = -dist;
		m[23] = k.MZ[0];
		m.set(k.SP, 24);
		m.set(k.MP, 28);
		m.set([w, h, pa, pc], 32);
		device.queue.writeBuffer(this.#uMain, 0, m);

		// 1 evolve + 16 IFFT stages + 4 assemble passes, 8 mip chains, ocean G-buffer, main pass
		const enc = device.createCommandEncoder();
		const quad = (s: PassSpec) => {
			const pass = enc.beginRenderPass({ colorAttachments: s.targets.map(v => this.#attach(v)) });
			pass.setPipeline(s.pipeline);
			pass.setBindGroup(0, s.bind);
			pass.draw(3);
			pass.end();
		};
		quad({ targets: this.#evolveTargets, pipeline: this.#p.evolve, bind: this.#evolveBind });
		for (const s of this.#fftPasses) quad(s);
		for (const s of this.#assemblePasses) quad(s);
		for (const s of this.#mipPasses) quad(s);
		const ocean = enc.beginRenderPass({
			colorAttachments: this.#gViews.map(v => this.#attach(v)),
			depthStencilAttachment: {
				view: this.#gDepth,
				depthClearValue: 1,
				depthLoadOp: "clear",
				depthStoreOp: "discard",
			},
		});
		ocean.setPipeline(this.#p.ocean);
		ocean.setBindGroup(0, this.#oceanBind);
		ocean.setIndexBuffer(this.#ibo, "uint16");
		for (const band of this.#bands) {
			ocean.setVertexBuffer(0, this.#vbo, band.offset);
			ocean.drawIndexed(band.count);
		}
		ocean.end();
		quad({
			targets: [this.#ctx.getCurrentTexture().createView()],
			pipeline: this.#p.main,
			bind: this.#mainBind as GpuHandle,
		});
		device.queue.submit([enc.finish()]);
	}
}
