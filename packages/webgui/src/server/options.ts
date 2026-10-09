import type { MountedApp } from "./apps";

export interface DaemonOptions {
	registryDir?: string;
	sessionsDir?: string;
	/** omp binary for `omp host start`; defaults to env WEBGUI_OMP_BIN, then `omp` on PATH. */
	ompBin?: string;
	appsConfigFile?: string;
	mounts?: Map<string, MountedApp>;
	allowedHosts?: string[];
}
