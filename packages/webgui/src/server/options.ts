import type { TmuxRunner } from "./tmux";

export interface DaemonOptions {
	registryDir?: string;
	sessionsDir?: string;
	tmux?: TmuxRunner;
}
