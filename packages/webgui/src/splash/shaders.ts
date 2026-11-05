/**
 * Gate splash shaders (GLSL source strings), ported from the prototype
 * research/splash/h-water-full-glass.html with all defaults unchanged.
 */

/** Sim loop length (s): wave frequencies are quantised so the sea loops seamlessly. */
export const LOOP = 300;

// ---- Scene: sky, sun/moon, gate, rocks, water shading, portal (WebGL1-style GLSL) ----
export const FS = `precision highp float;
uniform vec2 R; uniform float T, L, D, F, CZ, EH, MZ; uniform vec3 P;
// MZ: morning mist / dusk aerial amount 0..1 (0 = clear air)
// time-of-day sky: zenith/horizon colour, sun colour (x intensity), key light dir/colour, portal tint
uniform vec3 ZC, HC, SC, KD, KC, PT;
uniform vec4 SP, MP; // sun px xy, sun vis, twilight warmth; moon px xy, moon light, stars
// ocean G-buffer (FFT surface pass): G0 = slope xz, roughness alpha^2, ray distance (0: no water); G1 = foam, height
uniform sampler2D G0, G1;
vec4 GA, GB;
// prototype panel parameters (defaults = the former constants, so the default render is unchanged)
uniform vec3 LAC;   // lacquer colour (.88,.23,.1)
uniform vec4 GT;    // gloss lacquer .22, kasagi .18, black base .15; weathering x1
uniform vec2 GT2;   // grain x1, kasagi curve lift x1
uniform vec4 RK[3]; // rock centre x, z, scale
uniform vec4 RS;    // erosion x1, wet band x1, algae x1, salt x1
uniform vec4 STU;   // star threshold .985, twinkle rate min .5 / max 4, steady fraction .33
uniform vec4 PO;    // portal ripple x1, rim light x1, radial blur x1, flash x1
uniform vec3 VC;    // flash veil colour (.957,.949,.933)
uniform vec4 WP;    // glint strength .95, object reflectance floor .78, reflection ripple tilt .014, crest SSS x1
uniform vec3 TQ;    // water body: tropical lean .25 (toward turquoise), body brightness x1; sun reflection .6
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
	float c = sdB(vec3(x, p.y - 15.62 - .003 * GT2.y * x * x - .275 * GT2.y * f * f, p.z), vec3(7.7, .42 + .06 * f, 1.9), .2) * .85;
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
	if (i < .5) { c = vec3(RK[0].x, 0., RK[0].y); r = vec3(2., 4.4, 2.7) * RK[0].z; }       // rock under the left leg
	else if (i < 1.5) { c = vec3(RK[1].x, 0., RK[1].y); r = vec3(3.4, 1.9, 2.6) * RK[1].z; } // small rocks right, far
	else { c = vec3(RK[2].x, 0., RK[2].y); r = vec3(1.6, 1., 1.4) * RK[2].z; }
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
	d -= s * lump * .32 * RS.x;
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
	d -= s * (rg - .45) * .16 * RS.x * fade;
	return d;
}
vec3 rnrm(vec3 p, float i, float h){
	vec2 k = vec2(1., -1.) * h;
	return normalize(k.xyy * rk(p + k.xyy, i, h) + k.yyx * rk(p + k.yyx, i, h) + k.yxy * rk(p + k.yxy, i, h) + k.xxx * rk(p + k.xxx, i, h));
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
	t = rTrace(ro, rd, t, aa, 0.);
	t = rTrace(ro, rd, t, aa, 1.);
	t = rTrace(ro, rd, t, aa, 2.);
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
		float wear = smoothstep(.8, .98, vn(q.xy * vec2(3.6, 1.8) + q.z * 3.) * .7 + vn(q.xy * 14. + q.z) * .3 * hf + (1. - smoothstep(0., .2, e)) * .3) * mix(.25, .6, hf) * GT.w;
		n = normalize(n + (fib - .5) * .035 * (1. - wear));
		// weathering: broad patches drift between sun-bleached orange-pink and deeper red
		float pv = vn(q.xy * vec2(.35, .18) + q.z * .3) * .65 + vn(q.xy * vec2(1.1, .5) + 9.) * .35;
		alb = mix(LAC * vec3(.9, .85, .9), mix(LAC, vec3(.85,.55,.45), .35), pv) * (.9 + .15 * GT2.x * grain);
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
		float wl = (.5 + .4 * vn(q.xz * 1.4 + 3.)) * hs, wet = smoothstep(wl + .35 * hs, wl - .15 * hs, q.y) * RS.y;
		float alg = smoothstep(wl * .5 + .1 * hs, wl * .5 - .15 * hs, q.y) * (.6 + .4 * vn(q.xz * 4.)) * RS.z;
		vec3 dry = mix(vec3(.17,.165,.16), vec3(.31,.29,.27), mt) * (.85 + .3 * gr);
		dry = mix(dry, vec3(.44,.43,.40), smoothstep(.5, .9, n.y) * .4 * RS.w * (1. - REF)); // salt-bleached tops
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
vec3 bgd(vec2 p, vec3 ro, vec3 rd, vec3 mc, float tw);
// tropical lagoon: turquoise body over deep sand (much less absorption than their open ocean), turquoise crest SSS
const vec3 SCAT = vec3(.05, .40, .42); const float SUNI = 1., MOONI = 1.;
// aerial perspective: clear air (~1% at 60 m), thicker in morning mist
vec3 haze(vec3 c, vec3 mc, float t){ return mix(c, mc, 1. - exp(-t * mix(1. / 6000., 1. / 450., MZ))); }
vec3 scene(vec2 p){
	vec3 ro = vec3(0., EH, CZ), rd = normalize(vec3((p.x - R.x * .5) / F, (L - p.y) / F, 1.));
	vec3 mc = sky(vec2(p.x, L - 6.), 0.); // horizon mist
	AA = 0.; T0 = 0.; HIT = 0.;
	GA = texture2D(G0, vec2(p.x, R.y - p.y) / R); GB = texture2D(G1, vec2(p.x, R.y - p.y) / R);
	float t = trace(ro, rd, true), tw = GA.w > 0. ? GA.w : 1e9;
	if (t < tw) {
		HIT = 1.; FP = t / F;
		float a = AA, ta = TA; vec3 col = haze(shade(ro + rd * t), mc, t);
		// silhouette in front of another surface (rock edge over the post): blend its coverage too
		if (a > 0. && ta < t - .3) { vec3 q = ro + rd * ta; aaN(q, ta); FP = ta / F; col = mix(col, haze(shade(q), mc, ta), a); }
		return col;
	}
	float a = AA, ta = TA;
	HIT = ta < tw ? a : 0.;
	vec3 col = bgd(p, ro, rd, mc, tw);
	// edge AA: blend the gate colour at the closest approach by its pixel coverage
	if (a > 0. && ta < tw) { vec3 q = ro + rd * ta; aaN(q, ta); FP = ta / F; col = mix(col, haze(shade(q), mc, ta), a); }
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
vec3 bgd(vec2 p, vec3 ro, vec3 rd, vec3 mc, float tw){
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
	vec3 nf = normalize(vec3(-GA.x * kr, 1., -GA.y * kr)), rr = reflect(rd, nf), oc = vec3(0.);
	float fo = .02 + .98 * pow(1. - max(dot(nf, v), 1e-4), 5.);
	rr.y = max(rr.y, 1e-4);
	AA = 0.; T0 = tw;
	float to = trace(W, rr, true), ra = AA, rt = TA;
	T0 = 0.;
	float cov = to < 1e8 ? 1. : ra;
	if (cov > 0.) {
		float ts = to < 1e8 ? to : rt;
		vec3 oq = W + rr * ts;
		if (to >= 1e8) aaN(oq, tw + ts);
		FP = (tw + ts) / F;
		REF = step(3.5, M); oc = shade(oq); REF = 0.;
	}
	vec3 sd = pdir(SP.xy), md = pdir(MP.xy);
	vec3 sun = SC * SP.z * SUNI, moon = vec3(.8,.85,.95) * MP.z * MOONI, amb = mix(ZC, HC, .4);
	float nl = dot(n, sd);
	// body lit by this sky: the sky light (zenith/horizon mix, plus the sun) filtered by the water column, which
	// absorbs red first, so a blue noon sky gives a clear blue-green sea, a warm dawn a dim warm-green one and the
	// night a near-black blue; TQ.x leans it toward the old turquoise at the same luminance, TQ.y scales it
	vec3 skl = mix(ZC, HC, .45) * mix(.6, 1.05, SP.z * smoothstep(.1, .5, sd.y)) + sun * max(sd.y, 0.) * .2;
	// (at dawn/dusk the low light reaches the eye through little water: a flatter filter keeps the sky's warmth)
	vec3 sea = skl * mix(vec3(.22, .52, .62), vec3(.46, .42, .42), SP.w * .85);
	vec3 ins = mix(sea, vec3(.10, .55, .60) * dot(skl, vec3(.3,.5,.2)), TQ.x) * TQ.y + vec3(.004,.01,.025);
	float k1 = 1.6 * max(GB.y, 0.) * pow(clamp(dot(sd, rd), 0., 1.), 4.) * pow(.5 - .5 * nl, 3.);
	vec3 body = ins + ((k1 + .06 * nv * nv) + .05 * max(nl, 0.)) * SCAT * WP.w * sun;
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
	// sun path at a mid/low sun: radiance x TQ.z and a soft shoulder (s / (1 + s / .9)) so it keeps ripple texture
	// instead of clipping to a white band; noon and the horizon sun at dawn/dusk are unchanged
	float smd = sunMid();
	vec3 sp = sun * gs.x * mix(1., TQ.z, smd);
	sp = mix(sp, sp / (1. + sp / .9), smd);
	vec3 col = mix(mix(body, refl, fr), oc, max(fo, WP.y) * cov) + sp + moon * gm.x;
	// Jacobian foam on folding crests (needs stronger wind than this calm sea; kept for completeness)
	if (GB.x > 0.) {
		float pat = vn(W.xz * 1.1) * .65 + vn(W.xz * .31 + .37) * .35;
		float cover = smoothstep(1.05 - GB.x, 1.3 - GB.x, pat) * sqrt(GB.x);
		vec3 fl = sun * (.15 + .85 * clamp(nl * .8 + .2, 0., 1.)) + amb * 1.1;
		col = mix(col, .72 * vec3(.93,.92,.88) * fl, cover * .9);
	}
	return mix(col, mc, 1. - exp(-tw * mix(1. / 4000., 1. / 600., MZ)));
}
void main(){
	vec2 p0 = vec2(gl_FragCoord.x, R.y*D - gl_FragCoord.y) / D;
	vec2 c = R * .5, vp = vec2(c.x, L);
	vec3 rd = vec3((p0.x - c.x) / F, (L - p0.y) / F, 1.);
	// where this pixel crosses the gate plane, in icon units
	vec2 u = vec2(29. + rd.x * -CZ / .4, 56. - (EH + rd.y * -CZ) / .4);
	vec3 col;
	if (CZ < 0. && u.x > 26. && u.x < 32. && u.y > 24. && u.y < 56.) {
		// portal membrane
		vec2 q = u - vec2(29., 40.);
		float r = length(q / vec2(1., 1.7));
		float ed = min(min(u.x - 26., 32. - u.x), u.y - 24.);
		// distortion stays clear of the band and posts so it never resamples their edges into the opening
		float ei = min(min(u.x - 26.6, 31.4 - u.x), u.y - 26.5);
		float spd = 1.5 + P.y * 9.;
		float ring = sin(r * 4.2 - T * spd) * exp(-r * .12) * smoothstep(0., .25, P.x) * smoothstep(0., .8, ei) * PO.x;
		vec2 hz = vec2(vn(u * 1.8 + vec2(0., T * .9)), vn(u * 1.8 + vec2(5.2, -T * .7))) - .5;
		vec2 dir = r > 1e-3 ? normalize(q) : vec2(0.);
		// the undisturbed view decides where the gate itself covers the pixel: no distortion or glow there
		vec3 s0 = scene(p0);
		float hc = HIT;
		vec2 off = (hz * (2. + 7. * sqrt(P.x)) + dir * ring * (2.5 + 4. * P.y)) * smoothstep(0., .8, ei) * (1. - hc);
		vec2 pp = p0 + off;
		// where the undisturbed view is kept anyway (surface hit, or the opening's rim) the samples would be discarded: skip them
		if (hc >= 1. || ei <= 0.) col = s0;
		else if (P.y > 0.) {
			vec3 acc = vec3(0.);
			// a displaced sample that lands on the gate would smear the band edge into the opening: keep the undisturbed view there
			SM = 1.;
			for (int k = 0; k < 5; k++) { vec3 sk = scene(mix(pp, vp, float(k) / 4. * P.y * .16 * PO.z)); acc += mix(sk, s0, HIT); }
			SM = 0.;
			col = acc / 5.;
		} else if (pp == p0) col = s0; else { col = scene(pp); col = mix(col, s0, HIT); }
		col = mix(col, s0, max(hc, 1. - smoothstep(0., .6, ei)));
		float w = .2 + sqrt(P.x) * .2;
		float ga = (.03 + sqrt(P.x) * .1 - P.y * .03) * PO.y;
		float fr = P.y * .25;
		vec3 glow = vec3(exp(-max(ed - fr, 0.) / w), exp(-ed / w), exp(-(ed + fr) / w)) * PT * smoothstep(0., .5, u.y - 24.) * (1. - hc);
		col += glow * max(ga, 0.) + ring * (.008 + .012 * P.x) * PT;
		col = mix(col, vec3(dot(col, vec3(.3, .55, .15))), P.x * .15 * (1. - P.z)) * (1. - P.x * .08 * (1. - P.z));
	} else {
		col = scene(p0);
		float lum = dot(col, vec3(.3, .55, .15));
		col = mix(col, vec3(lum), P.x * .35 * (1. - P.z));
		col *= 1. - P.x * .35 * (1. - P.z) * smoothstep(.25, .85, length((p0 - c) / R.y));
	}
	float fl = P.z * PO.w;
	col = 1. - (1. - col) * (1. - fl * mix(PT, vec3(1.), .5));
	col = mix(col, VC, fl * fl * .6);
	gl_FragColor = vec4(col, 1.);
}`;

