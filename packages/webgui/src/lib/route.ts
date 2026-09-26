/**
 * Hash-based routing for the webgui SPA.
 */

import { browserWindow } from "./dom";

export type Route =
	| { kind: "sessions" }
	| { kind: "session"; id: string; panel: "agents" | "info" | "models" | "todos" | "usage" | null };

const PREFIX = "#/s/";

export function parseRoute(hash: string): Route {
	if (!hash.startsWith(PREFIX)) return { kind: "sessions" };
	const rest = hash.slice(PREFIX.length);
	if (!rest) return { kind: "sessions" };

	const slash = rest.indexOf("/");
	if (slash === -1) return { kind: "session", id: rest, panel: null };

	const id = rest.slice(0, slash);
	if (!id) return { kind: "sessions" };

	const suffix = rest.slice(slash + 1);
	if (suffix === "agents") return { kind: "session", id, panel: "agents" };
	if (suffix === "info") return { kind: "session", id, panel: "info" };
	if (suffix === "models") return { kind: "session", id, panel: "models" };
	if (suffix === "todos") return { kind: "session", id, panel: "todos" };
	if (suffix === "usage") return { kind: "session", id, panel: "usage" };
	return { kind: "session", id, panel: null };
}

export function routeHash(route: Route): string {
	if (route.kind === "sessions") return "#/";
	const base = `${PREFIX}${route.id}`;
	if (route.panel === null) return base;
	return `${base}/${route.panel}`;
}

export function navigate(route: Route): void {
	browserWindow.location.hash = routeHash(route);
}
