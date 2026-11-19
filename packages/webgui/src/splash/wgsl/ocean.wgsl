// WGSL port of glsl/surface.glsl + ocean.vert + ocean.frag: camera-centred polar grid (their OceanSurface),
// restricted to the forward sector the fixed camera sees, into the 2-target G-buffer.
// Not 1:1: clip z is remapped to WebGPU's 0..w range ((z + w) / 2: same depth values and ordering as GL's
// window depth); framebuffer rows run top-down in both the raster and main.wgsl's G-buffer reads, so y is unchanged.
struct O {
	Pr: vec4f, // 2F/W, 2F/H, 1 - 2L/H (pinhole of the main shader), angular cell step
	Len: vec4f,
	Cam: vec3f, T: f32,
	In: f32, Wind: f32, RS: f32,
}
@group(0) @binding(0) var<uniform> u: O;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var D0: texture_2d<f32>;
@group(0) @binding(3) var D1: texture_2d<f32>;
@group(0) @binding(4) var D2: texture_2d<f32>;
@group(0) @binding(5) var S0: texture_2d<f32>;
@group(0) @binding(6) var S1: texture_2d<f32>;
@group(0) @binding(7) var S2: texture_2d<f32>;
@group(0) @binding(8) var S3: texture_2d<f32>;
struct V {
	@builtin(position) pos: vec4f,
	@location(0) W: vec3f,
	@location(1) XZ: vec2f,
	@location(2) U: f32,
}
@vertex fn vs(@location(0) a: vec2f) -> V { // a: grid offset from the camera (m)
	let xz = u.Cam.xz + a;
	let cell = max(length(a), u.In) * u.Pr.w;
	// displacement band-limited to the vertex spacing (+1 lod: box mips leak past Nyquist): no swimming
	let lod = max(log2(cell * 256. / u.Len.xyz) + 1., vec3f(0.));
	let d = textureSampleLevel(D0, smp, xz / u.Len.x, lod.x).xyz + textureSampleLevel(D1, smp, xz / u.Len.y, lod.y).xyz + textureSampleLevel(D2, smp, xz / u.Len.z, lod.z).xyz;
	// Cox-Munk mean square slope minus what the cascades carry (1x1 mips): sub-texel roughness
	let m0 = textureSampleLevel(S0, smp, vec2f(.5), 8.);
	let m1 = textureSampleLevel(S1, smp, vec2f(.5), 8.);
	let m2 = textureSampleLevel(S2, smp, vec2f(.5), 8.);
	let m3 = textureSampleLevel(S3, smp, vec2f(.5), 8.);
	var o: V;
	// (Cox-Munk floor scaled with the spectrum, uRS = waveScale, so glass stays glass)
	o.U = max((.003 + .00512 * u.Wind) * u.RS - (m0.z + m0.w + m1.z + m1.w + m2.z + m2.w + m3.z + m3.w), 0.);
	o.XZ = xz;
	o.W = vec3f(xz.x + d.x, d.y, xz.y + d.z);
	let q = o.W - u.Cam;
	let z = (q.z * 100000.5 - 100000.) / 99999.5;
	o.pos = vec4f(u.Pr.x * q.x, u.Pr.z * q.z + u.Pr.y * q.y, (z + q.z) * .5, q.z);
	return o;
}
fn hash12(p: vec2f) -> f32 {
	var p3 = fract(vec3f(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
fn vnoise(p: vec2f) -> f32 {
	let i = floor(p);
	let f = fract(p);
	let w = f * f * (3. - 2. * f);
	return mix(mix(hash12(i), hash12(i + vec2f(1., 0.)), w.x), mix(hash12(i + vec2f(0., 1.)), hash12(i + 1.), w.x), w.y);
}
struct Out { @location(0) o0: vec4f, @location(1) o1: vec4f }
@fragment fn fs(v: V) -> Out {
	var s0 = textureSample(S0, smp, v.XZ / u.Len.x);
	var s1 = textureSample(S1, smp, v.XZ / u.Len.y);
	var s2 = textureSample(S2, smp, v.XZ / u.Len.z);
	var s3 = textureSample(S3, smp, v.XZ / u.Len.w);
	// wind slicks: surfactant patches damp the short waves, so the far field breaks into calm and rough streaks
	let slick = smoothstep(.3, .7, vnoise(v.XZ * .006 + u.T * .01));
	let sl2 = mix(.75, 1., slick);
	let sl3 = mix(.4, 1., slick);
	s2 = vec4f(s2.xy * sl2, s2.zw * sl2 * sl2);
	s3 = vec4f(s3.xy * sl3, s3.zw * sl3 * sl3);
	let sl = s0.xy + s1.xy + s2.xy + s3.xy;
	let va = max(s0.zw - s0.xy * s0.xy, vec2f(0.)) + max(s1.zw - s1.xy * s1.xy, vec2f(0.)) + max(s2.zw - s2.xy * s2.xy, vec2f(0.)) + max(s3.zw - s3.xy * s3.xy, vec2f(0.));
	let n = normalize(vec3f(-sl.x, 1., -sl.y));
	// geometric specular AA (Kaplanyan): normal change across the pixel adds variance
	let dx = dpdx(n);
	let dy = dpdy(n);
	let gv = min(.25 * (dot(dx, dx) + dot(dy, dy)), .18);
	let a2 = .0004 + v.U * sl3 * sl3 + va.x + va.y + gv;
	return Out(vec4f(sl, a2, length(v.W - u.Cam)), vec4f(0., v.W.y, 0., 1.));
}
