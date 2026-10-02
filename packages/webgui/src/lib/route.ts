/**
 * Hash-based routing for the webgui SPA.
 */

import { browserWindow } from "./dom";

export type Route =
	| { kind: "sessions" }
	| {
			kind: "session";
			id: string;
			panel: "info" | "models" | "todos" | "usage" | "hub" | "subagents" | "agent" | null;
			/** Agent selected in the hub (`#/s/<id>/hub/<agentId>`) or focused in the main view (`#/s/<id>/agent/<agentId>`). */
			agent?: string;
			/** Read-only todo list of the focused agent (`#/s/<id>/agent/<agentId>/todos`); only with panel `agent`. */
			todos?: true;
	  };

const PREFIX = "#/s/";
/** Encoded agent ids never contain a raw `/`, so a trailing `/todos` segment is unambiguous. */
const FOCUS_TODOS_SUFFIX = "/todos";

function decodeAgentId(raw: string): string {
	try {
		return decodeURIComponent(raw);
	} catch {
		return "";
	}
}

export function parseRoute(hash: string): Route {
	if (!hash.startsWith(PREFIX)) return { kind: "sessions" };
	const rest = hash.slice(PREFIX.length);
	if (!rest) return { kind: "sessions" };

	const slash = rest.indexOf("/");
	if (slash === -1) return { kind: "session", id: rest, panel: null };

	const id = rest.slice(0, slash);
	if (!id) return { kind: "sessions" };

	const suffix = rest.slice(slash + 1);
	// Legacy link to the removed Agents panel; the Agent Hub replaced it.
	if (suffix === "agents") return { kind: "session", id, panel: "hub" };
	if (suffix === "info") return { kind: "session", id, panel: "info" };
	if (suffix === "models") return { kind: "session", id, panel: "models" };
	if (suffix === "todos") return { kind: "session", id, panel: "todos" };
	if (suffix === "usage") return { kind: "session", id, panel: "usage" };
	if (suffix === "hub") return { kind: "session", id, panel: "hub" };
	if (suffix === "subagents") return { kind: "session", id, panel: "subagents" };
	if (suffix.startsWith("hub/")) {
		const agent = decodeAgentId(suffix.slice(4));
		return agent ? { kind: "session", id, panel: "hub", agent } : { kind: "session", id, panel: "hub" };
	}
	if (suffix.startsWith("agent/")) {
		let raw = suffix.slice(6);
		const todos = raw.endsWith(FOCUS_TODOS_SUFFIX);
		if (todos) raw = raw.slice(0, -FOCUS_TODOS_SUFFIX.length);
		const agent = decodeAgentId(raw);
		if (!agent) return { kind: "session", id, panel: null };
		return todos
			? { kind: "session", id, panel: "agent", agent, todos: true }
			: { kind: "session", id, panel: "agent", agent };
	}
	return { kind: "session", id, panel: null };
}

export function routeHash(route: Route): string {
	if (route.kind === "sessions") return "#/";
	const base = `${PREFIX}${route.id}`;
	if (route.panel === null) return base;
	if (route.panel === "hub" && route.agent) return `${base}/hub/${encodeURIComponent(route.agent)}`;
	if (route.panel === "agent") {
		if (!route.agent) return base;
		return `${base}/agent/${encodeURIComponent(route.agent)}${route.todos ? FOCUS_TODOS_SUFFIX : ""}`;
	}
	return `${base}/${route.panel}`;
}

export function navigate(route: Route): void {
	browserWindow.location.hash = routeHash(route);
}
