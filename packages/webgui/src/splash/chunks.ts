/** Lazy chunks of the splash and the app background; one loader each, shared by every caller. */
import { LazyModule } from "../lib/lazy-module";
import type * as BackgroundModule from "./background";
import type * as SceneModule from "./scene";

/** The WebGL gate scene (splash and app background). */
export const sceneModule = new LazyModule<typeof SceneModule>(() => import("./scene"));
/** The app background controller; fetched while the splash plays (src/splash/index.ts). */
export const backgroundModule = new LazyModule<typeof BackgroundModule>(() => import("./background"));
