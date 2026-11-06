
uniform highp sampler2D uH0; uniform vec4 uLength; uniform float uTime;
const float LOOP = 300.0; // sim loop length (s): wave frequencies are quantised so the sea loops seamlessly
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1;
// two real fields packed as one complex spectrum: IFFT(A + iB) = a + ib
vec2 pack2(vec2 a, vec2 b){ return vec2(a.x - b.y, a.y + b.x); }
void main(){
	ivec2 p = ivec2(gl_FragCoord.xy); int c = p.y / N;
	vec2 k = vec2(ivec2(p.x, p.y - c * N) - N / 2) * (2. * PI / uLength[c]);
	float kl = length(k), ik = kl > 1e-6 ? 1. / kl : 0.;
	const float W0 = 2. * PI / LOOP;
	// omega quantised to multiples of 2pi/LOOP: the sim loops seamlessly, phase reduced before sin/cos
	float ph = 2. * PI * fract(floor(omega(kl) / W0) * (mod(uTime, LOOP) / LOOP));
	vec2 e = vec2(cos(ph), sin(ph));
	vec4 h0 = texelFetch(uH0, p, 0);
	vec2 h = cmul(h0.xy, e) + cmul(h0.zw, vec2(e.x, -e.y)), ih = vec2(-h.y, h.x);
	vec2 dx = ih * k.x * ik, dz = ih * k.y * ik;
	vec2 dxdx = -h * k.x * k.x * ik, dzdz = -h * k.y * k.y * ik, dxdz = -h * k.x * k.y * ik;
	o0 = vec4(pack2(dx, dz), pack2(h, dxdz));
	o1 = vec4(pack2(ih * k.x, ih * k.y), pack2(dxdx, dzdz));
}
