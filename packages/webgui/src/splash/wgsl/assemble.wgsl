// WGSL port of glsl/assemble.frag: displacement (lDx, Dy, lDz), slope (sx, sz, sx², sz²): slope mips give mean + second moment (LEAN)
struct A { Cascade: i32, Lambda: f32 }
@group(0) @binding(0) var<uniform> u: A;
@group(0) @binding(1) var In0: texture_2d<f32>;
@group(0) @binding(2) var In1: texture_2d<f32>;
struct Out { @location(0) oD: vec4f, @location(1) oS: vec4f }
@fragment fn fs(@builtin(position) pos: vec4f) -> Out {
	let id = vec2i(pos.xy);
	let p = id + vec2i(0, u.Cascade * N);
	let s = select(-1., 1., (id.x + id.y) % 2 == 0); // undo the centred-k frequency shift
	let a = textureLoad(In0, p, 0) * s; // Dx Dz Dy Dxz
	let b = textureLoad(In1, p, 0) * s; // Dyx Dyz Dxx Dzz
	let dxx = u.Lambda * b.z;
	let dzz = u.Lambda * b.w;
	let sl = b.xy / max(vec2f(1. + dxx, 1. + dzz), vec2f(.2));
	return Out(vec4f(u.Lambda * a.x, a.z, u.Lambda * a.y, 0.), vec4f(sl, sl * sl));
}
