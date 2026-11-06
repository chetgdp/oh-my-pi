/**
 * WebGL2 gate scene for the cold-start splash (lazy chunk): GPU Tessendorf FFT
 * ocean (ported from Ultra-Water, MIT; notice in ./shaders), raymarched gate
 * and rocks, time-of-day sky and the portal crossing. Ported from
 * research/splash/h-water-full-glass.html with every default unchanged.
 */
import type { GL2, GLHandle, GLLocation, SplashCanvas } from "./gl";
import { ASSEMBLE, EVOLVE, EYE, FFT, FS, INIT, OF, OV, QV } from "./shaders";
import { HORIZON, skyAt, type SkyLight } from "./sky";

/** Inline style surface of the app root revealed through the gate. */
export interface AppStyle {
	clipPath: string;
	opacity: string;
	transform: string;
	filter: string;
	setProperty(name: string, value: string): void;
}

/** Cascade sizes (m) of the 4 FFT cascades in one 256x1024 atlas; the last is the capillary band. */
const NN = 256;
const LEN = [600, 85, 12, 2.1];
const GR = 9.81;
/** KHR_parallel_shader_compile COMPLETION_STATUS_KHR. */
const COMPLETION_STATUS = 0x91b1;
/** Compile completion poll interval (ms); a frame (16.7 ms) would add up to a frame of latency. */
const POLL_MS = 4;

// Sea state "glass", Hs ~.015 m: .01 m cat's-paws (1 m/s over 3 km) plus a .02 m, 210 m swell.
const OP = {
	windSpeed: 1,
	windDirection: -105,
	fetchKm: 3,
	spreadBlend: 0.85,
	windSwell: 0.25,
	gamma: 3.3,
	shortWavesFade: 0.04,
	capillaryFade: 0.08,
	waveScale: 0.04,
	swellScale: 0.0002,
	swellWindSpeed: 8,
	swellDirection: -80,
	swellFetchKm: 900,
	swellSwell: 1,
	choppiness: 0.85,
};

// Scene constants (the prototype's panel defaults).
const D0 = 60;
const CAP_W = 0.16;
const CAP_H = 0.1;
const OVERSHOOT = 6;
const ROUGH = 1;

function camera(w: number, h: number): { f: number; L: number } {
	return { f: Math.min((CAP_W * w) / 15, (CAP_H * h) / 16) * D0, L: h * HORIZON };
}

