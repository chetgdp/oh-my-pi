// Mip level n+1 of a displacement/slope pair from level n: 2x2 box filter (WebGPU has no generateMipmap).
// GL's generateMipmap filter is implementation-defined; for these power-of-two textures drivers use this box.
@group(0) @binding(0) var D: texture_2d<f32>;
@group(0) @binding(1) var S: texture_2d<f32>;
struct Out { @location(0) d: vec4f, @location(1) s: vec4f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
	return vec4f(f32(i & 1u) * 4. - 1., f32(i >> 1u) * 4. - 1., 0., 1.);
}
fn box(t: texture_2d<f32>, p: vec2i) -> vec4f {
	return (textureLoad(t, p, 0) + textureLoad(t, p + vec2i(1, 0), 0) + textureLoad(t, p + vec2i(0, 1), 0) + textureLoad(t, p + vec2i(1, 1), 0)) * .25;
}
@fragment fn fs(@builtin(position) pos: vec4f) -> Out {
	let p = vec2i(pos.xy) * 2;
	return Out(box(D, p), box(S, p));
}
