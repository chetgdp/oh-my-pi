// WGSL port of glsl/init.frag: H0 spectrum of the 4 cascades (rows c*N..c*N+N-1), drawn once.
struct I {
	SpecA: array<vec4f, 2>, // scale, angle, spreadBlend, swell
	SpecB: array<vec4f, 2>, // alpha, peakOmega, gamma, shortWavesFade
	Length: vec4f,
	Cut: vec4f,
	CapFade: f32,
	Seed: u32,
}
@group(0) @binding(0) var<uniform> u: I;
fn pcg2d(v0: vec2u) -> vec2u {
	var v = v0 * 1664525u + 1013904223u;
	v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> vec2u(16u);
	v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> vec2u(16u);
	return v;
}
fn gauss(id: vec2i, c: i32) -> vec2f {
	let h = pcg2d(vec2u(id) + vec2u(u32(c) * 7919u, u32(c) * 104729u) + u.Seed);
	let u1 = (f32(h.x) + 1.) / 4294967296.;
	let u2 = f32(h.y) / 4294967296.;
	return sqrt(-2. * log(u1)) * vec2f(cos(2. * PI * u2), sin(2. * PI * u2));
}
fn jonswap(w: f32, a: vec4f, b: vec4f) -> f32 {
	let wp = b.y;
	let sg = select(.09, .07, w <= wp);
	let r = exp(-(w - wp) * (w - wp) / (2. * sg * sg * wp * wp));
	let iw = 1. / w;
	let q = wp * iw;
	return a.x * b.x * G * G * iw * iw * iw * iw * iw * exp(-1.25 * q * q * q * q) * pow(b.z, r);
}
fn normalisation(s: f32) -> f32 {
	let s2 = s * s;
	let s3 = s2 * s;
	let s4 = s3 * s;
	if (s < 5.) { return -.000564 * s4 + .00776 * s3 - .044 * s2 + .192 * s + .163; }
	return -4.80e-08 * s4 + 1.07e-05 * s3 - 9.53e-04 * s2 + 5.90e-02 * s + 3.93e-01;
}
fn directional(th: f32, w: f32, a: vec4f, b: vec4f) -> f32 {
	let x = w / b.y;
	var s = select(6.97 * pow(x, 5.), 9.77 * pow(x, -2.5), x > 1.);
	s += 16. * tanh(min(x, 20.)) * a.w * a.w;
	let t = th - a.y;
	return mix(2. / PI * cos(t) * cos(t), normalisation(s) * pow(abs(cos(.5 * t)), 2. * s), a.z);
}
fn h0(id: vec2i, c: i32) -> vec2f {
	let L = u.Length[c];
	let dk = 2. * PI / L;
	let k = vec2f(id - N / 2) * dk;
	let kl = length(k);
	let lo = select(u.Cut[max(c - 1, 0)], 1e-4, c == 0);
	let hi = select(u.Cut[c], 1e4, c == 3);
	if (kl < lo || kl > hi) { return vec2f(0.); }
	let w = omega(kl);
	let dwdk = (G + 3. * ST * kl * kl) / (2. * w);
	let th = atan2(k.y, k.x);
	var S = 0.;
	for (var i = 0; i < 2; i++) {
		if (u.SpecA[i].x <= 0.) { continue; }
		let fade = select(u.SpecB[i].w, u.CapFade, c == 3);
		S += jonswap(w, u.SpecA[i], u.SpecB[i]) * directional(th, w, u.SpecA[i], u.SpecB[i]) * exp(-fade * fade * kl * kl);
	}
	return gauss(id, c) * sqrt(2. * S * dwdk / kl * dk * dk);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
	let p = vec2i(pos.xy);
	let c = p.y / N;
	let id = vec2i(p.x, p.y - c * N);
	let a = h0(id, c);
	let b = h0((N - id) % N, c);
	return vec4f(a, b.x, -b.y); // h0(k), conj(h0(-k))
}
