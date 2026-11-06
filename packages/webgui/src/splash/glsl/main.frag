#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 R; uniform float T, L, D, F, CZ, MZ; uniform vec3 P;
const float EH = 3.43; // eye height (m)
// MZ: morning mist / dusk aerial amount 0..1 (0 = clear air)
// time-of-day sky: zenith/horizon colour, sun colour (x intensity), key light dir/colour, portal tint
uniform vec3 ZC, HC, SC, KD, KC, PT;
uniform vec4 SP, MP; // sun px xy, sun vis, twilight warmth; moon px xy, moon light, stars
// ocean G-buffer (FFT surface pass): G0 = slope xz, roughness alpha^2, ray distance (0: no water); G1.y = height (no Jacobian foam: this calm sea never folds)
uniform sampler2D G0, G1;
vec4 GA, GB;
// scene parameters (the prototype panel's shipped values)
const vec3 LAC = vec3(.88, .23, .1); // lacquer colour
const vec3 GT = vec3(.22, .18, .15); // gloss lacquer, kasagi, black base
const vec4 STU = vec4(.985, .5, 4., .33); // star threshold, twinkle rate min / max, steady fraction
const vec3 VC = vec3(.957, .949, .933); // flash veil colour
const vec3 WP = vec3(.01, .5, .1); // glint strength, object reflectance floor, reflection ripple tilt
const vec2 TQ = vec2(.25, .6); // water body tropical lean; sun reflection
// mid/low sun after sunrise and before sunset (not noon, not the dusk/dawn horizon): 0..1 from the sun's height
float sunMid(){ float e = (L - SP.y) / (1.6 * L); return smoothstep(.04, .2, e) * smoothstep(.9, .45, e); }
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
	return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float h1(float i){ return fract(sin(i * 127.1) * 43758.5453); }