const view = globalThis as unknown as { innerWidth: number; innerHeight: number; devicePixelRatio: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Polar ocean grid: inner radius (m) and angular step of the camera-centred rings. */
const GRID_IN = Math.max(1, EYE / 2);
const GRID_DA = (2 * Math.PI) / 432;

/** Ring bands of the grid: each draws `count` indices of one shared 16-bit index buffer. */
interface GridBand {
	vao: GLHandle;
	count: number;
}

/**
 * Camera-centred polar ocean grid: rings grow geometrically (square cells), sector +-80 deg.
 * The 113k vertices exceed 16-bit indices, so the rings are split into bands whose
 * vertex pointers start at the band's first ring and share one band-local index pattern
 * (0.67 MB instead of a 2.7 MB 32-bit buffer); bands draw in ring order, so the
 * triangles and their order are unchanged.
 */
function buildGrid(gl: GL2): GridBand[] {
	const NA = Math.ceil(2.8 / GRID_DA) + 1;
	const radii: number[] = [];
	for (let r = GRID_IN / 16; r < GRID_IN * 0.99; r *= 1.12) radii.push(r);
	for (let r = GRID_IN; r < 3000 * GRID_IN; r *= 1 + GRID_DA) radii.push(r);
	radii.push(60000);
	const gv = new Float32Array(radii.length * NA * 2);
	let gi = 0;
	for (const r of radii) {
		for (let j = 0; j < NA; j++) {
			const t = Math.PI / 2 - 1.4 + j * GRID_DA;
			gv[gi++] = Math.cos(t) * r;
			gv[gi++] = Math.sin(t) * r;
		}
	}
	const rows = radii.length - 1;
	const bands = Math.ceil(rows / Math.floor(0x10000 / NA - 1));
	const bandRows = Math.ceil(rows / bands);
	const idx = new Uint16Array(bandRows * (NA - 1) * 6);
	gi = 0;
	for (let k = 0; k < bandRows; k++) {
		for (let j = 0; j < NA - 1; j++) {
			const a = k * NA + j;
			const b = a + NA;
			idx[gi++] = a;
			idx[gi++] = a + 1;
			idx[gi++] = b;
			idx[gi++] = a + 1;
			idx[gi++] = b + 1;
			idx[gi++] = b;
		}
	}
	const vbo = gl.createBuffer();
	const ibo = gl.createBuffer();
	const out: GridBand[] = [];
	for (let band = 0; band < bands; band++) {
		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		if (band === 0) gl.bufferData(gl.ARRAY_BUFFER, gv, gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, band * bandRows * NA * 8);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
		if (band === 0) gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
		out.push({ vao, count: Math.min(bandRows, rows - band * bandRows) * (NA - 1) * 6 });
	}
	gl.bindVertexArray(null);
	return out;
}

interface Program {
	p: GLHandle;
	U(name: string): GLLocation;
}

export class GateScene {
	#gl: GL2;
	#canvas: SplashCanvas;
	#aniso: Record<string, unknown> | null;
	#vq: GLHandle;
	#grid: GridBand[];
	#pE: Program;
	#pF: Program;
	#pA: Program;
	#pO: Program;
	#pM: Program;
	#h0: GLHandle;
	#pp: { t: GLHandle[]; f: GLHandle }[];
	#OD: GLHandle[];
	#OS: GLHandle[];
	#fo: GLHandle[];
	#gw = 0;
	#gh = 0;
	#gA: GLHandle | null = null;
	#gB: GLHandle | null = null;
	#gD: GLHandle | null = null;
	#gF: GLHandle | null = null;
	#t0 = performance.now();
	#hour: number;
	#sky: Record<keyof SkyLight, GLLocation>;
	#u: Record<string, GLLocation>;

	/** Takes linked programs from {@link loadScene}; builds sim targets, grid and the H0 spectrum. */
	private constructor(gl: GL2, canvas: SplashCanvas, progs: Program[], grid: GridBand[], hour: number) {
		this.#gl = gl;
		this.#canvas = canvas;
		this.#hour = hour;
		this.#aniso = gl.getExtension("EXT_texture_filter_anisotropic");
		const [pI, pE, pF, pA, pO, pM] = progs;
		this.#pE = pE;
		this.#pF = pF;
		this.#pA = pA;
		this.#pO = pO;
		this.#pM = pM;

		// fullscreen triangle
		this.#vq = gl.createVertexArray();
		gl.bindVertexArray(this.#vq);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		this.#grid = grid;

		// sim targets: h0 fp32, IFFT ping-pong fp16 (bandwidth-bound), outputs fp16 mipmapped + anisotropic
		this.#h0 = this.#tex(NN, 4 * NN, gl.RGBA32F, false);
		const fh0 = this.#fbo([this.#h0], null);
		this.#pp = [0, 1].map(() => {
			const t = [this.#tex(NN, 4 * NN, gl.RGBA16F, false), this.#tex(NN, 4 * NN, gl.RGBA16F, false)];
			return { t, f: this.#fbo(t, null) };
		});
		this.#OD = LEN.map(() => this.#tex(NN, NN, gl.RGBA16F, true));
		this.#OS = LEN.map(() => this.#tex(NN, NN, gl.RGBA16F, true));
		this.#fo = LEN.map((_, c) => this.#fbo([this.#OD[c], this.#OS[c]], null));

		// H0 spectrum, once
		const jp = (ws: number, fk: number) => {
			const f = fk * 1000;
			return [0.076 * ((GR * f) / (ws * ws)) ** -0.22, 22 * ((ws * f) / (GR * GR)) ** -0.33];
		};
		const rad = (d: number) => (d * Math.PI) / 180;
		const wnd = jp(OP.windSpeed, OP.fetchKm);
		const swl = jp(OP.swellWindSpeed, OP.swellFetchKm);
		gl.useProgram(pI.p);
		gl.uniform4fv(pI.U("uSpecA"), [
			OP.waveScale,
			rad(OP.windDirection),
			OP.spreadBlend,
			OP.windSwell,
			OP.swellScale * OP.waveScale,
			rad(OP.swellDirection),
			1,
			OP.swellSwell,
		]);
		gl.uniform4fv(pI.U("uSpecB"), [
			wnd[0],
			wnd[1],
			OP.gamma,
			OP.shortWavesFade,
			swl[0],
			swl[1],
			OP.gamma,
			OP.shortWavesFade,
		]);
		gl.uniform4fv(pI.U("uLength"), LEN);
		// cascade c owns [cut[c-1], cut[c]); each cut sits at 6 fundamentals of the next cascade
		gl.uniform4fv(pI.U("uCut"), [...LEN.slice(1).map(l => ((2 * Math.PI) / l) * 6), 0]);
		gl.uniform1f(pI.U("uCapFade"), OP.capillaryFade);
		gl.uniform1ui(pI.U("uSeed"), 1337);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fh0);
		gl.viewport(0, 0, NN, 4 * NN);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		gl.useProgram(pE.p);
		gl.uniform1i(pE.U("uH0"), 0);
		gl.uniform4fv(pE.U("uLength"), LEN);
		gl.useProgram(pF.p);
		gl.uniform1i(pF.U("uIn0"), 0);
		gl.uniform1i(pF.U("uIn1"), 1);
		gl.useProgram(pA.p);
		gl.uniform1i(pA.U("uIn0"), 0);
		gl.uniform1i(pA.U("uIn1"), 1);
		gl.uniform1f(pA.U("uLambda"), OP.choppiness);
		gl.useProgram(pO.p);
		["uD0", "uD1", "uD2", "uS0", "uS1", "uS2", "uS3"].forEach((n, i) => gl.uniform1i(pO.U(n), i));
		gl.uniform4fv(pO.U("uLen"), LEN);
		gl.uniform1f(pO.U("uIn"), GRID_IN);
		gl.uniform1f(pO.U("uWind"), OP.windSpeed);
		gl.uniform1f(pO.U("uRS"), OP.waveScale * ROUGH);

		// main pass: G-buffer samplers
		gl.useProgram(pM.p);
		gl.uniform1i(pM.U("G0"), 0);
		gl.uniform1i(pM.U("G1"), 1);
		this.#sky = {
			ZC: pM.U("ZC"),
			HC: pM.U("HC"),
			SC: pM.U("SC"),
			KD: pM.U("KD"),
			KC: pM.U("KC"),
			PT: pM.U("PT"),
			SP: pM.U("SP"),
			MP: pM.U("MP"),
			MZ: pM.U("MZ"),
		};
		this.#u = {
			time: pE.U("uTime"),
			sub: pF.U("uSub"),
			vert: pF.U("uVertical"),
			casc: pA.U("uCascade"),
			oCam: pO.U("uCam"),
			oPr: pO.U("uPr"),
			oT: pO.U("uT"),
			P: pM.U("P"),
			R: pM.U("R"),
			T: pM.U("T"),
			L: pM.U("L"),
			D: pM.U("D"),
			F: pM.U("F"),
			CZ: pM.U("CZ"),
		};
	}

	/**
	 * Compile and link every program on `canvas` without blocking the main
	 * thread where KHR_parallel_shader_compile exists. Rejects when WebGL2 or
	 * EXT_color_buffer_float is missing or a program fails to link.
	 */
	static async load(canvas: SplashCanvas, hour: number): Promise<GateScene> {
		const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
		if (!gl) throw new Error("WebGL2 unavailable");
		if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("EXT_color_buffer_float unavailable");
		const parallel = gl.getExtension("KHR_parallel_shader_compile") !== null;
		const pending = [
			[QV, INIT],
			[QV, EVOLVE],
			[QV, FFT],
			[QV, ASSEMBLE],
			[OV, OF],
			[QV, FS],
		].map(([vs, fs]) => {
			const p = gl.createProgram();
			const shaders = [
				[gl.VERTEX_SHADER, vs],
				[gl.FRAGMENT_SHADER, fs],
			] as const;
			const objs = shaders.map(([type, src]) => {
				const s = gl.createShader(type);
				gl.shaderSource(s, src);
				gl.compileShader(s);
				gl.attachShader(p, s);
				return s;
			});
			gl.bindAttribLocation(p, 0, "a");
			gl.linkProgram(p);
			return { p, objs };
		});
		const tick = async () => {
			const { promise, resolve } = Promise.withResolvers<void>();
			setTimeout(resolve, POLL_MS);
			await promise;
			if (gl.isContextLost()) throw new Error("WebGL context lost");
		};
		// the grid is built while the driver compiles
		const grid = buildGrid(gl);
		if (parallel) {
			while (!pending.every(({ p }) => gl.getProgramParameter(p, COMPLETION_STATUS) === true)) await tick();
		}
		const progs = pending.map(({ p, objs }) => {
			if (gl.getProgramParameter(p, gl.LINK_STATUS) !== true) {
				const log = objs.map(s => gl.getShaderInfoLog(s) ?? "").join("\n");
				throw new Error(`splash program link failed: ${gl.getProgramInfoLog(p) ?? ""}\n${log}`);
			}
			for (const s of objs) gl.deleteShader(s);
			return { p, U: (name: string) => gl.getUniformLocation(p, name) };
		});
		const scene = new GateScene(gl, canvas, progs, grid, hour);
		// The first draw of each branch (membrane, radial blur, flash) compiles the GPU pipelines, ~2 s
		// on a cold Metal shader cache: draw them once and wait on a fence, so the zoom does not stall
		// and the main thread stays free meanwhile (a readPixels here blocked it for the whole compile)
		scene.#draw(performance.now(), 1, 1, 1, 1);
		const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
		if (sync) {
			gl.flush();
			while (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) await tick();
			gl.deleteSync(sync);
		}
		return scene;
	}

	/** Draw the start frame; call in the task that shows the canvas. */
	start(now: number): void {
		this.#draw(now, D0, 0, 0, 0);
	}

	/**
	 * One frame at dolly progress `t` (0..1): draws the scene and clips the app
	 * root to the projected opening; stops drawing once the app covers the canvas.
	 */
	frame(now: number, t: number, app: AppStyle): void {
		const dist = D0 * (1 - (1 + OVERSHOOT / D0) * t);
		const w = view.innerWidth;
		const h = view.innerHeight;
		const { f, L } = camera(w, h);
		// app: clipped to the projected opening, appears as the camera crosses the gate plane (dist 0)
		if (dist > 0.05) {
			const k = f / dist;
			const x = w / 2 - 1.2 * k;
			const y = L - (12.8 - EYE) * k;
			const b = L + EYE * k;
			const px = (v: number) => `${Math.max(0, v).toFixed(1)}px`;
			app.clipPath = `inset(${px(y)} ${px(x)} ${px(h - b)} ${px(x)})`;
		} else app.clipPath = "none";
		const st = clamp01(1 + dist / 6); // blur/scale settle over the last 6 m
		app.opacity = String(clamp01(-dist / 0.5));
		app.transform = `scale(${1 + st * 0.04})`;
		app.filter = `blur(${st * 4}px)`;
		app.setProperty("--splash-veil", String(clamp01(1 + (dist + 0.5) / 3.5))); // veil lifts over dist -0.5..-4
		// canvas is covered once the app is opaque
		if (dist > -0.5) {
			const z = D0 / Math.max(dist, 0.01); // apparent scale of the opening vs the start frame
			this.#draw(
				now,
				dist,
				clamp01((z - 1) / 24),
				clamp01((z - 25) / 20),
				Math.exp(-(((dist - 0.3) / (dist > 0.3 ? 1.4 : 0.8)) ** 2)),
			);
		}
	}

	/** Release the GPU memory (~45 MB at phone size) right away instead of at GC. */
	destroy(): void {
		const lose = this.#gl.getExtension("WEBGL_lose_context") as { loseContext(): void } | null;
		lose?.loseContext();
		this.#canvas.width = 1;
		this.#canvas.height = 1;
	}

	#tex(w: number, h: number, fmt: number, mip: boolean): GLHandle {
		const gl = this.#gl;
		const T2 = gl.TEXTURE_2D;
		const t = gl.createTexture();
		gl.bindTexture(T2, t);
		gl.texStorage2D(T2, mip ? Math.log2(w) + 1 : 1, fmt, w, h);
		const f = mip ? gl.LINEAR : gl.NEAREST;
		const wr = mip ? gl.REPEAT : gl.CLAMP_TO_EDGE;
		gl.texParameteri(T2, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : f);
		gl.texParameteri(T2, gl.TEXTURE_MAG_FILTER, f);
		gl.texParameteri(T2, gl.TEXTURE_WRAP_S, wr);
		gl.texParameteri(T2, gl.TEXTURE_WRAP_T, wr);
		const aniso = this.#aniso;
		if (mip && aniso) {
			gl.texParameterf(
				T2,
				aniso.TEXTURE_MAX_ANISOTROPY_EXT as number,
				gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT as number) as number,
			);
		}
		return t;
	}

	#fbo(ts: GLHandle[], depth: GLHandle | null): GLHandle {
		const gl = this.#gl;
		const f = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, f);
		ts.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
		if (depth) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
		gl.drawBuffers(ts.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
		return f;
	}

	#bind(ts: GLHandle[]): void {
		const gl = this.#gl;
		ts.forEach((t, i) => {
			gl.activeTexture(gl.TEXTURE0 + i);
			gl.bindTexture(gl.TEXTURE_2D, t);
		});
	}

	/** 1 evolve + 16 IFFT stages + 4 assemble draws, 8 mip chains. */
	#sim(t: number): void {
		const gl = this.#gl;
		const u = this.#u;
		gl.bindVertexArray(this.#vq);
		gl.viewport(0, 0, NN, 4 * NN);
		gl.useProgram(this.#pE.p);
		gl.uniform1f(u.time, t); // wrapped to the sim loop in evolve.frag
		this.#bind([this.#h0]);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.#pp[0].f);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.useProgram(this.#pF.p);
		let s = 0;
		for (let dir = 0; dir < 2; dir++) {
			gl.uniform1i(u.vert, dir);
			for (let k = 1; k <= 8; k++) {
				gl.uniform1i(u.sub, 1 << k);
				this.#bind(this.#pp[s].t);
				gl.bindFramebuffer(gl.FRAMEBUFFER, this.#pp[s ^ 1].f);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
				s ^= 1;
			}
		}
		gl.useProgram(this.#pA.p);
		this.#bind(this.#pp[s].t);
		gl.viewport(0, 0, NN, NN);
		for (let c = 0; c < 4; c++) {
			gl.uniform1i(u.casc, c);
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.#fo[c]);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
		for (let c = 0; c < 4; c++) {
			gl.bindTexture(gl.TEXTURE_2D, this.#OD[c]);
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.bindTexture(gl.TEXTURE_2D, this.#OS[c]);
			gl.generateMipmap(gl.TEXTURE_2D);
		}
	}

	/** Ocean G-buffer at the canvas resolution, depth-tested. */
	#gbuf(w: number, h: number): GLHandle {
		const gl = this.#gl;
		if (this.#gF && this.#gw === w && this.#gh === h) return this.#gF;
		if (this.#gF && this.#gA && this.#gB && this.#gD) {
			gl.deleteTexture(this.#gA);
			gl.deleteTexture(this.#gB);
			gl.deleteRenderbuffer(this.#gD);
			gl.deleteFramebuffer(this.#gF);
		}
		this.#gw = w;
		this.#gh = h;
		const gA = this.#tex(w, h, gl.RGBA16F, false);
		const gB = this.#tex(w, h, gl.RGBA16F, false);
		const gD = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, gD);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
		this.#gA = gA;
		this.#gB = gB;
		this.#gD = gD;
		this.#gF = this.#fbo([gA, gB], gD);
		return this.#gF;
	}

	#draw(now: number, dist: number, pa: number, pc: number, pf: number): void {
		const gl = this.#gl;
		const u = this.#u;
		const w = view.innerWidth;
		const h = view.innerHeight;
		const c = camera(w, h);
		const t = (now - this.#t0) / 1000;
		let dpr = Math.min(view.devicePixelRatio || 1, 2);
		if (w * h * dpr * dpr > 1.5e6) dpr = Math.sqrt(1.5e6 / (w * h));
		const bw = Math.round(w * dpr);
		const bh = Math.round(h * dpr);
		if (this.#canvas.width !== bw || this.#canvas.height !== bh) {
			this.#canvas.width = bw;
			this.#canvas.height = bh;
		}
		this.#sim(t);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.#gbuf(bw, bh));
		gl.viewport(0, 0, bw, bh);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.useProgram(this.#pO.p);
		this.#bind([this.#OD[0], this.#OD[1], this.#OD[2], this.#OS[0], this.#OS[1], this.#OS[2], this.#OS[3]]);
		gl.uniform3f(u.oCam, 0, EYE, -dist);
		gl.uniform4f(u.oPr, (2 * c.f) / w, (2 * c.f) / h, 1 - (2 * c.L) / h, GRID_DA);
		gl.uniform1f(u.oT, t);
		for (const band of this.#grid) {
			gl.bindVertexArray(band.vao);
			gl.drawElements(gl.TRIANGLES, band.count, gl.UNSIGNED_SHORT, 0);
		}
		gl.disable(gl.DEPTH_TEST);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, bw, bh);
		gl.useProgram(this.#pM.p);
		gl.bindVertexArray(this.#vq);
		this.#bind([this.#gA as GLHandle, this.#gB as GLHandle]);
		gl.uniform2f(u.R, w, h);
		gl.uniform1f(u.T, t);
		gl.uniform1f(u.L, c.L);
		gl.uniform1f(u.F, c.f);
		gl.uniform1f(u.CZ, -dist);
		gl.uniform1f(u.D, bw / w);
		const k = skyAt(this.#hour, w, h);
		for (const n of Object.keys(k) as (keyof SkyLight)[]) {
			const v = k[n];
			if (v.length === 4) gl.uniform4fv(this.#sky[n], v);
			else if (v.length === 3) gl.uniform3fv(this.#sky[n], v);
			else gl.uniform1fv(this.#sky[n], v);
		}
		// portal: approach, crossing, flash (peaks just before the gate plane)
		gl.uniform3f(u.P, pa, pc, pf);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
}
