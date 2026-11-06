// Stockham radix-2 inverse FFT stage
uniform highp sampler2D uIn0, uIn1; uniform int uSub, uVertical;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1;
void main(){
	ivec2 p = ivec2(gl_FragCoord.xy);
	int i = uVertical == 1 ? p.y % N : p.x, hs = uSub >> 1, e = (i / uSub) * hs + (i & (hs - 1));
	ivec2 pe, po;
	if (uVertical == 1) { int base = p.y - i; pe = ivec2(p.x, base + e); po = ivec2(p.x, base + e + N / 2); }
	else { pe = ivec2(e, p.y); po = ivec2(e + N / 2, p.y); }
	float a = 2. * PI * float(i & (uSub - 1)) / float(uSub);
	vec2 tw = vec2(cos(a), sin(a));
	vec4 e0 = texelFetch(uIn0, pe, 0), q0 = texelFetch(uIn0, po, 0), e1 = texelFetch(uIn1, pe, 0), q1 = texelFetch(uIn1, po, 0);
	o0 = vec4(e0.xy + cmul(tw, q0.xy), e0.zw + cmul(tw, q0.zw));
	o1 = vec4(e1.xy + cmul(tw, q1.xy), e1.zw + cmul(tw, q1.zw));
}
