// displacement (lDx, Dy, lDz), slope (sx, sz, sx², sz²): slope mips give mean + second moment (LEAN)
uniform highp sampler2D uIn0, uIn1; uniform int uCascade; uniform float uLambda;
layout(location = 0) out vec4 oD; layout(location = 1) out vec4 oS;
void main(){
	ivec2 id = ivec2(gl_FragCoord.xy), p = id + ivec2(0, uCascade * N);
	float s = (id.x + id.y) % 2 == 0 ? 1. : -1.; // undo the centred-k frequency shift
	vec4 a = texelFetch(uIn0, p, 0) * s, b = texelFetch(uIn1, p, 0) * s; // Dx Dz Dy Dxz, Dyx Dyz Dxx Dzz
	float dxx = uLambda * b.z, dzz = uLambda * b.w;
	vec2 sl = b.xy / max(vec2(1. + dxx, 1. + dzz), vec2(.2));
	oD = vec4(uLambda * a.x, a.z, uLambda * a.y, 0.);
	oS = vec4(sl, sl * sl);
}
