import type { LiveSessionEntry } from "./live";

export type LiveSessionSummary = LiveSessionEntry;

export interface WebguiAppContext {
	name: string;
	root: string; // realpath of configured root
	launchSession(opts: { cwd: string; initialPrompt?: string }): Promise<{ instanceId: string }>; // reuses tmux launch; cwd must be inside root
	listLiveSessions(): Promise<LiveSessionSummary[]>; // same data as GET /api/live
	resolveInRoot(rel: string): string; // realpath containment; throws on escape (incl. symlinks)
}

export interface WebguiApp {
	fetch(req: Request, subpath: string): Promise<Response>; // subpath = path after /api/<name>
}

export type WebguiAppFactory = (ctx: WebguiAppContext) => WebguiApp | Promise<WebguiApp>;