float lnz(float x){ float i = floor(x); return mix(h1(i), h1(i + 1.), fract(x)); }
vec3 sky(vec2 p, float sun){
	float hgt = max(L - p.y, 0.), ys = clamp(hgt / L, 0., 1.);
	vec3 c = mix(HC, ZC, pow(ys, .55));
	vec2 ds = (p - SP.xy) / R.y, dm = (p - MP.xy) / R.y;
	float sd = length(ds), md = length(dm);
	// dawn/dusk band: warm near the sun azimuth, along the horizon
	c += SC * SP.w * exp(-ys * 5.) * exp(-abs(ds.x) * 2.2) * .55;
	// sun: disc, glow, Mie halo
	// (halo terms a little softer for a mid/low sun)
	c += SC * SP.z * sun * (smoothstep(.016, .012, sd) * 1.2 + (exp(-sd * 14.) * .45 + exp(-sd * 3.) * .16) * (1. - .3 * sunMid()));
	// stars: visibility from one hash, brightness/twinkle from independent hashes; a third stay steady
	if (MP.w > 0. && sun > 0.) {
		vec2 cl = floor(p / 5.), sp = cl * 5. + 1. + 3. * vec2(h21(cl + 7.), h21(cl + 3.));
		float hs = h21(cl), ha = h21(cl + 17.3), hb = h21(cl + 29.1), hc = h21(cl + 41.7);
		float tw = step(STU.w, hb) * (.2 + .45 * hc) * (.5 + .5 * sin(T * (STU.y + (STU.z - STU.y) * ha) + hb * 43.));
		float st = step(STU.x, hs) * smoothstep(1.2, .2, length(p - sp)) * (.35 + .75 * hc * hc) * (1. - tw);
		c += vec3(.9,.93,1.) * st * MP.w * smoothstep(.02, .25, ys);
	}
	// moon
	c += vec3(.93,.95,1.) * MP.z * 3. * sun * (smoothstep(.012, .009, md) * 1.6 + exp(-md * 30.) * .45 + exp(-md * 6.) * .22);
	// aerial perspective: a thin band at the horizon, thicker only in morning mist
	float hz = exp(-hgt / (R.y * mix(.035, .26, MZ)));
	c = mix(c, HC, hz * (.12 + .23 * MZ));
	return c;
}
// REF: 1 while shading a rock seen in the water. Its mirrored silhouette shows the rock's sides and top
// bevel edge-on, so the view-dependent rim and the salt-bleached tops would draw a light outline there
float REF = 0.;
vec3 light(vec3 n, vec3 alb, float gl){
	float df = max(dot(n, KD), 0.);
	float sp = pow(max(dot(n, normalize(KD + vec3(0,0,1))), 0.), 36.) * gl;
	float am = .62 + .25 * (-n.y);
	vec3 amb = mix(HC, ZC, .6) * .8;
	// grazing rim tinted by the albedo: an untinted rim lit every face whose normal is perpendicular to the view (grey undersides)
	return alb * (amb * am + KC * df + KC * pow(1. - abs(n.z), 3.) * .5 * (1. - REF)) + (KC * 1.4 + amb * .2) * sp;
}
// World: metres, y up, z away from the camera, water at y 0, gate plane z 0, opening centred on x 0.
// Gate = logo path at .4 m per icon unit (icon x 29 -> x 0, icon y 56 -> y 0).
vec3 N; float M, G, AA, TA, T0, FP, HIT, RI, AM, ARI;
float sdB(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
// tapered round post: inner face stays at |x| 1.2 (the opening), outer face tapers 1.42 -> 1.2 m radius
float post(vec3 p, float s, float y0){
	float r = mix(1.42, 1.2, clamp(p.y / 12.9, 0., 1.));
	float dr = (length(vec2(p.x - s * (1.2 + r), p.z)) - r) * .97, dy = abs(p.y - (y0 + 13.4) * .5) - (13.4 - y0) * .5;
	return length(max(vec2(dr, dy), 0.)) + min(max(dr, dy), 0.);
}
// pi: two posts, lacquered shimaki band 12.8..15.2, black kasagi with a gentle upward sweep to rounded tips
float gd(vec3 p){
	float a = min(post(p, -1., 2.), post(p, 1., -.5));
	float b = sdB(p - vec3(1.2, 14., 0.), vec3(7.2, 1.2, 1.5), .22);
	float x = p.x - 1.2, f = smoothstep(4.5, 7.7, abs(x));
	float c = sdB(vec3(x, p.y - 15.62 - .003 * x * x - .275 * f * f, p.z), vec3(7.7, .42 + .06 * f, 1.9), .2) * .85;
	G = c < min(a, b) ? 3. : a < b - .04 ? 1. : 2.;
	return min(smin(a, b, .3), c);
}
vec3 nrm(vec3 p){
	const vec2 k = vec2(1., -1.) * .015;
	return normalize(k.xyy * gd(p + k.xyy) + k.yyx * gd(p + k.yyx) + k.yxy * gd(p + k.yxy) + k.xxx * gd(p + k.xxx));
}
// raymarch only inside the gate's AABB, <= 48 steps; aa: record closest miss for edge coverage
float gTrace(vec3 ro, vec3 rd, float t, bool aa){
	vec3 iv = 1. / rd, t0 = (vec3(-6.8, -.6, -2.) - ro) * iv, t1 = (vec3(9.2, 16.7, 2.) - ro) * iv, mn = min(t0, t1), mx = max(t0, t1);
	float tn = max(max(mn.x, mn.y), mn.z), tf = min(min(min(mx.x, mx.y), mx.z), t);
	if (tf < max(tn, 0.)) return t;
	float s = max(tn, 0.), pf = 1. / (F * D), mr = 1e9, ms = 0.;
	for (int i = 0; i < 48; i++) {
		vec3 p = ro + rd * s;
		float d = gd(p), e = (s + T0) * pf;
		if (d < e * .1) { M = G; N = nrm(p); return s; }
		if (aa && d < mr * e) { mr = d / e; ms = s; }
		s += d;
		if (s > tf) break;
	}
	if (aa && .5 - mr > AA) { AA = .5 - mr; TA = ms; AM = 0.; }
	return t;
}
// eroded sea rocks: SDF = ellipsoid (+ plinth under the left post) displaced by lumpy + ridged fbm
float h31(vec3 p){ p = fract(p * .3183099 + .1) * 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
	return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
		mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
void rp(float i, out vec3 c, out vec3 r){
	if (i < .5) { c = vec3(-3.2, 0., .2); r = vec3(2., 4.4, 2.7); }       // rock under the left leg
	else if (i < 1.5) { c = vec3(24., 0., 70.); r = vec3(3.4, 1.9, 2.6); } // small rocks right, far
	else { c = vec3(27.6, 0., 72.); r = vec3(1.6, 1., 1.4); }
}
float RKS = .7; // step factor of the last rk() branch (its Lipschitz bound)
// SM: cheap rock mode for the portal's blurred samples (flash + radial blur hide it): no ridged octaves,
// longer steps, <= 16 steps; rock pixels themselves never reach the samples (the undisturbed view is kept there)
float SM = 0.;
// e: pixel footprint (m) at p; octaves whose period drops under ~2 px fade to their mean (LOD, no shimmer)
float rk(vec3 p, float i, float e){
	vec3 c, r; rp(i, c, r);
	vec3 q = p - c; float s = min(r.x, min(r.y, r.z));
	float k0 = length(q / r), d = k0 * (k0 - 1.) / length(q / (r * r));
	float fade = 1.;
	if (i < .5) {
		// plinth the post stands on; displacement fades toward the post foot so no pit opens under it
		float pr = length(p.xz - vec2(-2.62, 0.));
		d = smin(d, max(pr - 1.3, abs(p.y - .9) - 1.4), .7);
		fade = mix(smoothstep(1.1, 1.7, pr), 1., smoothstep(1.4, .6, p.y));
	}
	// displacement is bounded by .29 s: far from the surface return a safe bound without any noise (1-Lipschitz: full step)
	RKS = 1.;
	if (d > s * .35) return d - s * .3;
	RKS = .7;
	vec3 u = q * (2.2 / s) + i * 17.;
	// big lumps break the ellipsoid silhouette; ridged octaves carve eroded grooves and pits
	float lump = (n3(u * .35) - .5) * .9 + (n3(u * .8 + 5.) - .5) * .45;
	d -= s * lump * .32;
	RKS = .69; // marks the detailed branch: only its distance is a true surface distance
	if (d > s * .12) return d - s * .08;
	RKS = .7;
	// octave k has a period of s / (2.2 (1.6 + 1.9 k)) m; ex: pixels per unit octave frequency
	// reflection rays (T0 > 0) see the rock through ripples and desaturation: fine octaves drop 4x earlier
	float rg = 0., a = .5, ex = s / (2.2 * max(e, 1e-4)) / (T0 > 0. ? 4. : 1.) * (1. - SM);
	for (int k = 0; k < 3; k++) {
		float fr = 1.6 + float(k) * 1.9, w = smoothstep(1.5, 3., ex / fr);
		if (w <= 0.) { rg += .514 * (2. * a - .125); break; } // remaining octaves at their mean
		float n = 1. - abs(2. * n3(u * fr + float(k) * 3.1) - 1.);
		rg += a * mix(.514, n * n, w); u = u.yzx; a *= .5;
	}
	d -= s * (rg - .45) * .16 * fade;
	return d;
}
// tetrahedron offsets (1,-1,-1), (-1,-1,1), (-1,1,-1), (1,1,1) in a loop: one inlined copy of rk() instead of four
vec3 rnrm(vec3 p, float i, float h){
	vec3 n = vec3(0.);
	for (int j = 0; j < 4; j++) {
		vec3 k = (vec3(1 - ((j ^ (j >> 1)) & 1), (j >> 1) & 1, j & 1) * 2. - 1.) * h;
		n += k * rk(p + k, i, h);
	}
	return normalize(n);
}
// raymarch one rock inside its bounds, <= 40 steps, step scaled for the displacement's Lipschitz bound
// bounds: box = ellipsoid + displacement (.3 s) clipped to the water, intersected with the ellipsoid scaled by 1.35
// (contains the .3 s offset surface); the left rock's plinth lies inside both
float rTrace(vec3 ro, vec3 rd, float t, bool aa, float i){
	vec3 c, r; rp(i, c, r);
	vec3 m = r + min(r.x, min(r.y, r.z)) * .3 + .05, lo = c - m, hi = c + m; lo.y = -.05;
	vec3 iv = 1. / rd, t0 = (lo - ro) * iv, t1 = (hi - ro) * iv, mn = min(t0, t1), mx = max(t0, t1);
	float tn = max(max(mn.x, mn.y), mn.z), tf = min(min(min(mx.x, mx.y), mx.z), t);
	if (tf < max(tn, 0.)) return t;
	vec3 eo = (ro - c) / (r * 1.35), ed = rd / (r * 1.35);
	float ea = dot(ed, ed), eb = dot(eo, ed), ec = dot(eo, eo) - 1., eh = eb * eb - ea * ec;
	if (eh < 0.) return t;
	eh = sqrt(eh);
	tn = max(tn, (-eb - eh) / ea); tf = min(tf, (-eb + eh) / ea);
	if (i < .5) {
		// the left post is solid inside a vertical cylinder (x -2.5, r 1.05, y 2.05..12.9): nothing behind its entry is visible
		vec2 co = ro.xz - vec2(-2.5, 0.), cd = rd.xz;
		float ca = dot(cd, cd), cb = dot(co, cd), ch = cb * cb - ca * (dot(co, co) - 1.1025);
		if (ch > 0.) { float tc = (-cb - sqrt(ch)) / ca, yc = ro.y + rd.y * tc; if (tc > 0. && yc > 2.05 && yc < 12.9) tf = min(tf, tc); }
	}
	if (tf < max(tn, 0.)) return t;
	float s = max(tn, 0.), pf = 1. / (F * D), mr = 1e9, ms = 0., d = 1e9;
	for (int k = 0; k < 40; k++) {
		if (SM > .5 && k >= 16) break;
		vec3 p = ro + rd * s;
		float e = (s + T0) * pf; d = rk(p, i, e);
		if (d < e * .12) break;
		// only the detailed branch measures the true distance; the bound branches underestimate it and would fake a near miss
		if (aa && RKS == .7 && d < mr * e) { mr = d / e; ms = s; }
		s += d * min(1., RKS * (1. + SM * .3));
		if (s > tf) break;
	}
	// converged, or out of steps while still creeping along the surface (grazing rays): a hit, not a hole
	if (s <= tf && d < .02 + (s + T0) * pf) { vec3 p = ro + rd * s; M = 4.; RI = i; N = rnrm(p, i, max(.02, (s + T0) * pf)); return s; }
	// coverage ramps from 1 px outside the silhouette to the hit threshold, so hit and miss pixels meet without a step
	float cv = smoothstep(1., .12, mr);
	if (aa && cv > AA) { AA = cv; TA = ms; AM = 4.; ARI = i; }
	return t;
}
// edge-AA sample: restore normal + material of whichever surface recorded the coverage
void aaN(vec3 q, float t){ if (AM > 3.5) { M = 4.; RI = ARI; N = rnrm(q, RI, max(.02, (t + T0) / (F * D))); } else { N = nrm(q); M = G; } }
float trace(vec3 ro, vec3 rd, bool aa){
	float t = 1e9;
	// a loop, not three calls: each call site is another inlined copy of the raymarch for the compiler
	for (int i = 0; i < 3; i++) t = rTrace(ro, rd, t, aa, float(i));
	return gTrace(ro, rd, t, aa);
}
vec3 shade(vec3 q){
	vec3 n = N, alb; float g = .3;
	if (M < 3.5) {
		// wood under lacquer: fibres along the member, growth rings warped by noise (TSL "wood" in spirit)
		vec2 gc = M < 1.5 ? vec2(atan(q.z, q.x - sign(q.x) * 2.5) * 1.6, q.y * .3) : vec2(q.z * 2.2 + q.y * 1.6, q.x * .22);
		float fib = vn(vec2(gc.x * 9., gc.y * 2.)), grain = mix(fib, .5 + .5 * sin(gc.x * 11. + gc.y * 3. + vn(gc * vec2(2., 5.)) * 6.), .45);
		// edge distance: beams by box faces, posts only near the top joint
		vec3 s = M < 2.5 ? vec3(7.2, 1.2, 1.5) - abs(q - vec3(1.2, 14., 0.)) : vec3(7.7, .42, 1.9) - abs(q - vec3(1.2, 15.62, 0.));
		float e = M < 1.5 ? 12.9 - q.y : s.x + s.y + s.z - max(s.x, max(s.y, s.z)) - min(s.x, min(s.y, s.z));
		// wear: fine, subtle, faded out once a pixel covers more than a few cm (no blotches at distance)
		float hf = smoothstep(.06, .015, FP);
		float wear = smoothstep(.8, .98, vn(q.xy * vec2(3.6, 1.8) + q.z * 3.) * .7 + vn(q.xy * 14. + q.z) * .3 * hf + (1. - smoothstep(0., .2, e)) * .3) * mix(.25, .6, hf);
		n = normalize(n + (fib - .5) * .035 * (1. - wear));
		// weathering: broad patches drift between sun-bleached orange-pink and deeper red
		float pv = vn(q.xy * vec2(.35, .18) + q.z * .3) * .65 + vn(q.xy * vec2(1.1, .5) + 9.) * .35;
		alb = mix(LAC * vec3(.9, .85, .9), mix(LAC, vec3(.85,.55,.45), .35), pv) * (.9 + .15 * grain);
		// soft occlusion where the posts meet the band (posts near the top, band underside near the posts)
		float jd = M < 1.5 ? 12.8 - q.y : q.y - 12.8 + max(min(abs(q.x + 2.5), abs(q.x - 2.5)) - 1.3, 0.);
		alb *= mix(.8, 1., smoothstep(0., 1.4, jd));
		alb = mix(alb, mix(vec3(.36,.15,.09), vec3(.5,.24,.14), grain), wear * .35);
		g = mix(GT.x, .06, wear);
		if (M < 1.5) {
			alb *= mix(.9, 1., smoothstep(12.8, 11., q.y));
			float yb = q.x < 0. ? 3.3 : 1.7, bk = smoothstep(yb + .12, yb - .05, q.y + (vn(q.xz * 6.) - .5) * .08);
			alb = mix(alb, vec3(.045,.042,.04) * (.8 + .4 * fib), bk); g = mix(g, GT.z, bk);
		}
		if (M > 2.5) { alb = mix(vec3(.06,.058,.06) * (.85 + .3 * vn(vec2(q.x * 3., q.z * 4.))), vec3(.17,.16,.15), wear * .4); g = GT.y; }
	} else {
		// crevice AO: two SDF probes along the normal
		float oc = (.15 - rk(q + n * .15, RI, FP)) / .15 + (.6 - rk(q + n * .6, RI, FP)) / .6 * .5;
		float ao = clamp(1. - oc * .6, .25, 1.);
		float hf = smoothstep(.08, .02, FP);
		vec3 b = vec3(vn(q.xy * 3.), vn(q.yz * 3. + 7.), vn(q.zx * 3. + 13.)) - .5;
		if (hf > 0.) b += (vec3(vn(q.xy * 9.), vn(q.yz * 9. + 3.), vn(q.zx * 9. + 5.)) - .5) * .6 * hf;
		n = normalize(n + b * .5);
		float gr = vn(q.xz * 7. + q.y * 3.), mt = vn(q.xy * .9 + q.z * .7);
		// waterline: dark wet band with ragged top, algae in the lowest part, drier pale basalt above;
		// band heights scale with the rock's height (the left rock is the 4.4 m reference)
		vec3 rc, rr; rp(RI, rc, rr); float hs = rr.y / 4.4;
		float wl = (.5 + .4 * vn(q.xz * 1.4 + 3.)) * hs, wet = smoothstep(wl + .35 * hs, wl - .15 * hs, q.y);
		float alg = smoothstep(wl * .5 + .1 * hs, wl * .5 - .15 * hs, q.y) * (.6 + .4 * vn(q.xz * 4.));
		vec3 dry = mix(vec3(.17,.165,.16), vec3(.31,.29,.27), mt) * (.85 + .3 * gr);
		dry = mix(dry, vec3(.44,.43,.40), smoothstep(.5, .9, n.y) * .4 * (1. - REF)); // salt-bleached tops
		alb = mix(dry, vec3(.08,.08,.075) * (.8 + .4 * gr), wet);
		alb = mix(alb, vec3(.035,.06,.03), alg);
		alb *= mix(.45, 1., ao);
		g = mix(.04, .7, wet) * ao;
	}
	vec3 c = light(vec3(n.x, -n.y, -n.z), alb, g);
	// downward faces: soft occlusion (deepest toward the beam centre line), sheen kept off so the lacquer stays red
	float dn = max(-n.y, 0.) * step(M, 3.5);
	c *= 1. - dn * (.2 + .15 * smoothstep(1.6, 0., abs(q.z)));
	c += alb * mix(HC, vec3(1.), .5) * dn * .18; // warm lacquer bounce off the water
	// lacquer clearcoat: faint sky sheen, strongest at grazing angles
	if (M < 3.5) c += mix(HC, ZC, .5) * g * (.02 + .1 * pow(1. - abs(n.z), 4.)) * (1. - dn);
	if (M > 3.5) c = mix(c, mix(HC, ZC, .4) * 1.1 + .15, smoothstep(.22, .04, q.y) * (.5 + .4 * lnz(q.x * 8. + T)) * .6);
	return c;
}
vec3 bgd(vec2 p, vec3 ro, vec3 rd, vec3 mc, float tw, float to, float ra, float rt);
// the water's mirror ray for the gate/rock reflection, off a flattened normal (see bgd)
vec3 mirror(vec3 rd){
	float kr = WP.z * R.y / F;
	vec3 rr = reflect(rd, normalize(vec3(-GA.x * kr, 1., -GA.y * kr)));
	rr.y = max(rr.y, 1e-4);
	return rr;
}
// tropical lagoon: turquoise body over deep sand (much less absorption than their open ocean), turquoise crest SSS
const vec3 SCAT = vec3(.05, .40, .42);
// aerial perspective: clear air (~1% at 60 m), thicker in morning mist
vec3 haze(vec3 c, vec3 mc, float t){ return mix(c, mc, 1. - exp(-t * mix(1. / 6000., 1. / 450., MZ))); }
vec3 scene(vec2 p){
	vec3 ro = vec3(0., EH, CZ), rd = normalize(vec3((p.x - R.x * .5) / F, (L - p.y) / F, 1.));
	vec3 mc = sky(vec2(p.x, L - 6.), 0.); // horizon mist
	AA = 0.; T0 = 0.; HIT = 0.;
	GA = texture(G0, vec2(p.x, R.y - p.y) / R); GB = texture(G1, vec2(p.x, R.y - p.y) / R);
	float tw = GA.w > 0. ? GA.w : 1e9, t = 1e9, to = 1e9, ra = 0., rt = 0.;
	// pass 0 traces the view ray, pass 1 the water's mirror ray: one trace() call site, as every call
	// site is another inlined copy of all the raymarches for the shader compiler
	vec3 o = ro, dr = rd;
	float a0 = 0., ta0 = 0.;
	for (int k = 0; k < 2; k++) {
		float th = trace(o, dr, true);
		if (k == 1) { to = th; ra = AA; rt = TA; T0 = 0.; AA = a0; TA = ta0; break; }
		t = th; a0 = AA; ta0 = TA;
		if (t < tw || tw > 1e8) break;
		o = ro + rd * tw; dr = mirror(rd); AA = 0.; T0 = tw;
	}
	float a = AA, ta = TA;
	vec3 col;
	// pass 0: the surface hit (or the water/sky); pass 1, edge AA: blend the gate colour at the closest
	// approach by its pixel coverage, over a surface hit only for a silhouette in front of another surface
	// (rock edge over the post). One shade() call site: every call site is another inlined copy
	for (int k = 0; k < 2; k++) {
		float d = t;
		if (k == 0) {
			if (t >= tw) { HIT = ta < tw ? a : 0.; col = bgd(p, ro, rd, mc, tw, to, ra, rt); continue; }
			HIT = 1.;
		} else {
			if (a <= 0. || ta >= (t < tw ? t - .3 : tw)) break;
			d = ta;
			aaN(ro + rd * ta, ta);
		}
		FP = d / F;
		vec3 c = haze(shade(ro + rd * d), mc, d);
		col = k == 0 ? c : mix(col, c, a);
	}
	return col;
}
// ---- water shading: Ultra-Water OceanSurface.js (MIT, Copyright (c) 2026 Humpalumps; notice in the script below),
// open-ocean subset: no refraction/shore/caustics; our sky() stands in for their sky cube and planar reflection
const float PI = 3.14159265;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// Poisson count with mean lam from one uniform number (normal approximation for large means)
float poisson(float lam, float u){
	if (lam > 6.) return max(0., lam + sqrt(lam) * log(u / (1. - u)) / 1.702);
	float pk = exp(-lam), cf = pk, n = 0.;
	for (int k = 0; k < 14; k++) { if (u <= cf) break; n += 1.; pk *= lam / n; cf += pk; }
	return n;
}
// GGX lobe, alpha floored so the source acts as a small area light; y: facet density term for the glints
vec2 ggx(vec3 n, vec3 v, vec3 l, float a){
	a = max(a, .015); float a2 = a * a;
	vec3 h = normalize(l + v);
	float nh = max(dot(n, h), 0.), nl = max(dot(n, l), 0.), nv = max(dot(n, v), 1e-4), vh = max(dot(v, h), 0.);
	float dd = nh * nh * (a2 - 1.) + 1., dg = a2 / (PI * dd * dd);
	float vis = .5 / (nl * sqrt(nv * nv * (1. - a2) + a2) + nv * sqrt(nl * nl * (1. - a2) + a2) + 1e-5);
	return vec2(PI * dg * vis * (.02 + .98 * pow(1. - vh, 5.)) * nl, dg * nh * 6.8e-5 / (4. * max(vh, .05)));
}
vec3 pdir(vec2 q){ return normalize(vec3((q.x - R.x * .5) / F, (L - q.y) / F, 1.)); }
vec3 bgd(vec2 p, vec3 ro, vec3 rd, vec3 mc, float tw, float to, float ra, float rt){
	if (tw > 1e8) return mix(sky(p, 1.), mc, exp(-(L - p.y) / (R.y * .012)) * (.15 + .35 * MZ));
	vec3 W = ro + rd * tw, v = -rd;
	vec3 n = normalize(vec3(-GA.x, 1., -GA.y));
	float al = sqrt(GA.z), nv = max(dot(n, v), 1e-4);
	// Fresnel with roughness-aware F90 (Lagarde) at 30% strength: a calm sea's far field mirrors the light sky
	float f90 = mix(1., max(1. - .7 * sqrt(al), .02), .3), fr = .02 + (f90 - .02) * pow(1. - nv, 5.);
	// sky in the reflected direction (sun/moon discs come from the GGX lobes)
	vec3 sv = reflect(rd, n); sv.y = abs(sv.y);
	float sz = max(sv.z, .3);
	vec3 refl = sky(vec2(R.x * .5 + sv.x / sz * F, min(L - sv.y / sz * F, L - .5)), 0.);
	// gate/rocks: their planar reflection is read with a small screen offset along the normal's tilt
	// (uOptics.z .04 of the view); the same offset as a mirrored ray off a flattened normal. Its Fresnel uses
	// that normal and no F90 cut (theirs: full normal, roughness F90), or the crest backs facing the camera
	// (F < .1) and the rough mid-field erase the gate
	float kr = WP.z * R.y / F;
	// (traced by scene(): to, ra, rt)
	vec3 nf = normalize(vec3(-GA.x * kr, 1., -GA.y * kr)), rr = mirror(rd), oc = vec3(0.);
	float fo = .02 + .98 * pow(1. - max(dot(nf, v), 1e-4), 5.);
	float cov = to < 1e8 ? 1. : ra;
	if (cov > 0.) {
		float ts = to < 1e8 ? to : rt;
		vec3 oq = W + rr * ts;
		if (to >= 1e8) aaN(oq, tw + ts);
		FP = (tw + ts) / F;
		REF = step(3.5, M); oc = shade(oq); REF = 0.;
	}
	vec3 sd = pdir(SP.xy), md = pdir(MP.xy);
	vec3 sun = SC * SP.z, moon = vec3(.8,.85,.95) * MP.z;
	float nl = dot(n, sd);
	// body lit by this sky: the sky light (zenith/horizon mix, plus the sun) filtered by the water column, which
	// absorbs red first, so a blue noon sky gives a clear blue-green sea, a warm dawn a dim warm-green one and the
	// night a near-black blue; TQ.x leans it toward the old turquoise at the same luminance
	vec3 skl = mix(ZC, HC, .45) * mix(.6, 1.05, SP.z * smoothstep(.1, .5, sd.y)) + sun * max(sd.y, 0.) * .2;
	// (at dawn/dusk the low light reaches the eye through little water: a flatter filter keeps the sky's warmth)
	vec3 sea = skl * mix(vec3(.22, .52, .62), vec3(.46, .42, .42), SP.w * .85);
	vec3 ins = mix(sea, vec3(.10, .55, .60) * dot(skl, vec3(.3,.5,.2)), TQ.x) + vec3(.004,.01,.025);
	float k1 = 1.6 * max(GB.y, 0.) * pow(clamp(dot(sd, rd), 0., 1.), 4.) * pow(.5 - .5 * nl, 3.);
	vec3 body = ins + ((k1 + .06 * nv * nv) + .05 * max(nl, 0.)) * SCAT * sun;
	vec2 gs = ggx(n, v, sd, al), gm = ggx(n, v, md, al);
	// glitter: the lobe as a finite number of sub-pixel facets (Poisson count per cell, twinkling). Cells are fixed
	// 6 CSS px squares on screen (world-space cells were stretched by the grazing view into slivers); each cell's
	// facets light one soft round dot (radius ~1.2 device px) at a hashed spot. Expected count lam = facet density x
	// the cell's world footprint (6 tw/F across, that over the grazing sine along); dot weight x cell area / dot area
	// keeps the mean brightness of the lobe. Dense cells (lobe core) fade to the plain lobe.
	float wsp = gs.x * dot(sun, vec3(1.)) + gm.x * dot(moon, vec3(1.));
	if (wsp > .02) {
		const float S = 6.;
		float ax = tw / F, rp = 1.2 / D, per = 2e4 * max(gs.y, gm.y);
		vec2 cl = floor(p / S);
		float lam = per * S * ax * S * ax / max(-rd.y, .01), tt = T * 3. + h12(cl + 17.17) * 64., it = floor(tt);
		float n0 = poisson(lam, clamp(h12(cl * 1.31 + it * 3.7), 1e-4, .9999));
		float n1 = poisson(lam, clamp(h12(cl * 1.31 + (it + 1.) * 3.7), 1e-4, .9999));
		vec2 dp = (cl + .25 + .5 * vec2(h12(cl + 3.1), h12(cl + 7.7))) * S - p;
		// compact (1 - r²)² kernel, integral pi rp² / 3: zero past rp, so an over-bright dot cannot bloom
		float k2 = max(1. - dot(dp, dp) / (rp * rp), 0.), dotw = k2 * k2 * S * S * 3. / (3.1416 * rp * rp);
		float m = mix(mix(n0, n1, smoothstep(0., 1., tt - it)) / max(lam, 1e-4) * dotw, 1., smoothstep(6., 24., lam));
		// (theirs: .6 from 4..30 m; at full strength from the camera on, the calm sea's lobe breaks into sparkles)
		float gk = mix(1., min(m, 400.), WP.x);
		gs.x *= gk; gm.x *= gk;
	}
	// objects keep a reflectance floor (as in the main file, .82 there) so the lacquer reads over the turquoise
	// sun path at a mid/low sun: radiance x TQ.y and a soft shoulder (s / (1 + s / .9)) so it keeps ripple texture
	// instead of clipping to a white band; noon and the horizon sun at dawn/dusk are unchanged
	float smd = sunMid();
	vec3 sp = sun * gs.x * mix(1., TQ.y, smd);
	sp = mix(sp, sp / (1. + sp / .9), smd);
	vec3 col = mix(mix(body, refl, fr), oc, max(fo, WP.y) * cov) + sp + moon * gm.x;
	return mix(col, mc, 1. - exp(-tw * mix(1. / 4000., 1. / 600., MZ)));
}
void main(){
	vec2 p0 = vec2(gl_FragCoord.x, R.y*D - gl_FragCoord.y) / D;
	vec2 c = R * .5, vp = vec2(c.x, L);
	vec3 rd = vec3((p0.x - c.x) / F, (L - p0.y) / F, 1.);
	// where this pixel crosses the gate plane, in icon units
	vec2 u = vec2(29. + rd.x * -CZ / .4, 56. - (EH + rd.y * -CZ) / .4);
	bool portal = CZ < 0. && u.x > 26. && u.x < 32. && u.y > 24. && u.y < 56.;
	// portal membrane
	vec2 q = u - vec2(29., 40.), hz, dir, pp = p0;
	float r, ed, ei, ring;
	if (portal) {
		r = length(q / vec2(1., 1.7));
		ed = min(min(u.x - 26., 32. - u.x), u.y - 24.);
		// distortion stays clear of the band and posts so it never resamples their edges into the opening
		ei = min(min(u.x - 26.6, 31.4 - u.x), u.y - 26.5);
		float spd = 1.5 + P.y * 9.;
		ring = sin(r * 4.2 - T * spd) * exp(-r * .12) * smoothstep(0., .25, P.x) * smoothstep(0., .8, ei);
		hz = vec2(vn(u * 1.8 + vec2(0., T * .9)), vn(u * 1.8 + vec2(5.2, -T * .7))) - .5;
		dir = r > 1e-3 ? normalize(q) : vec2(0.);
	}
	// scene() has one call site (every call is inlined, so each extra site multiplies the compile time):
	// sample 0 is the undisturbed view, samples 1..n the portal's displaced views
	vec3 s0, acc = vec3(0.);
	float hc = 0.;
	int n = 0;
	for (int k = 0; k < 6; k++) {
		vec3 sk = scene(k == 0 ? p0 : P.y > 0. ? mix(pp, vp, float(k - 1) / 4. * P.y * .16) : pp);
		if (k == 0) {
			// the undisturbed view decides where the gate itself covers the pixel: no distortion or glow there
			s0 = sk;
			hc = HIT;
			// where the undisturbed view is kept anyway (surface hit, or the opening's rim) the samples would be discarded: skip them
			if (!portal || hc >= 1. || ei <= 0.) break;
			pp = p0 + (hz * (2. + 7. * sqrt(P.x)) + dir * ring * (2.5 + 4. * P.y)) * smoothstep(0., .8, ei) * (1. - hc);
			// a displaced sample that lands on the gate would smear the band edge into the opening: keep the undisturbed view there
			if (P.y > 0.) { n = 5; SM = 1.; } else if (pp == p0) break; else n = 1;
		} else {
			acc += mix(sk, s0, HIT);
			if (k == n) break;
		}
	}
	SM = 0.;
	vec3 col = s0;
	if (portal) {
		if (n > 0) col = acc / float(n);
		col = mix(col, s0, max(hc, 1. - smoothstep(0., .6, ei)));
		float w = .2 + sqrt(P.x) * .2;
		float ga = (.03 + sqrt(P.x) * .1 - P.y * .03);
		float fr = P.y * .25;
		vec3 glow = vec3(exp(-max(ed - fr, 0.) / w), exp(-ed / w), exp(-(ed + fr) / w)) * PT * smoothstep(0., .5, u.y - 24.) * (1. - hc);
		col += glow * max(ga, 0.) + ring * (.008 + .012 * P.x) * PT;
		col = mix(col, vec3(dot(col, vec3(.3, .55, .15))), P.x * .15 * (1. - P.z)) * (1. - P.x * .08 * (1. - P.z));
	} else {
		float lum = dot(col, vec3(.3, .55, .15));
		col = mix(col, vec3(lum), P.x * .35 * (1. - P.z));
		col *= 1. - P.x * .35 * (1. - P.z) * smoothstep(.25, .85, length((p0 - c) / R.y));
	}
	float fl = P.z;
	col = 1. - (1. - col) * (1. - fl * mix(PT, vec3(1.), .5));
	col = mix(col, VC, fl * fl * .6);
	fragColor = vec4(col, 1.);
}
