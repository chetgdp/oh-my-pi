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

	test("session with agents panel", () => {
		expect(parseRoute("#/s/abc-123/agents")).toEqual({
			kind: "session",
			id: "abc-123",
			panel: "agents",
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

	test("session/agents -> #/s/<id>/agents", () => {
		expect(routeHash({ kind: "session", id: "x", panel: "agents" })).toBe("#/s/x/agents");
	});

	test("session/info -> #/s/<id>/info", () => {
		expect(routeHash({ kind: "session", id: "x", panel: "info" })).toBe("#/s/x/info");
	});
});

describe("round-trip", () => {
	const routes: Route[] = [
		{ kind: "sessions" },
		{ kind: "session", id: "test-id", panel: null },
		{ kind: "session", id: "test-id", panel: "agents" },
		{ kind: "session", id: "test-id", panel: "info" },
		{ kind: "session", id: "test-id", panel: "models" },
	];

	for (const route of routes) {
		test(`${JSON.stringify(route)}`, () => {
			expect(parseRoute(routeHash(route))).toEqual(route);
		});
	}
});
