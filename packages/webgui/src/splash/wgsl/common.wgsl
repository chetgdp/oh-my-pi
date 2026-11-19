// WGSL port of glsl/common.glsl, prepended to the init/evolve/fft/assemble modules (scene-gpu.ts).
const N = 256;
const PI = 3.14159265359;
const G = 9.81;
const ST = 7.4e-5;
fn cmul(a: vec2f, b: vec2f) -> vec2f { return vec2f(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
fn omega(k: f32) -> f32 { return sqrt(G * k + ST * k * k * k); }
// fullscreen triangle (glsl/quad.vert)
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
	return vec4f(f32(i & 1u) * 4. - 1., f32(i >> 1u) * 4. - 1., 0., 1.);
}