/* Ocean: GPU Tessendorf FFT and water shading ported from Ultra-Water (src/water/OceanSim.js, OceanSurface.js),
 * https://github.com/Humpalumps/Ultra-Water @30ea65e
 *
 * MIT License
 *
 * Copyright (c) 2026 Humpalumps
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
export const COMMON = `#version 300 es
precision highp float; precision highp int;
#define N 256
#define PI 3.14159265359
#define G 9.81
#define ST 7.4e-5
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
float omega(float k){ return sqrt(G * k + ST * k * k * k); }
`;
export const QV = "#version 300 es\nlayout(location=0) in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
export const INIT =
	COMMON +
	`
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
}`;
export const EVOLVE =
	COMMON +
	`
uniform highp sampler2D uH0; uniform vec4 uLength; uniform float uTime;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1;
// two real fields packed as one complex spectrum: IFFT(A + iB) = a + ib
vec2 pack2(vec2 a, vec2 b){ return vec2(a.x - b.y, a.y + b.x); }
void main(){
	ivec2 p = ivec2(gl_FragCoord.xy); int c = p.y / N;
	vec2 k = vec2(ivec2(p.x, p.y - c * N) - N / 2) * (2. * PI / uLength[c]);
	float kl = length(k), ik = kl > 1e-6 ? 1. / kl : 0.;
	const float W0 = 2. * PI / ${LOOP.toFixed(1)};
	// omega quantised to multiples of 2pi/LOOP: the sim loops seamlessly, phase reduced before sin/cos
	float ph = 2. * PI * fract(floor(omega(kl) / W0) * (uTime / ${LOOP.toFixed(1)}));
	vec2 e = vec2(cos(ph), sin(ph));
	vec4 h0 = texelFetch(uH0, p, 0);
	vec2 h = cmul(h0.xy, e) + cmul(h0.zw, vec2(e.x, -e.y)), ih = vec2(-h.y, h.x);
	vec2 dx = ih * k.x * ik, dz = ih * k.y * ik;
	vec2 dxdx = -h * k.x * k.x * ik, dzdz = -h * k.y * k.y * ik, dxdz = -h * k.x * k.y * ik;
	o0 = vec4(pack2(dx, dz), pack2(h, dxdz));
	o1 = vec4(pack2(ih * k.x, ih * k.y), pack2(dxdx, dzdz));
}`;
// Stockham radix-2 inverse FFT stage
export const FFT =
	COMMON +
	`
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
}`;
// displacement (lDx, Dy, lDz, jacobian), slope (sx, sz, sx², sz²): slope mips give mean + second moment (LEAN)
export const ASSEMBLE =
	COMMON +
	`
uniform highp sampler2D uIn0, uIn1; uniform int uCascade; uniform float uLambda;
layout(location = 0) out vec4 oD; layout(location = 1) out vec4 oS;
void main(){
	ivec2 id = ivec2(gl_FragCoord.xy), p = id + ivec2(0, uCascade * N);
	float s = ((id.x + id.y) & 1) == 0 ? 1. : -1.; // undo the centred-k frequency shift
	vec4 a = texelFetch(uIn0, p, 0) * s, b = texelFetch(uIn1, p, 0) * s; // Dx Dz Dy Dxz, Dyx Dyz Dxx Dzz
	float dxx = uLambda * b.z, dzz = uLambda * b.w, dxz = uLambda * a.w;
	vec2 sl = b.xy / max(vec2(1. + dxx, 1. + dzz), vec2(.2));
	oD = vec4(uLambda * a.x, a.z, uLambda * a.y, (1. + dxx) * (1. + dzz) - dxz * dxz);
	oS = vec4(sl, sl * sl);
}`;
// camera-centred polar grid (their OceanSurface), restricted to the forward sector the fixed camera sees
export const SURF = `#version 300 es
precision highp float;
uniform sampler2D uD0, uD1, uD2, uS0, uS1, uS2, uS3;
uniform vec4 uLen;
uniform vec3 uCam;
`;
export const OV =
	SURF +
	`
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
}`;
export const OF =
	SURF +
	`
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
	float jac = texture(uD0, vXZ / uLen.x).w + texture(uD1, vXZ / uLen.y).w + texture(uD2, vXZ / uLen.z).w - 2.;
	o0 = vec4(sl, a2, length(vW - uCam));
	o1 = vec4(clamp((.05 - jac) * 1.3, 0., 1.), vW.y, 0., 1.);
}`;
