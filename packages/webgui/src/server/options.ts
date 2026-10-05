import type { MountedApp } from "./apps";
import type { ProcessTreeReader, TmuxRunner } from "./tmux";

export interface DaemonOptions {
	registryDir?: string;
	sessionsDir?: string;
	tmux?: TmuxRunner;
	processTreeReader?: ProcessTreeReader;
	appsConfigFile?: string;
	mounts?: Map<string, MountedApp>;
	allowedHosts?: string[];
}
