/**
 * Camera, dolly, sea state and ocean grid shared by the WebGL (scene.ts) and
 * WebGPU (scene-gpu.ts) scenes. A module of its own, so each backend's chunk
 * pulls in only this and not the other backend's code and shaders.
 */
import { HORIZON } from "./sky";

/** Eye height above the water (m); main.frag and main.wgsl have their own copy (`EH`). */
export const EYE = 3.43;

/** Cascade sizes (m) of the 4 FFT cascades in one 256x1024 atlas; the last is the capillary band. */
export const NN = 256;
export const LEN = [600, 85, 12, 2.1];
export const GR = 9.81;
// Sea state "glass", Hs ~.015 m: .01 m cat's-paws (1 m/s over 3 km) plus a .02 m, 210 m swell.
export const OP = {
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
export const D0 = 60;
const CAP_W = 0.16;
const CAP_H = 0.1;
// The dolly stops this far past the gate plane, with the gate and its rock behind the camera; the app
// background keeps this framing, so it continues from the splash's last frame.
export const BEYOND = 6;
// metres past the gate plane over which the portal grade settles back to the plain scene
export const SETTLE = BEYOND;
export const ROUGH = 1;

export function camera(w: number, h: number): { f: number; L: number } {
	return { f: Math.min((CAP_W * w) / 15, (CAP_H * h) / 16) * D0, L: h * HORIZON };
}

export const view = globalThis as unknown as { innerWidth: number; innerHeight: number; devicePixelRatio: number };

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Polar ocean grid: inner radius (m) and angular step of the camera-centred rings. */
export const GRID_IN = Math.max(1, EYE / 2);
export const GRID_DA = (2 * Math.PI) / 432;
/** Vertex and shared band-local index data of {@link gridData}'s polar grid. */
export interface GridData {
	/** vertex xy offsets (m), ring-major */
	gv: Float32Array;
	/** band-local index pattern */
	idx: Uint16Array;
	/** vertices per ring */
	NA: number;
	bands: number;
	/** ring rows per band (the last band may be shorter) */
	bandRows: number;
	/** index count of each band */
	counts: number[];
}

/**
 * Camera-centred polar ocean grid: rings grow geometrically (square cells), sector +-80 deg.
 * The 113k vertices exceed 16-bit indices, so the rings are split into bands whose
 * vertex pointers start at the band's first ring and share one band-local index pattern
 * (0.67 MB instead of a 2.7 MB 32-bit buffer); bands draw in ring order, so the
 * triangles and their order are unchanged.
 */
export function gridData(): GridData {
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
	const counts: number[] = [];
	for (let band = 0; band < bands; band++) counts.push(Math.min(bandRows, rows - band * bandRows) * (NA - 1) * 6);
	return { gv, idx, NA, bands, bandRows, counts };
}
