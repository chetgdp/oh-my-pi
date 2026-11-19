// WGSL port of glsl/fft.frag: Stockham radix-2 inverse FFT stage.
struct F { Sub: i32, Vertical: i32 }
@group(0) @binding(0) var<uniform> u: F;
@group(0) @binding(1) var In0: texture_2d<f32>;
@group(0) @binding(2) var In1: texture_2d<f32>;
struct Out { @location(0) o0: vec4f, @location(1) o1: vec4f }
@fragment fn fs(@builtin(position) pos: vec4f) -> Out {
	let p = vec2i(pos.xy);
	let i = select(p.x, p.y % N, u.Vertical == 1);
	let hs = u.Sub >> 1u;
	let e = (i / u.Sub) * hs + (i & (hs - 1));
	var pe: vec2i;
	var po: vec2i;
	if (u.Vertical == 1) { let base = p.y - i; pe = vec2i(p.x, base + e); po = vec2i(p.x, base + e + N / 2); }
	else { pe = vec2i(e, p.y); po = vec2i(e + N / 2, p.y); }
	let a = 2. * PI * f32(i & (u.Sub - 1)) / f32(u.Sub);
	let tw = vec2f(cos(a), sin(a));
	let e0 = textureLoad(In0, pe, 0);
	let q0 = textureLoad(In0, po, 0);
	let e1 = textureLoad(In1, pe, 0);
	let q1 = textureLoad(In1, po, 0);
	return Out(vec4f(e0.xy + cmul(tw, q0.xy), e0.zw + cmul(tw, q0.zw)), vec4f(e1.xy + cmul(tw, q1.xy), e1.zw + cmul(tw, q1.zw)));
}
