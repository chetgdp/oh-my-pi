// WGSL port of glsl/evolve.frag.
struct E { Length: vec4f, Time: f32 }
@group(0) @binding(0) var<uniform> u: E;
@group(0) @binding(1) var H0: texture_2d<f32>;
const LOOP = 300.0; // sim loop length (s): wave frequencies are quantised so the sea loops seamlessly
struct Out { @location(0) o0: vec4f, @location(1) o1: vec4f }
// two real fields packed as one complex spectrum: IFFT(A + iB) = a + ib
fn pack2(a: vec2f, b: vec2f) -> vec2f { return vec2f(a.x - b.y, a.y + b.x); }
@fragment fn fs(@builtin(position) pos: vec4f) -> Out {
	let p = vec2i(pos.xy);
	let c = p.y / N;
	let k = vec2f(vec2i(p.x, p.y - c * N) - N / 2) * (2. * PI / u.Length[c]);
	let kl = length(k);
	let ik = select(0., 1. / kl, kl > 1e-6);
	const W0 = 2. * PI / LOOP;
	// GLSL mod(): x - y * floor(x / y)
	let tm = u.Time - LOOP * floor(u.Time / LOOP);
	let ph = 2. * PI * fract(floor(omega(kl) / W0) * (tm / LOOP));
	let e = vec2f(cos(ph), sin(ph));
	let h0 = textureLoad(H0, p, 0);
	let h = cmul(h0.xy, e) + cmul(h0.zw, vec2f(e.x, -e.y));
	let ih = vec2f(-h.y, h.x);
	let dx = ih * k.x * ik;
	let dz = ih * k.y * ik;
	let dxdx = -h * k.x * k.x * ik;
	let dzdz = -h * k.y * k.y * ik;
	let dxdz = -h * k.x * k.y * ik;
	return Out(vec4f(pack2(dx, dz), pack2(h, dxdz)), vec4f(pack2(ih * k.x, ih * k.y), pack2(dxdx, dzdz)));
}
