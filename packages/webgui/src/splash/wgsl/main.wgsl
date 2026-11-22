// WGSL port of glsl/main.frag (same math, loops and call sites; see that file for the design notes).
// Not 1:1: G-buffer reads use textureLoad (scene() runs in non-uniform control flow, where WGSL forbids
// textureSample; the GL textures are NEAREST + clamp, so the loaded texel is the one GL sampled), the
// y flip in fs() is gone (WebGPU's position origin is top-left, GL's bottom-left), rp() returns a struct,
// GLSL ternaries are select() (both arms evaluated; none has side effects), parameters GLSL reassigns
// are copied to locals.
struct U {
	ZC: vec3f, T: f32,
	HC: vec3f, L: f32,
	SC: vec3f, D: f32,
	KD: vec3f, F: f32,
	KC: vec3f, CZ: f32,
	PT: vec3f, MZ: f32,
	SP: vec4f, // sun px xy, sun vis, twilight warmth
	MP: vec4f, // moon px xy, moon light, stars
	R: vec2f,
	P: vec2f,
}
@group(0) @binding(0) var<uniform> frame: U;
// ocean G-buffer (FFT surface pass): G0 = slope xz, roughness alpha^2, ray distance (0: no water); G1.y = height
@group(0) @binding(1) var G0: texture_2d<f32>;
@group(0) @binding(2) var G1: texture_2d<f32>;

const EH = 3.43; // eye height (m)
const LAC = vec3f(.88, .23, .1); // lacquer colour
const GT = vec3f(.22, .18, .15); // gloss lacquer, kasagi, black base
const STU = vec4f(.985, .5, 4., .33); // star threshold, twinkle rate min / max, steady fraction
const WP = vec3f(.01, .5, .1); // glint strength, object reflectance floor, reflection ripple tilt
const TQ = vec2f(.25, .6); // water body tropical lean; sun reflection
const BGK = .35; // sun path shoulder knee in the app background frame
const BGS = .6; // sun disc and halo brightness in the app background frame

var<private> GA: vec4f;
var<private> GB: vec4f;
// REF: 1 while shading a rock seen in the water (its mirrored silhouette shows sides and top edge-on)
var<private> REF: f32 = 0.;
var<private> N: vec3f;
var<private> M: f32;
var<private> G: f32;
var<private> AA: f32;
var<private> TA: f32;
var<private> T0: f32;
var<private> FP: f32;
var<private> HIT: f32;
var<private> RI: f32;
var<private> AM: f32;
var<private> ARI: f32;
var<private> RKS: f32 = .7; // step factor of the last rk() branch (its Lipschitz bound)
var<private> SM: f32 = 0.; // cheap rock mode for the portal's blurred samples

