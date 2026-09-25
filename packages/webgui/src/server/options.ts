import type { ProcessTreeReader, TmuxRunner } from "./tmux";

export interface DaemonOptions {
	registryDir?: string;
	sessionsDir?: string;
	tmux?: TmuxRunner;
	processTreeReader?: ProcessTreeReader;
}
