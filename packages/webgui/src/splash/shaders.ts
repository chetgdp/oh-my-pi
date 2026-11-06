/**
 * Gate splash shaders, ported from the prototype
 * research/splash/h-water-full-glass.html with all defaults unchanged. The
 * GLSL lives in ./glsl/ (text imports); scripts/splash-shaders.ts minifies the
 * joined exports at build time.
 */
import ASSEMBLE_SRC from "./glsl/assemble.frag" with { type: "text" };
import COMMON from "./glsl/common.glsl" with { type: "text" };
import EVOLVE_SRC from "./glsl/evolve.frag" with { type: "text" };
import FFT_SRC from "./glsl/fft.frag" with { type: "text" };
import INIT_SRC from "./glsl/init.frag" with { type: "text" };
import FS_SRC from "./glsl/main.frag" with { type: "text" };
import OF_SRC from "./glsl/ocean.frag" with { type: "text" };
import OV_SRC from "./glsl/ocean.vert" with { type: "text" };
import QV_SRC from "./glsl/quad.vert" with { type: "text" };
import SURF from "./glsl/surface.glsl" with { type: "text" };

/** Eye height above the water (m); main.frag has its own copy (`EH`). */
export const EYE = 3.43;

// ---- Scene: sky, sun/moon, gate, rocks, water shading, portal ----
export const FS = FS_SRC;

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
export const QV = QV_SRC;
export const INIT = COMMON + INIT_SRC;
export const EVOLVE = COMMON + EVOLVE_SRC;
export const FFT = COMMON + FFT_SRC;
export const ASSEMBLE = COMMON + ASSEMBLE_SRC;
export const OV = SURF + OV_SRC;
export const OF = SURF + OF_SRC;
