/**
 * Hash-based routing for the webgui SPA.
 */

import { browserWindow } from "./dom";

export type Route =
	| { kind: "sessions" }
	| {
			kind: "session";
			id: string;
			panel: "info" | "todos" | "usage" | "hub" | "subagents" | "agent" | null;
			/** Agent selected in the hub (`#/s/<id>/hub/<agentId>`) or focused in the main view (`#/s/<id>/agent/<agentId>`). */
			agent?: string;
			/** Read-only todo list of the focused agent (`#/s/<id>/agent/<agentId>/todos`); only with panel `agent`. */
			todos?: true;
			/**
			 * Legacy `#/s/<id>/models` link: the Models screen moved into the control center, so the
			 * link opens it there. Never serialized; the app rewrites the hash to the session route.
			 */
			controlCenter?: "models";
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
	if (suffix === "models") return { kind: "session", id, panel: null, controlCenter: "models" };
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

/**
 * Depth in the navigation hierarchy: sessions list 0, session main 1, any
 * panel or focused agent 2, focused-agent todos 3.
 */
export function routeDepth(route: Route): number {
	if (route.kind === "sessions") return 0;
	if (route.panel === null) return 1;
	if (route.panel === "agent" && route.todos) return 3;
	return 2;
}

/** The route one level up, or null for the sessions list. */
export function routeParent(route: Route): Route | null {
	if (route.kind === "sessions") return null;
	if (route.panel === null) return { kind: "sessions" };
	if (route.panel === "agent" && route.todos && route.agent) {
		return { kind: "session", id: route.id, panel: "agent", agent: route.agent };
	}
	return { kind: "session", id: route.id, panel: null };
}

function isAncestorHash(ancestor: string, route: Route): boolean {
	for (let r = routeParent(route); r; r = routeParent(r)) {
		if (routeHash(r) === ancestor) return true;
	}
	return false;
}

/**
 * App history bookkeeping kept in `history.state`: the canonical hashes of
 * this tab's app entries, oldest first, ending with the current entry. It
 * survives reloads (browsers persist history.state) and lets an up-navigation
 * step back to the real parent entry instead of pushing a duplicate.
 */
interface NavState {
	readonly ompNav: 1;
	readonly stack: readonly string[];
}

/** Cap so long sessions cannot grow history.state without bound. */
const MAX_STACK = 64;

function readStack(current: string): string[] | null {
	const state = browserWindow.history.state as Partial<NavState> | null;
	if (!state || state.ompNav !== 1 || !Array.isArray(state.stack) || state.stack.length === 0) return null;
	const stack = state.stack.filter((h): h is string => typeof h === "string");
	if (stack.length === 0 || stack[stack.length - 1] !== current) return null;
	return stack;
}

function navState(stack: readonly string[]): NavState {
	return { ompNav: 1, stack: stack.length > MAX_STACK ? stack.slice(-MAX_STACK) : stack };
}

/**
 * Seed `history.state` for the current entry when it carries no app state:
 * initial load, deep link, or a hash typed into the address bar. Entries
 * created by navigate() or restored by reload already have it.
 */
export function syncRouteHistory(): void {
	const current = routeHash(parseRoute(browserWindow.location.hash));
	if (readStack(current)) return;
	browserWindow.history.replaceState(navState([current]), "");
}

/** Rewrites a legacy hash (e.g. `#/s/<id>/models`) to its canonical form in place, without a new entry. */
export function replaceWithCanonicalHash(): void {
	const hash = browserWindow.location.hash;
	const canonical = routeHash(parseRoute(hash));
	if (canonical === hash) return;
	browserWindow.history.replaceState(navState(readStack(canonical) ?? [canonical]), "", canonical);
	notify();
}

const listeners = new Set<() => void>();

function notify(): void {
	for (const l of listeners) l();
}

/**
 * Subscribe to route changes: navigate() writes (pushState/replaceState fire
 * no browser event) and history traversal (hashchange/popstate). The listener
 * may fire twice for one traversal; callers compare hashes.
 */
export function subscribeRoute(listener: () => void): () => void {
	function onBrowserChange(): void {
		syncRouteHistory();
		listener();
	}
	listeners.add(listener);
	browserWindow.addEventListener("hashchange", onBrowserChange);
	browserWindow.addEventListener("popstate", onBrowserChange);
	return () => {
		listeners.delete(listener);
		browserWindow.removeEventListener("hashchange", onBrowserChange);
		browserWindow.removeEventListener("popstate", onBrowserChange);
	};
}

/**
 * Navigate within the hierarchy. Deeper pushes an entry; same depth (sibling
 * switch) replaces; shallower steps back to the parent entry when the app
 * history holds it (so browser back afterwards goes further up, never back
 * down), else replaces (deep link with no in-app parent).
 */
export function navigate(route: Route): void {
	const target = routeHash(route);
	const from = parseRoute(browserWindow.location.hash);
	const fromHash = routeHash(from);
	if (target === fromHash) return;
	const stack = readStack(fromHash) ?? [fromHash];
	const history = browserWindow.history;
	const toDepth = routeDepth(route);
	const fromDepth = routeDepth(from);

	if (toDepth > fromDepth) {
		history.pushState(navState([...stack, target]), "", target);
		notify();
		return;
	}
	if (toDepth < fromDepth && isAncestorHash(target, from)) {
		const top = stack.length - 1;
		const k = stack.lastIndexOf(target, top - 1);
		if (k !== -1 && stack.slice(k + 1).every(h => isAncestorHash(target, parseRoute(h)))) {
			// Traversal fires hashchange/popstate; listeners update then.
			history.go(k - top);
			return;
		}
	}
	history.replaceState(navState([...stack.slice(0, -1), target]), "", target);
	notify();
}
