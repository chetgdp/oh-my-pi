
uniform vec4 uSpecA[2]; // scale, angle, spreadBlend, swell
uniform vec4 uSpecB[2]; // alpha, peakOmega, gamma, shortWavesFade
uniform vec4 uLength, uCut;
uniform float uCapFade;
uniform uint uSeed;
out vec4 o;
uvec2 pcg2d(uvec2 v){ v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u;
	v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; return v; }
vec2 gauss(ivec2 id, int c){
	uvec2 h = pcg2d(uvec2(id) + uvec2(uint(c) * 7919u, uint(c) * 104729u) + uSeed);
	float u1 = (float(h.x) + 1.) / 4294967296., u2 = float(h.y) / 4294967296.;
	return sqrt(-2. * log(u1)) * vec2(cos(2. * PI * u2), sin(2. * PI * u2));
}
float jonswap(float w, vec4 a, vec4 b){
	float wp = b.y, sg = w <= wp ? .07 : .09, r = exp(-(w - wp) * (w - wp) / (2. * sg * sg * wp * wp)), iw = 1. / w, q = wp * iw;
	return a.x * b.x * G * G * iw * iw * iw * iw * iw * exp(-1.25 * q * q * q * q) * pow(b.z, r);
}
float normalisation(float s){
	float s2 = s * s, s3 = s2 * s, s4 = s3 * s;
	if (s < 5.) return -.000564 * s4 + .00776 * s3 - .044 * s2 + .192 * s + .163;
	return -4.80e-08 * s4 + 1.07e-05 * s3 - 9.53e-04 * s2 + 5.90e-02 * s + 3.93e-01;
}
float directional(float th, float w, vec4 a, vec4 b){
	float x = w / b.y, s = x > 1. ? 9.77 * pow(x, -2.5) : 6.97 * pow(x, 5.);
	s += 16. * tanh(min(x, 20.)) * a.w * a.w;
	float t = th - a.y;
	return mix(2. / PI * cos(t) * cos(t), normalisation(s) * pow(abs(cos(.5 * t)), 2. * s), a.z);
}
vec2 h0(ivec2 id, int c){
	float L = uLength[c], dk = 2. * PI / L;
	vec2 k = vec2(id - N / 2) * dk;
	float kl = length(k), lo = c == 0 ? 1e-4 : uCut[c - 1], hi = c == 3 ? 1e4 : uCut[c];
	if (kl < lo || kl > hi) return vec2(0.);
	float w = omega(kl), dwdk = (G + 3. * ST * kl * kl) / (2. * w), th = atan(k.y, k.x), S = 0.;
	for (int i = 0; i < 2; i++) {
		if (uSpecA[i].x <= 0.) continue;
		float fade = c == 3 ? uCapFade : uSpecB[i].w;
		S += jonswap(w, uSpecA[i], uSpecB[i]) * directional(th, w, uSpecA[i], uSpecB[i]) * exp(-fade * fade * kl * kl);
	}
	return gauss(id, c) * sqrt(2. * S * dwdk / kl * dk * dk);
}
void main(){
	ivec2 p = ivec2(gl_FragCoord.xy); int c = p.y / N; ivec2 id = ivec2(p.x, p.y - c * N);
	vec2 a = h0(id, c), b = h0((N - id) % N, c);
	o = vec4(a, b.x, -b.y); // h0(k), conj(h0(-k))
}
