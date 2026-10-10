import { describe, expect, it } from "bun:test";
import { encodePaneKey } from "../src/pane-key";

const TOKEN = /^[A-Za-z0-9._:-]{1,128}$/;

describe("encodePaneKey", () => {
	it("encodes a tmux pane into a host-valid token, distinct per tmux server", () => {
		const a = encodePaneKey({ tmuxPane: "%3", tmuxSocket: "/tmp/tmux-501/default,123,0", tty: "/dev/ttys001" });
		const b = encodePaneKey({ tmuxPane: "%3", tmuxSocket: "/tmp/tmux-501/other,9,0", tty: "/dev/ttys001" });
		expect(a).toMatch(TOKEN);
		expect(a).toMatch(/^tmux\.[a-z0-9]+\.3$/);
		expect(a).not.toBe(b);
	});

	it("is stable across processes of one pane (server pid/index ignored)", () => {
		const a = encodePaneKey({ tmuxPane: "%7", tmuxSocket: "/tmp/tmux-501/default,1,0", tty: undefined });
		const b = encodePaneKey({ tmuxPane: "%7", tmuxSocket: "/tmp/tmux-501/default,2,5", tty: undefined });
		expect(a).toBe(b);
	});

	it("falls back to the tty with slashes encoded", () => {
		expect(encodePaneKey({ tmuxPane: undefined, tmuxSocket: undefined, tty: "/dev/pts/4" })).toBe("tty.pts.4");
	});

	it("returns null without tmux or tty and throws on malformed input", () => {
		expect(encodePaneKey({ tmuxPane: undefined, tmuxSocket: undefined, tty: undefined })).toBeNull();
		expect(() => encodePaneKey({ tmuxPane: "3", tmuxSocket: undefined, tty: undefined })).toThrow();
		expect(() => encodePaneKey({ tmuxPane: undefined, tmuxSocket: undefined, tty: "/dev/tty$1" })).toThrow();
	});
});
