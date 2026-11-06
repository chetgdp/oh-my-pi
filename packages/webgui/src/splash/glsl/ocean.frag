
uniform float uT;
in vec3 vW; in vec2 vXZ; in float vU;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
	return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + 1.), u.x), u.y); }
void main(){
	vec4 s0 = texture(uS0, vXZ / uLen.x), s1 = texture(uS1, vXZ / uLen.y), s2 = texture(uS2, vXZ / uLen.z), s3 = texture(uS3, vXZ / uLen.w);
	// wind slicks: surfactant patches damp the short waves, so the far field breaks into calm and rough streaks
	float slick = smoothstep(.3, .7, vnoise(vXZ * .006 + uT * .01)), sl2 = mix(.75, 1., slick), sl3 = mix(.4, 1., slick);
	s2.xy *= sl2; s2.zw *= sl2 * sl2; s3.xy *= sl3; s3.zw *= sl3 * sl3;
	vec2 sl = s0.xy + s1.xy + s2.xy + s3.xy;
	vec2 va = max(s0.zw - s0.xy * s0.xy, 0.) + max(s1.zw - s1.xy * s1.xy, 0.) + max(s2.zw - s2.xy * s2.xy, 0.) + max(s3.zw - s3.xy * s3.xy, 0.);
	vec3 n = normalize(vec3(-sl.x, 1., -sl.y));
	// geometric specular AA (Kaplanyan): normal change across the pixel adds variance
	vec3 dx = dFdx(n), dy = dFdy(n);
	float gv = min(.25 * (dot(dx, dx) + dot(dy, dy)), .18);
	float a2 = .0004 + vU * sl3 * sl3 + va.x + va.y + gv;
	o0 = vec4(sl, a2, length(vW - uCam));
	o1 = vec4(0., vW.y, 0., 1.);
}