fn sunMid() -> f32 {
	let e = (frame.L - frame.SP.y) / (1.6 * frame.L);
	return smoothstep(.04, .2, e) * smoothstep(.9, .45, e);
}
fn h21(p0: vec2f) -> f32 {
	var p = fract(p0 * vec2f(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}
fn vn(p: vec2f) -> f32 {
	let i = floor(p);
	var f = fract(p);
	f = f * f * (3. - 2. * f);
	return mix(mix(h21(i), h21(i + vec2f(1., 0.)), f.x), mix(h21(i + vec2f(0., 1.)), h21(i + vec2f(1., 1.)), f.x), f.y);
}
fn h1(i: f32) -> f32 { return fract(sin(i * 127.1) * 43758.5453); }
fn lnz(x: f32) -> f32 { let i = floor(x); return mix(h1(i), h1(i + 1.), fract(x)); }
fn sky(p: vec2f, sun: f32) -> vec3f {
	let hgt = max(frame.L - p.y, 0.);
	let ys = clamp(hgt / frame.L, 0., 1.);
	var c = mix(frame.HC, frame.ZC, pow(ys, .55));
	let ds = (p - frame.SP.xy) / frame.R.y;
	let dm = (p - frame.MP.xy) / frame.R.y;
	let sd = length(ds);
	let md = length(dm);
	// dawn/dusk band: warm near the sun azimuth, along the horizon
	c += frame.SC * frame.SP.w * exp(-ys * 5.) * exp(-abs(ds.x) * 2.2) * .55;
	// sun: disc, glow, Mie halo (halo a little softer for a mid/low sun); x BGS in the app background (CZ ramp)
	c += frame.SC * frame.SP.z * sun * mix(1., BGS, clamp(frame.CZ / 6., 0., 1.)) * (smoothstep(.016, .012, sd) * 1.2 + (exp(-sd * 14.) * .45 + exp(-sd * 3.) * .16) * (1. - .3 * sunMid()));
	// stars: visibility from one hash, brightness/twinkle from independent hashes; a third stay steady
	if (frame.MP.w > 0. && sun > 0.) {
		let cl = floor(p / 5.);
		let sp = cl * 5. + 1. + 3. * vec2f(h21(cl + 7.), h21(cl + 3.));
		let hs = h21(cl);
		let ha = h21(cl + 17.3);
		let hb = h21(cl + 29.1);
		let hc = h21(cl + 41.7);
		let tw = step(STU.w, hb) * (.2 + .45 * hc) * (.5 + .5 * sin(frame.T * (STU.y + (STU.z - STU.y) * ha) + hb * 43.));
		let st = step(STU.x, hs) * smoothstep(1.2, .2, length(p - sp)) * (.35 + .75 * hc * hc) * (1. - tw);
		c += vec3f(.9, .93, 1.) * st * frame.MP.w * smoothstep(.02, .25, ys);
	}
	// moon
	c += vec3f(.93, .95, 1.) * frame.MP.z * 3. * sun * (smoothstep(.012, .009, md) * 1.6 + exp(-md * 30.) * .45 + exp(-md * 6.) * .22);
	// aerial perspective: a thin band at the horizon, thicker only in morning mist
	let hz = exp(-hgt / (frame.R.y * mix(.035, .26, frame.MZ)));
	c = mix(c, frame.HC, hz * (.12 + .23 * frame.MZ));
	return c;
}
fn light(n: vec3f, alb: vec3f, gl: f32) -> vec3f {
	let df = max(dot(n, frame.KD), 0.);
	let sp = pow(max(dot(n, normalize(frame.KD + vec3f(0., 0., 1.))), 0.), 36.) * gl;
	let am = .62 + .25 * (-n.y);
	let amb = mix(frame.HC, frame.ZC, .6) * .8;
	// grazing rim tinted by the albedo: an untinted rim lit every face whose normal is perpendicular to the view
	return alb * (amb * am + frame.KC * df + frame.KC * pow(1. - abs(n.z), 3.) * .5 * (1. - REF)) + (frame.KC * 1.4 + amb * .2) * sp;
}
// World: metres, y up, z away from the camera, water at y 0, gate plane z 0, opening centred on x 0.
fn sdB(p: vec3f, b: vec3f, r: f32) -> f32 {
	let q = abs(p) - b + r;
	return length(max(q, vec3f(0.))) + min(max(q.x, max(q.y, q.z)), 0.) - r;
}
fn smin(a: f32, b: f32, k: f32) -> f32 {
	let h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
	return mix(b, a, h) - k * h * (1. - h);
}
// tapered round post: inner face stays at |x| 1.2 (the opening), outer face tapers 1.42 -> 1.2 m radius
fn post(p: vec3f, s: f32, y0: f32) -> f32 {
	let r = mix(1.42, 1.2, clamp(p.y / 12.9, 0., 1.));
	let dr = (length(vec2f(p.x - s * (1.2 + r), p.z)) - r) * .97;
	let dy = abs(p.y - (y0 + 13.4) * .5) - (13.4 - y0) * .5;
	return length(max(vec2f(dr, dy), vec2f(0.))) + min(max(dr, dy), 0.);
}
// pi: two posts, lacquered shimaki band 12.8..15.2, black kasagi with a gentle upward sweep to rounded tips
fn gd(p: vec3f) -> f32 {
	let a = min(post(p, -1., 2.), post(p, 1., -.5));
	let b = sdB(p - vec3f(1.2, 14., 0.), vec3f(7.2, 1.2, 1.5), .22);
	let x = p.x - 1.2;
	let f = smoothstep(4.5, 7.7, abs(x));
	let c = sdB(vec3f(x, p.y - 15.62 - .003 * x * x - .275 * f * f, p.z), vec3f(7.7, .42 + .06 * f, 1.9), .2) * .85;
	G = select(select(2., 1., a < b - .04), 3., c < min(a, b));
	return min(smin(a, b, .3), c);
}
fn nrm(p: vec3f) -> vec3f {
	const k = vec2f(1., -1.) * .015;
	return normalize(k.xyy * gd(p + k.xyy) + k.yyx * gd(p + k.yyx) + k.yxy * gd(p + k.yxy) + k.xxx * gd(p + k.xxx));
}
// raymarch only inside the gate's AABB, <= 48 steps; aa: record closest miss for edge coverage
fn gTrace(ro: vec3f, rd: vec3f, t: f32, aa: bool) -> f32 {
	let iv = 1. / rd;
	let t0 = (vec3f(-6.8, -.6, -2.) - ro) * iv;
	let t1 = (vec3f(9.2, 16.7, 2.) - ro) * iv;
	let mn = min(t0, t1);
	let mx = max(t0, t1);
	let tn = max(max(mn.x, mn.y), mn.z);
	let tf = min(min(min(mx.x, mx.y), mx.z), t);
	if (tf < max(tn, 0.)) { return t; }
	var s = max(tn, 0.);
	let pf = 1. / (frame.F * frame.D);
	var mr = 1e9;
	var ms = 0.;
	for (var i = 0; i < 48; i++) {
		let p = ro + rd * s;
		let d = gd(p);
		let e = (s + T0) * pf;
		if (d < e * .1) { M = G; N = nrm(p); return s; }
		if (aa && d < mr * e) { mr = d / e; ms = s; }
		s += d;
		if (s > tf) { break; }
	}
	if (aa && .5 - mr > AA) { AA = .5 - mr; TA = ms; AM = 0.; }
	return t;
}
// eroded sea rocks: SDF = ellipsoid (+ plinth under the left post) displaced by lumpy + ridged fbm
fn h31(p0: vec3f) -> f32 {
	let p = fract(p0 * .3183099 + .1) * 17.;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
fn n3(p: vec3f) -> f32 {
	let i = floor(p);
	var f = fract(p);
	f = f * f * (3. - 2. * f);
	return mix(mix(mix(h31(i), h31(i + vec3f(1., 0., 0.)), f.x), mix(h31(i + vec3f(0., 1., 0.)), h31(i + vec3f(1., 1., 0.)), f.x), f.y),
		mix(mix(h31(i + vec3f(0., 0., 1.)), h31(i + vec3f(1., 0., 1.)), f.x), mix(h31(i + vec3f(0., 1., 1.)), h31(i + vec3f(1., 1., 1.)), f.x), f.y), f.z);
}
struct Rock { c: vec3f, r: vec3f }
fn rp(i: f32) -> Rock {
	if (i < .5) { return Rock(vec3f(-3.2, 0., .2), vec3f(2., 4.4, 2.7)); } // rock under the left leg
	if (i < 1.5) { return Rock(vec3f(7.385, 0., -20.), vec3f(1.046, .585, .8)); } // small rocks right, in front of the gate
	return Rock(vec3f(8.49, 0., -19.38), vec3f(.492, .308, .431));
}
// e: pixel footprint (m) at p; octaves whose period drops under ~2 px fade to their mean (LOD, no shimmer)
fn rk(p: vec3f, i: f32, e: f32) -> f32 {
	let rock = rp(i);
	let c = rock.c;
	let r = rock.r;
	let q = p - c;
	let s = min(r.x, min(r.y, r.z));
	let k0 = length(q / r);
	var d = k0 * (k0 - 1.) / length(q / (r * r));
	var fade = 1.;
	if (i < .5) {
		// plinth the post stands on; displacement fades toward the post foot so no pit opens under it
		let pr = length(p.xz - vec2f(-2.62, 0.));
		d = smin(d, max(pr - 1.3, abs(p.y - .9) - 1.4), .7);
		fade = mix(smoothstep(1.1, 1.7, pr), 1., smoothstep(1.4, .6, p.y));
	}
	// displacement is bounded by .29 s: far from the surface return a safe bound without any noise (1-Lipschitz: full step)
	RKS = 1.;
	if (d > s * .35) { return d - s * .3; }
	RKS = .7;
	var u = q * (2.2 / s) + i * 17.;
	// big lumps break the ellipsoid silhouette; ridged octaves carve eroded grooves and pits
	let lump = (n3(u * .35) - .5) * .9 + (n3(u * .8 + 5.) - .5) * .45;
	d -= s * lump * .32;
	RKS = .69; // marks the detailed branch: only its distance is a true surface distance
	if (d > s * .12) { return d - s * .08; }
	RKS = .7;
	// reflection rays (T0 > 0) see the rock through ripples and desaturation: fine octaves drop 4x earlier
	var rg = 0.;
	var a = .5;
	let ex = s / (2.2 * max(e, 1e-4)) / select(1., 4., T0 > 0.) * (1. - SM);
	for (var k = 0; k < 3; k++) {
		let fr = 1.6 + f32(k) * 1.9;
		let w = smoothstep(1.5, 3., ex / fr);
		if (w <= 0.) { rg += .514 * (2. * a - .125); break; } // remaining octaves at their mean
		let n = 1. - abs(2. * n3(u * fr + f32(k) * 3.1) - 1.);
		rg += a * mix(.514, n * n, w);
		u = u.yzx;
		a *= .5;
	}
	d -= s * (rg - .45) * .16 * fade;
	return d;
}
// tetrahedron offsets in a loop: one inlined copy of rk() instead of four
fn rnrm(p: vec3f, i: f32, h: f32) -> vec3f {
	var n = vec3f(0.);
	for (var j = 0; j < 4; j++) {
		let k = (vec3f(f32(1 - ((j ^ (j >> 1u)) & 1)), f32((j >> 1u) & 1), f32(j & 1)) * 2. - 1.) * h;
		n += k * rk(p + k, i, h);
	}
	return normalize(n);
}
// raymarch one rock inside its bounds, <= 40 steps, step scaled for the displacement's Lipschitz bound
fn rTrace(ro: vec3f, rd: vec3f, t: f32, aa: bool, i: f32) -> f32 {
	let rock = rp(i);
	let c = rock.c;
	let r = rock.r;
	let m = r + min(r.x, min(r.y, r.z)) * .3 + .05;
	var lo = c - m;
	let hi = c + m;
	lo.y = -.05;
	let iv = 1. / rd;
	let t0 = (lo - ro) * iv;
	let t1 = (hi - ro) * iv;
	let mn = min(t0, t1);
	let mx = max(t0, t1);
	var tn = max(max(mn.x, mn.y), mn.z);
	var tf = min(min(min(mx.x, mx.y), mx.z), t);
	if (tf < max(tn, 0.)) { return t; }
	let eo = (ro - c) / (r * 1.35);
	let ed = rd / (r * 1.35);
	let ea = dot(ed, ed);
	let eb = dot(eo, ed);
	let ec = dot(eo, eo) - 1.;
	var eh = eb * eb - ea * ec;
	if (eh < 0.) { return t; }
	eh = sqrt(eh);
	tn = max(tn, (-eb - eh) / ea);
	tf = min(tf, (-eb + eh) / ea);
	if (i < .5) {
		// the left post is solid inside a vertical cylinder (x -2.5, r 1.05, y 2.05..12.9): nothing behind its entry is visible
		let co = ro.xz - vec2f(-2.5, 0.);
		let cd = rd.xz;
		let ca = dot(cd, cd);
		let cb = dot(co, cd);
		let ch = cb * cb - ca * (dot(co, co) - 1.1025);
		if (ch > 0.) {
			let tc = (-cb - sqrt(ch)) / ca;
			let yc = ro.y + rd.y * tc;
			if (tc > 0. && yc > 2.05 && yc < 12.9) { tf = min(tf, tc); }
		}
	}
	if (tf < max(tn, 0.)) { return t; }
	var s = max(tn, 0.);
	let pf = 1. / (frame.F * frame.D);
	var mr = 1e9;
	var ms = 0.;
	var d = 1e9;
	for (var k = 0; k < 40; k++) {
		if (SM > .5 && k >= 16) { break; }
		let p = ro + rd * s;
		let e = (s + T0) * pf;
		d = rk(p, i, e);
		if (d < e * .12) { break; }
		// only the detailed branch measures the true distance; the bound branches underestimate it and would fake a near miss
		if (aa && RKS == .7 && d < mr * e) { mr = d / e; ms = s; }
		s += d * min(1., RKS * (1. + SM * .3));
		if (s > tf) { break; }
	}
	// converged, or out of steps while still creeping along the surface (grazing rays): a hit, not a hole
	if (s <= tf && d < .02 + (s + T0) * pf) {
		let p = ro + rd * s;
		M = 4.;
		RI = i;
		N = rnrm(p, i, max(.02, (s + T0) * pf));
		return s;
	}
	// coverage ramps from 1 px outside the silhouette to the hit threshold, so hit and miss pixels meet without a step
	let cv = smoothstep(1., .12, mr);
	if (aa && cv > AA) { AA = cv; TA = ms; AM = 4.; ARI = i; }
	return t;
}
// edge-AA sample: restore normal + material of whichever surface recorded the coverage
fn aaN(q: vec3f, t: f32) {
	if (AM > 3.5) { M = 4.; RI = ARI; N = rnrm(q, RI, max(.02, (t + T0) / (frame.F * frame.D))); } else { N = nrm(q); M = G; }
}
fn trace(ro: vec3f, rd: vec3f, aa: bool) -> f32 {
	var t = 1e9;
	// a loop, not three calls: each call site is another inlined copy of the raymarch for the compiler
	for (var i = 0; i < 3; i++) { t = rTrace(ro, rd, t, aa, f32(i)); }
	return gTrace(ro, rd, t, aa);
}
fn shade(q: vec3f) -> vec3f {
	var n = N;
	var alb: vec3f;
	var g = .3;
	if (M < 3.5) {
		// wood under lacquer: fibres along the member, growth rings warped by noise
		let gc = select(vec2f(q.z * 2.2 + q.y * 1.6, q.x * .22), vec2f(atan2(q.z, q.x - sign(q.x) * 2.5) * 1.6, q.y * .3), M < 1.5);
		let fib = vn(vec2f(gc.x * 9., gc.y * 2.));
		let grain = mix(fib, .5 + .5 * sin(gc.x * 11. + gc.y * 3. + vn(gc * vec2f(2., 5.)) * 6.), .45);
		// edge distance: beams by box faces, posts only near the top joint
		let s = select(vec3f(7.7, .42, 1.9) - abs(q - vec3f(1.2, 15.62, 0.)), vec3f(7.2, 1.2, 1.5) - abs(q - vec3f(1.2, 14., 0.)), M < 2.5);
		let e = select(s.x + s.y + s.z - max(s.x, max(s.y, s.z)) - min(s.x, min(s.y, s.z)), 12.9 - q.y, M < 1.5);
		// wear: fine, subtle, faded out once a pixel covers more than a few cm (no blotches at distance)
		let hf = smoothstep(.06, .015, FP);
		let wear = smoothstep(.8, .98, vn(q.xy * vec2f(3.6, 1.8) + q.z * 3.) * .7 + vn(q.xy * 14. + q.z) * .3 * hf + (1. - smoothstep(0., .2, e)) * .3) * mix(.25, .6, hf);
		n = normalize(n + (fib - .5) * .035 * (1. - wear));
		// weathering: broad patches drift between sun-bleached orange-pink and deeper red
		let pv = vn(q.xy * vec2f(.35, .18) + q.z * .3) * .65 + vn(q.xy * vec2f(1.1, .5) + 9.) * .35;
		alb = mix(LAC * vec3f(.9, .85, .9), mix(LAC, vec3f(.85, .55, .45), .35), pv) * (.9 + .15 * grain);
		// soft occlusion where the posts meet the band (posts near the top, band underside near the posts)
		let jd = select(q.y - 12.8 + max(min(abs(q.x + 2.5), abs(q.x - 2.5)) - 1.3, 0.), 12.8 - q.y, M < 1.5);
		alb *= mix(.8, 1., smoothstep(0., 1.4, jd));
		alb = mix(alb, mix(vec3f(.36, .15, .09), vec3f(.5, .24, .14), grain), wear * .35);
		g = mix(GT.x, .06, wear);
		if (M < 1.5) {
			alb *= mix(.9, 1., smoothstep(12.8, 11., q.y));
			let yb = select(1.7, 3.3, q.x < 0.);
			let bk = smoothstep(yb + .12, yb - .05, q.y + (vn(q.xz * 6.) - .5) * .08);
			alb = mix(alb, vec3f(.045, .042, .04) * (.8 + .4 * fib), bk);
			g = mix(g, GT.z, bk);
		}
		if (M > 2.5) { alb = mix(vec3f(.06, .058, .06) * (.85 + .3 * vn(vec2f(q.x * 3., q.z * 4.))), vec3f(.17, .16, .15), wear * .4); g = GT.y; }
	} else {
		// crevice AO: two SDF probes along the normal
		let oc = (.15 - rk(q + n * .15, RI, FP)) / .15 + (.6 - rk(q + n * .6, RI, FP)) / .6 * .5;
		let ao = clamp(1. - oc * .6, .25, 1.);
		let hf = smoothstep(.08, .02, FP);
		var b = vec3f(vn(q.xy * 3.), vn(q.yz * 3. + 7.), vn(q.zx * 3. + 13.)) - .5;
		if (hf > 0.) { b += (vec3f(vn(q.xy * 9.), vn(q.yz * 9. + 3.), vn(q.zx * 9. + 5.)) - .5) * .6 * hf; }
		n = normalize(n + b * .5);
		let gr = vn(q.xz * 7. + q.y * 3.);
		let mt = vn(q.xy * .9 + q.z * .7);
		// waterline: dark wet band with ragged top, algae low, drier pale basalt above;
		// band heights scale with the rock's height (the left rock is the 4.4 m reference)
		let hs = rp(RI).r.y / 4.4;
		let wl = (.5 + .4 * vn(q.xz * 1.4 + 3.)) * hs;
		let wet = smoothstep(wl + .35 * hs, wl - .15 * hs, q.y);
		let alg = smoothstep(wl * .5 + .1 * hs, wl * .5 - .15 * hs, q.y) * (.6 + .4 * vn(q.xz * 4.));
		var dry = mix(vec3f(.17, .165, .16), vec3f(.31, .29, .27), mt) * (.85 + .3 * gr);
		dry = mix(dry, vec3f(.44, .43, .40), smoothstep(.5, .9, n.y) * .4 * (1. - REF)); // salt-bleached tops
		alb = mix(dry, vec3f(.08, .08, .075) * (.8 + .4 * gr), wet);
		alb = mix(alb, vec3f(.035, .06, .03), alg);
		alb *= mix(.45, 1., ao);
		g = mix(.04, .7, wet) * ao;
	}
	var c = light(vec3f(n.x, -n.y, -n.z), alb, g);
	// downward faces: soft occlusion (deepest toward the beam centre line), sheen kept off so the lacquer stays red
	let dn = max(-n.y, 0.) * step(M, 3.5);
	c *= 1. - dn * (.2 + .15 * smoothstep(1.6, 0., abs(q.z)));
	c += alb * mix(frame.HC, vec3f(1.), .5) * dn * .18; // warm lacquer bounce off the water
	// lacquer clearcoat: faint sky sheen, strongest at grazing angles
	if (M < 3.5) { c += mix(frame.HC, frame.ZC, .5) * g * (.02 + .1 * pow(1. - abs(n.z), 4.)) * (1. - dn); }
	if (M > 3.5) { c = mix(c, mix(frame.HC, frame.ZC, .4) * 1.1 + .15, smoothstep(.22, .04, q.y) * (.5 + .4 * lnz(q.x * 8. + frame.T)) * .6); }
	return c;
}
// the water's mirror ray for the gate/rock reflection, off a flattened normal (see bgd)
fn mirror(rd: vec3f) -> vec3f {
	let kr = WP.z * frame.R.y / frame.F;
	var rr = reflect(rd, normalize(vec3f(-GA.x * kr, 1., -GA.y * kr)));
	rr.y = max(rr.y, 1e-4);
	return rr;
}
const SCAT = vec3f(.05, .40, .42); // turquoise crest SSS
// aerial perspective: clear air (~1% at 60 m), thicker in morning mist
fn haze(c: vec3f, mc: vec3f, t: f32) -> vec3f { return mix(c, mc, 1. - exp(-t * mix(1. / 6000., 1. / 450., frame.MZ))); }
fn scene(p: vec2f) -> vec3f {
	let ro = vec3f(0., EH, frame.CZ);
	let rd = normalize(vec3f((p.x - frame.R.x * .5) / frame.F, (frame.L - p.y) / frame.F, 1.));
	let mc = sky(vec2f(p.x, frame.L - 6.), 0.); // horizon mist
	AA = 0.; T0 = 0.; HIT = 0.;
	// p is top-down CSS px and the G-buffer's row 0 is the top (written by a WebGPU pass): texel = floor(p * D)
	let gx = clamp(vec2i(floor(p * frame.D)), vec2i(0), vec2i(textureDimensions(G0)) - 1);
	GA = textureLoad(G0, gx, 0);
	GB = textureLoad(G1, gx, 0);
	let tw = select(1e9, GA.w, GA.w > 0.);
	var t = 1e9;
	var to = 1e9;
	var ra = 0.;
	var rt = 0.;
	// pass 0 traces the view ray, pass 1 the water's mirror ray: one trace() call site
	var o = ro;
	var dr = rd;
	var a0 = 0.;
	var ta0 = 0.;
	for (var k = 0; k < 2; k++) {
		let th = trace(o, dr, true);
		if (k == 1) { to = th; ra = AA; rt = TA; T0 = 0.; AA = a0; TA = ta0; break; }
		t = th; a0 = AA; ta0 = TA;
		if (t < tw || tw > 1e8) { break; }
		o = ro + rd * tw; dr = mirror(rd); AA = 0.; T0 = tw;
	}
	let a = AA;
	let ta = TA;
	var col: vec3f;
	// pass 0: the surface hit (or the water/sky); pass 1, edge AA: blend the colour at the closest approach
	// by its pixel coverage. One shade() call site: every call site is another inlined copy
	for (var k = 0; k < 2; k++) {
		var d = t;
		if (k == 0) {
			if (t >= tw) { HIT = select(0., a, ta < tw); col = bgd(p, ro, rd, mc, tw, to, ra, rt); continue; }
			HIT = 1.;
		} else {
			if (a <= 0. || ta >= select(tw, t - .3, t < tw)) { break; }
			d = ta;
			aaN(ro + rd * ta, ta);
		}
		FP = d / frame.F;
		let c = haze(shade(ro + rd * d), mc, d);
		col = select(mix(col, c, a), c, k == 0);
	}
	return col;
}
// ---- water shading: Ultra-Water OceanSurface.js (MIT, Copyright (c) 2026 Humpalumps; notice in shaders.ts)
const PI = 3.14159265;
fn h12(p: vec2f) -> f32 {
	var p3 = fract(vec3f(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
// Poisson count with mean lam from one uniform number (normal approximation for large means)
fn poisson(lam: f32, u: f32) -> f32 {
	if (lam > 6.) { return max(0., lam + sqrt(lam) * log(u / (1. - u)) / 1.702); }
	var pk = exp(-lam);
	var cf = pk;
	var n = 0.;
	for (var k = 0; k < 14; k++) {
		if (u <= cf) { break; }
		n += 1.; pk *= lam / n; cf += pk;
	}
	return n;
}
// GGX lobe, alpha floored so the source acts as a small area light; y: facet density term for the glints
fn ggx(n: vec3f, v: vec3f, l: vec3f, a0: f32) -> vec2f {
	let a = max(a0, .015);
	let a2 = a * a;
	let h = normalize(l + v);
	let nh = max(dot(n, h), 0.);
	let nl = max(dot(n, l), 0.);
	let nv = max(dot(n, v), 1e-4);
	let vh = max(dot(v, h), 0.);
	let dd = nh * nh * (a2 - 1.) + 1.;
	let dg = a2 / (PI * dd * dd);
	let vis = .5 / (nl * sqrt(nv * nv * (1. - a2) + a2) + nv * sqrt(nl * nl * (1. - a2) + a2) + 1e-5);
	return vec2f(PI * dg * vis * (.02 + .98 * pow(1. - vh, 5.)) * nl, dg * nh * 6.8e-5 / (4. * max(vh, .05)));
}
fn pdir(q: vec2f) -> vec3f { return normalize(vec3f((q.x - frame.R.x * .5) / frame.F, (frame.L - q.y) / frame.F, 1.)); }
fn bgd(p: vec2f, ro: vec3f, rd: vec3f, mc: vec3f, tw: f32, to: f32, ra: f32, rt: f32) -> vec3f {
	if (tw > 1e8) { return mix(sky(p, 1.), mc, exp(-(frame.L - p.y) / (frame.R.y * .012)) * (.15 + .35 * frame.MZ)); }
	let W = ro + rd * tw;
	let v = -rd;
	let n = normalize(vec3f(-GA.x, 1., -GA.y));
	let al = sqrt(GA.z);
	let nv = max(dot(n, v), 1e-4);
	// Fresnel with roughness-aware F90 (Lagarde) at 30% strength: a calm sea's far field mirrors the light sky
	let f90 = mix(1., max(1. - .7 * sqrt(al), .02), .3);
	let fr = .02 + (f90 - .02) * pow(1. - nv, 5.);
	// sky in the reflected direction (sun/moon discs come from the GGX lobes)
	var sv = reflect(rd, n);
	sv.y = abs(sv.y);
	let sz = max(sv.z, .3);
	let refl = sky(vec2f(frame.R.x * .5 + sv.x / sz * frame.F, min(frame.L - sv.y / sz * frame.F, frame.L - .5)), 0.);
	// gate/rocks: mirrored ray off a flattened normal; its Fresnel uses that normal and no F90 cut, or the
	// crest backs facing the camera (F < .1) and the rough mid-field erase the gate (traced by scene(): to, ra, rt)
	let kr = WP.z * frame.R.y / frame.F;
	let nf = normalize(vec3f(-GA.x * kr, 1., -GA.y * kr));
	let rr = mirror(rd);
	var oc = vec3f(0.);
	let fo = .02 + .98 * pow(1. - max(dot(nf, v), 1e-4), 5.);
	let cov = select(ra, 1., to < 1e8);
	if (cov > 0.) {
		let ts = select(rt, to, to < 1e8);
		let oq = W + rr * ts;
		if (to >= 1e8) { aaN(oq, tw + ts); }
		FP = (tw + ts) / frame.F;
		REF = step(3.5, M); oc = shade(oq); REF = 0.;
	}
	let sd = pdir(frame.SP.xy);
	let md = pdir(frame.MP.xy);
	let sun = frame.SC * frame.SP.z;
	let moon = vec3f(.8, .85, .95) * frame.MP.z;
	let nl = dot(n, sd);
	// body lit by this sky, filtered by the water column (absorbs red first)
	let skl = mix(frame.ZC, frame.HC, .45) * mix(.6, 1.05, frame.SP.z * smoothstep(.1, .5, sd.y)) + sun * max(sd.y, 0.) * .2;
	// (at dawn/dusk the low light reaches the eye through little water: a flatter filter keeps the sky's warmth)
	let sea = skl * mix(vec3f(.22, .52, .62), vec3f(.46, .42, .42), frame.SP.w * .85);
	let ins = mix(sea, vec3f(.10, .55, .60) * dot(skl, vec3f(.3, .5, .2)), TQ.x) + vec3f(.004, .01, .025);
	let k1 = 1.6 * max(GB.y, 0.) * pow(clamp(dot(sd, rd), 0., 1.), 4.) * pow(.5 - .5 * nl, 3.);
	let body = ins + ((k1 + .06 * nv * nv) + .05 * max(nl, 0.)) * SCAT * sun;
	var gs = ggx(n, v, sd, al);
	var gm = ggx(n, v, md, al);
	// glitter: the lobe as a finite number of sub-pixel facets (Poisson count per 6 CSS px cell, twinkling),
	// one soft round dot per cell; dot weight x cell area / dot area keeps the lobe's mean brightness
	let wsp = gs.x * dot(sun, vec3f(1.)) + gm.x * dot(moon, vec3f(1.));
	if (wsp > .02) {
		const S = 6.;
		let ax = tw / frame.F;
		let rpx = 1.2 / frame.D;
		let per = 2e4 * max(gs.y, gm.y);
		let cl = floor(p / S);
		let lam = per * S * ax * S * ax / max(-rd.y, .01);
		let tt = frame.T * 3. + h12(cl + 17.17) * 64.;
		let it = floor(tt);
		let n0 = poisson(lam, clamp(h12(cl * 1.31 + it * 3.7), 1e-4, .9999));
		let n1 = poisson(lam, clamp(h12(cl * 1.31 + (it + 1.) * 3.7), 1e-4, .9999));
		let dp = (cl + .25 + .5 * vec2f(h12(cl + 3.1), h12(cl + 7.7))) * S - p;
		// compact (1 - r²)² kernel, integral pi rp² / 3: zero past rp, so an over-bright dot cannot bloom
		let k2 = max(1. - dot(dp, dp) / (rpx * rpx), 0.);
		let dotw = k2 * k2 * S * S * 3. / (3.1416 * rpx * rpx);
		let m = mix(mix(n0, n1, smoothstep(0., 1., tt - it)) / max(lam, 1e-4) * dotw, 1., smoothstep(6., 24., lam));
		let gk = mix(1., min(m, 400.), WP.x);
		gs.x *= gk;
		gm.x *= gk;
	}
	// sun path at a mid/low sun: radiance x TQ.y and a soft shoulder, so it keeps ripple texture instead of clipping.
	// The app background (CZ 0..6 m past the gate) applies both at every sun height with a lower knee; ramped by CZ
	// so the dolly has no cut
	let smd = sunMid();
	let bk = clamp(frame.CZ / 6., 0., 1.);
	var sp = sun * gs.x * mix(1., TQ.y, max(smd, bk));
	sp = mix(sp, sp / (1. + sp / mix(.9, BGK, bk)), max(smd, bk));
	let col = mix(mix(body, refl, fr), oc, max(fo, WP.y) * cov) + sp + moon * gm.x;
	return mix(col, mc, 1. - exp(-tw * mix(1. / 4000., 1. / 600., frame.MZ)));
}
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
	return vec4f(f32(i & 1u) * 4. - 1., f32(i >> 1u) * 4. - 1., 0., 1.);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
	let p0 = pos.xy / frame.D;
	let c = frame.R * .5;
	let vp = vec2f(c.x, frame.L);
	let rd = vec3f((p0.x - c.x) / frame.F, (frame.L - p0.y) / frame.F, 1.);
	// where this pixel crosses the gate plane, in icon units
	let u = vec2f(29. + rd.x * -frame.CZ / .4, 56. - (EH + rd.y * -frame.CZ) / .4);
	let portal = frame.CZ < 0. && u.x > 26. && u.x < 32. && u.y > 24. && u.y < 56.;
	// portal membrane
	let q = u - vec2f(29., 40.);
	var hz: vec2f;
	var dir: vec2f;
	var pp = p0;
	var r: f32;
	var ed: f32;
	var ei: f32;
	var ring: f32;
	if (portal) {
		r = length(q / vec2f(1., 1.7));
		ed = min(min(u.x - 26., 32. - u.x), u.y - 24.);
		// distortion stays clear of the band and posts so it never resamples their edges into the opening
		ei = min(min(u.x - 26.6, 31.4 - u.x), u.y - 26.5);
		let spd = 1.5 + frame.P.y * 9.;
		ring = sin(r * 4.2 - frame.T * spd) * exp(-r * .12) * smoothstep(0., .25, frame.P.x) * smoothstep(0., .8, ei);
		hz = vec2f(vn(u * 1.8 + vec2f(0., frame.T * .9)), vn(u * 1.8 + vec2f(5.2, -frame.T * .7))) - .5;
		dir = select(vec2f(0.), normalize(q), r > 1e-3);
	}
	// scene() has one call site: sample 0 is the undisturbed view, samples 1..n the portal's displaced views
	var s0: vec3f;
	var acc = vec3f(0.);
	var hc = 0.;
	var n = 0;
	for (var k = 0; k < 6; k++) {
		let sk = scene(select(select(pp, mix(pp, vp, f32(k - 1) / 4. * frame.P.y * .16), frame.P.y > 0.), p0, k == 0));
		if (k == 0) {
			// the undisturbed view decides where the gate itself covers the pixel: no distortion or glow there
			s0 = sk;
			hc = HIT;
			// where the undisturbed view is kept anyway the samples would be discarded: skip them
			if (!portal || hc >= 1. || ei <= 0.) { break; }
			pp = p0 + (hz * (2. + 7. * sqrt(frame.P.x)) + dir * ring * (2.5 + 4. * frame.P.y)) * smoothstep(0., .8, ei) * (1. - hc);
			// a displaced sample that lands on the gate would smear the band edge into the opening: keep the undisturbed view there
			if (frame.P.y > 0.) { n = 5; SM = 1.; } else if (all(pp == p0)) { break; } else { n = 1; }
		} else {
			acc += mix(sk, s0, HIT);
			if (k == n) { break; }
		}
	}
	SM = 0.;
	var col = s0;
	if (portal) {
		if (n > 0) { col = acc / f32(n); }
		col = mix(col, s0, max(hc, 1. - smoothstep(0., .6, ei)));
		let w = .2 + sqrt(frame.P.x) * .2;
		let ga = .03 + sqrt(frame.P.x) * .1 - frame.P.y * .03;
		let fr = frame.P.y * .25;
		let glow = vec3f(exp(-max(ed - fr, 0.) / w), exp(-ed / w), exp(-(ed + fr) / w)) * frame.PT * smoothstep(0., .5, u.y - 24.) * (1. - hc);
		col += glow * max(ga, 0.) + ring * (.008 + .012 * frame.P.x) * frame.PT;
		col = mix(col, vec3f(dot(col, vec3f(.3, .55, .15))), frame.P.x * .15) * (1. - frame.P.x * .08);
	} else {
		let lum = dot(col, vec3f(.3, .55, .15));
		col = mix(col, vec3f(lum), frame.P.x * .35);
		col *= 1. - frame.P.x * .35 * smoothstep(.25, .85, length((p0 - c) / frame.R.y));
	}
	return vec4f(col, 1.);
}
