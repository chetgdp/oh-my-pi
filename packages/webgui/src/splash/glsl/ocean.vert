
layout(location=0) in vec2 a; // grid offset from the camera (m)
uniform vec4 uPr; // 2F/W, 2F/H, 1 - 2L/H (pinhole of the main shader), angular cell step
uniform float uWind, uIn, uRS;
out vec3 vW; out vec2 vXZ; out float vU;
void main(){
	vec2 xz = uCam.xz + a;
	float cell = max(length(a), uIn) * uPr.w;
	// displacement band-limited to the vertex spacing (+1 lod: box mips leak past Nyquist): no swimming
	vec3 lod = max(log2(cell * 256. / uLen.xyz) + 1., 0.);
	vec3 d = textureLod(uD0, xz / uLen.x, lod.x).xyz + textureLod(uD1, xz / uLen.y, lod.y).xyz + textureLod(uD2, xz / uLen.z, lod.z).xyz;
	// Cox-Munk mean square slope minus what the cascades carry (1x1 mips): sub-texel roughness
	vec4 m0 = textureLod(uS0, vec2(.5), 8.), m1 = textureLod(uS1, vec2(.5), 8.), m2 = textureLod(uS2, vec2(.5), 8.), m3 = textureLod(uS3, vec2(.5), 8.);
	// (Cox-Munk floor scaled with the spectrum, uRS = waveScale, so glass stays glass)
	vU = max((.003 + .00512 * uWind) * uRS - (m0.z + m0.w + m1.z + m1.w + m2.z + m2.w + m3.z + m3.w), 0.);
	vXZ = xz; vW = vec3(xz.x + d.x, d.y, xz.y + d.z);
	vec3 q = vW - uCam;
	gl_Position = vec4(uPr.x * q.x, uPr.z * q.z + uPr.y * q.y, (q.z * 100000.5 - 100000.) / 99999.5, q.z);
}
