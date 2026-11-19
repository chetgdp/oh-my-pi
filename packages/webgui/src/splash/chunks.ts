/** Lazy chunks of the splash and the app background; one loader each, shared by every caller. */
import { browserWindow } from "../lib/dom";
import { LazyModule } from "../lib/lazy-module";
import type * as BackgroundModule from "./background";
import type { SplashCanvas } from "./gl";
import type * as SceneModule from "./scene";
import type * as GpuSceneModule from "./scene-gpu";

/** The WebGL gate scene (splash and app background); the fallback where WebGPU is missing. */
export const sceneModule = new LazyModule<typeof SceneModule>(() => import("./scene"));
/** The WebGPU gate scene: same picture and API; WebGL on Windows compiles through FXC for ~30 s. */
export const gpuSceneModule = new LazyModule<typeof GpuSceneModule>(() => import("./scene-gpu"));
/** The app background controller; fetched while the splash plays (src/splash/index.ts). */
export const backgroundModule = new LazyModule<typeof BackgroundModule>(() => import("./background"));

export type Scene = SceneModule.GateScene | GpuSceneModule.GpuGateScene;

/** How the last {@link loadScene} went; shown on `/shader` so a failing WebGPU path is visible on the device. */
export const sceneLoadReport: { backend: "webgpu" | "webgl2" | "none"; ms: number; gpuError: string | null } = {
	backend: "none",
	ms: 0,
	gpuError: null,
};

/**
 * WebGPU when the browser has it, else WebGL. The WebGPU load rejects before it touches the
 * canvas when no adapter or device is available, so the same canvas can still take WebGL.
 */
export async function loadScene(canvas: SplashCanvas, hour: number): Promise<Scene> {
	const t0 = performance.now();
	// `?backend=webgl` forces the fallback, to compare both backends on one device
	const forceGl = new URLSearchParams(browserWindow.location.search).get("backend") === "webgl";
	sceneLoadReport.gpuError = forceGl ? "?backend=webgl" : "navigator.gpu missing";
	if (!forceGl && "gpu" in browserWindow.navigator && browserWindow.navigator.gpu) {
		try {
			const scene = await (await gpuSceneModule.load()).GpuGateScene.load(canvas, hour);
			Object.assign(sceneLoadReport, { backend: "webgpu", ms: performance.now() - t0, gpuError: null });
			return scene;
		} catch (err) {
			sceneLoadReport.gpuError = err instanceof Error ? err.message : String(err);
		}
	}
	const scene = await (await sceneModule.load()).GateScene.load(canvas, hour);
	Object.assign(sceneLoadReport, { backend: "webgl2", ms: performance.now() - t0 });
	return scene;
}
