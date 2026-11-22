#!/usr/bin/env bun
/**
 * Plays each tool's spinner animation in turn, through the same renderLine the
 * spinner uses. Usage: bun scripts/preview_kaomoji.ts [seconds] [tool ...]
 */
import { initialState, pinTool, renderLine, TOOL_KAOMOJI } from "../src/spinner";

const args = Bun.argv.slice(2);
const timed = args[0] !== undefined && /^\d+(\.\d+)?$/.test(args[0]);
const seconds = timed ? Number(args[0]) : 4;
const named = timed ? args.slice(1) : args;
// "other" shows the face that tools missing from the table get.
const tools = named.length > 0 ? named : [...Object.keys(TOOL_KAOMOJI), "other"];

process.on("SIGINT", () => {
	process.stderr.write("\r\x1b[K\x1b[?25h");
	process.exit(130);
});
process.stderr.write("\x1b[?25l");
for (const tool of tools) {
	const start = Date.now();
	// No table flip: the preview shows the tool face only.
	const state = { ...pinTool(initialState(start, Math.random), tool, start), nextFlipAtMs: Number.POSITIVE_INFINITY };
	while (Date.now() - start < seconds * 1000) {
		const now = Date.now();
		process.stderr.write(`\r${renderLine(state, now, tool, process.stderr.columns || 80)}\x1b[K`);
		await Bun.sleep(50);
	}
	process.stderr.write("\n");
}
process.stderr.write("\x1b[?25h");
