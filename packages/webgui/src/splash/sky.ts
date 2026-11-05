/**
 * Time-of-day sky for the gate splash: keyframes by sun elevation and the
 * per-frame light set the scene shader reads. Shared by the eager placeholder
 * (plain zenith/horizon gradient) and the lazy WebGL scene.
 */

type Rgb = readonly [number, number, number];

/** Sun elevation keyframes, -1 night .. 1 noon. */
const KE = [-1, -0.3, -0.12, 0, 0.14, 0.4, 1];
/** Zenith colour per keyframe. */
const KZ: readonly Rgb[] = [
	[0.01, 0.015, 0.04],
	[0.03, 0.05, 0.12],
	[0.13, 0.19, 0.36],
	[0.33, 0.41, 0.56],
	[0.55, 0.64, 0.74],
	[0.45, 0.6, 0.8],
	[0.36, 0.58, 0.86],
];
/** Horizon colour per keyframe. */
const KH: readonly Rgb[] = [
	[0.03, 0.04, 0.07],
	[0.09, 0.09, 0.17],
	[0.52, 0.4, 0.46],
	[0.95, 0.6, 0.42],
	[0.95, 0.8, 0.62],
	[0.82, 0.84, 0.86],
	[0.72, 0.82, 0.92],
];
/** Sun colour per keyframe. */
const KS: readonly Rgb[] = [
	[0, 0, 0],
	[0, 0, 0],
	[0.7, 0.3, 0.25],
	[1, 0.52, 0.28],
	[1, 0.76, 0.5],
	[1, 0.95, 0.85],
	[1, 0.98, 0.94],
];

export const SUNRISE = 6.5;
export const SUN_NOON = 12.5;
export const SUNSET = 18.5;
/** Horizon height as a fraction of the viewport height. */
export const HORIZON = 0.52;

function lerpK(K: readonly Rgb[], e: number): [number, number, number] {
	let i = 0;
	while (i < KE.length - 2 && e > KE[i + 1]) i++;
	const t = Math.min(1, Math.max(0, (e - KE[i]) / (KE[i + 1] - KE[i])));
	const a = K[i];
	const b = K[i + 1];
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function sst(a: number, b: number, x: number): number {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

export function localHour(): number {
	const d = new Date();
	return d.getHours() + d.getMinutes() / 60;
}

/** Sun phase: 0..12 from sunrise to sunset, 12..24 through the night. */
function sunPhase(h: number): number {
	const dl = SUNSET - SUNRISE;
	return h >= SUNRISE && h <= SUNSET
		? (h - SUNRISE) * (12 / dl)
		: 12 + ((((h - SUNSET) % 24) + 24) % 24) * (12 / (24 - dl));
}

/** CSS gradient of the plain sky (zenith to horizon) for hour `h`, shown while the shaders compile. */
export function placeholderGradient(h: number): string {
	const el = Math.sin((Math.PI * sunPhase(h)) / 12);
	const zc = lerpK(KZ, el);
	const hc = lerpK(KH, el);
	// Below the horizon: the horizon colour dimmed, as a calm sea mirroring it.
	const sea: Rgb = [hc[0] * 0.55, hc[1] * 0.55, hc[2] * 0.55];
	const pct = `${(HORIZON * 100).toFixed(1)}%`;
	return `linear-gradient(to bottom, ${css(zc)} 0%, ${css(hc)} ${pct}, ${css(sea)} 100%)`;
}

/** Zenith colour for hour `h`, for the iOS status bar strip above the splash. */
export function zenithColor(h: number): string {
	return css(lerpK(KZ, Math.sin((Math.PI * sunPhase(h)) / 12)));
}

function css(c: Rgb): string {
	const ch = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
	return `rgb(${ch(c[0])} ${ch(c[1])} ${ch(c[2])})`;
}

export interface SkyLight {
	ZC: number[];
	HC: number[];
	SC: number[];
	KD: number[];
	KC: number[];
	PT: number[];
	SP: number[];
	MP: number[];
	MZ: number[];
}

/** Morning mist window, dusk amount and dusk window (hours). */
const MIST = { ma1: 5.6, ma2: 6.4, ma3: 7.6, ma4: 10, dm: 0.25, mp1: 17.8, mp2: 18.4, mp3: 19.2, mp4: 20 };

/** Full light set for the scene shader at hour `h` on a `w` x `H` CSS px viewport. */
export function skyAt(h: number, w: number, H: number): SkyLight {
	const L = H * HORIZON;
	const gx = w / 2;
	const gy = H / 2;
	const ph = sunPhase(h);
	const el = Math.sin((Math.PI * ph) / 12);
	const mel = Math.sin((Math.PI * (ph - 12)) / 12);
	const pos = (hh: number, e: number): [number, number] => [
		w * (0.5 + ((((((hh - SUN_NOON) % 24) + 36) % 24) - 12) / 6) * 0.42),
		L - e * L * 1.6,
	];
	const S = pos(h, el);
	const M = pos(h + 12, mel);
	const sc = lerpK(KS, el);
	const day = sst(-0.06, 0.12, el);
	const warm = sst(-0.2, -0.02, el) * (1 - sst(0.12, 0.35, el));
	const moon = sst(0, 0.15, mel) * (1 - sst(-0.2, 0, el)) * 0.6;
	const src = day > 0.02 ? S : M;
	const dx = (src[0] - gx) / H;
	const dy = (src[1] - gy) / H;
	const dln = Math.hypot(dx, dy, 0.6);
	const kc = day > 0.02 ? sc.map(v => v * 0.62 * day) : [1.15 * moon, 1.25 * moon, 1.5 * moon];
	const hc = lerpK(KH, el);
	const pt =
		day + moon < 0.05
			? [0.78, 0.86, 1]
			: [1, 0.97, 0.9].map((v, j) => v * 0.5 + Math.min(1, (hc[j] + sc[j] * warm) * 1.1) * 0.5);
	const mz =
		sst(MIST.ma1, MIST.ma2, h) * (1 - sst(MIST.ma3, MIST.ma4, h)) +
		MIST.dm * sst(MIST.mp1, MIST.mp2, h) * (1 - sst(MIST.mp3, MIST.mp4, h));
	return {
		ZC: lerpK(KZ, el),
		HC: hc,
		SC: sc,
		KD: [dx / dln, dy / dln, 0.6 / dln],
		KC: kc,
		PT: pt,
		MZ: [mz],
		SP: [S[0], S[1], sst(-0.04, 0.03, el), warm],
		MP: [M[0], M[1], moon, 1 - sst(-0.35, -0.12, el)],
	};
}
