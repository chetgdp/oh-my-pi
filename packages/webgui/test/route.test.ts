import { describe, expect, test } from "bun:test";
import { parseRoute, routeHash } from "../src/lib/route";
import type { Route } from "../src/lib/route";

describe("parseRoute", () => {
	test("empty hash -> sessions", () => {
		expect(parseRoute("")).toEqual({ kind: "sessions" });
	});

	test("#/ -> sessions", () => {
		expect(parseRoute("#/")).toEqual({ kind: "sessions" });
	});

	test("session route", () => {
		expect(parseRoute("#/s/abc-123")).toEqual({
			kind: "session",
			id: "abc-123",
			panel: null,
		});
	});

	test("legacy agents link opens the hub", () => {
		expect(parseRoute("#/s/abc-123/agents")).toEqual({
			kind: "session",
			id: "abc-123",
			panel: "hub",
		});
	});

	test("session with info panel", () => {
		expect(parseRoute("#/s/abc-123/info")).toEqual({
			kind: "session",
			id: "abc-123",
			panel: "info",
		});
	});

	test("session with models panel", () => {
		expect(parseRoute("#/s/abc-123/models")).toEqual({
			kind: "session",
			id: "abc-123",
			panel: "models",
		});
	});
	test("session with usage panel", () => {
		expect(parseRoute("#/s/abc-123/usage")).toEqual({
			kind: "session",
			id: "abc-123",
			panel: "usage",
		});
	});

	test("unknown panel suffix -> null panel", () => {
		expect(parseRoute("#/s/abc-123/unknown")).toEqual({
			kind: "session",
			id: "abc-123",
			panel: null,
		});
	});

	test("malformed: missing id after prefix", () => {
		expect(parseRoute("#/s/")).toEqual({ kind: "sessions" });
	});

	test("malformed: random hash", () => {
		expect(parseRoute("#foo")).toEqual({ kind: "sessions" });
	});

	test("malformed: partial prefix", () => {
		expect(parseRoute("#/s")).toEqual({ kind: "sessions" });
	});
});

describe("routeHash", () => {
	test("sessions -> #/", () => {
		expect(routeHash({ kind: "sessions" })).toBe("#/");
	});

	test("session -> #/s/<id>", () => {
		expect(routeHash({ kind: "session", id: "x", panel: null })).toBe("#/s/x");
	});

	test("session/info -> #/s/<id>/info", () => {
		expect(routeHash({ kind: "session", id: "x", panel: "info" })).toBe("#/s/x/info");
	});
	test("session/usage -> #/s/<id>/usage", () => {
		expect(routeHash({ kind: "session", id: "x", panel: "usage" })).toBe("#/s/x/usage");
	});
});

describe("round-trip", () => {
	const routes: Route[] = [
		{ kind: "sessions" },
		{ kind: "session", id: "test-id", panel: null },
		{ kind: "session", id: "test-id", panel: "info" },
		{ kind: "session", id: "test-id", panel: "models" },
		{ kind: "session", id: "test-id", panel: "usage" },
	];

	for (const route of routes) {
		test(`${JSON.stringify(route)}`, () => {
			expect(parseRoute(routeHash(route))).toEqual(route);
		});
	}
});

describe("hub route", () => {
	test("hub with and without an agent round-trips, including dotted ids", () => {
		const bare: Route = { kind: "session", id: "s1", panel: "hub" };
		expect(parseRoute(routeHash(bare))).toEqual(bare);
		const withAgent: Route = { kind: "session", id: "s1", panel: "hub", agent: "A.B/C" };
		expect(parseRoute(routeHash(withAgent))).toEqual(withAgent);
	});
});

describe("focused agent route", () => {
	test("#/s/<sid>/agent/<id> round-trips dotted ids and rejects an empty id", () => {
		const route: Route = { kind: "session", id: "s1", panel: "agent", agent: "A.B.C" };
		expect(routeHash(route)).toBe("#/s/s1/agent/A.B.C");
		expect(parseRoute(routeHash(route))).toEqual(route);
		expect(parseRoute("#/s/s1/agent/")).toEqual({ kind: "session", id: "s1", panel: null });
	});
});

describe("focused agent todos route", () => {
	test("#/s/<sid>/agent/<id>/todos round-trips and keeps the plain focus route distinct", () => {
		const route: Route = { kind: "session", id: "s1", panel: "agent", agent: "A.B/C", todos: true };
		expect(routeHash(route)).toBe("#/s/s1/agent/A.B%2FC/todos");
		expect(parseRoute(routeHash(route))).toEqual(route);
		const plain: Route = { kind: "session", id: "s1", panel: "agent", agent: "todos" };
		expect(routeHash(plain)).toBe("#/s/s1/agent/todos");
		expect(parseRoute(routeHash(plain))).toEqual(plain);
		expect(parseRoute("#/s/s1/agent//todos")).toEqual({ kind: "session", id: "s1", panel: null });
	});
});
