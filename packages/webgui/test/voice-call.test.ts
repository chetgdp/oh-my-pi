import { describe, expect, test } from "bun:test";
import { type VoiceCall, voiceCallText } from "../src/components/transcript/tool-views/voice";

describe("voiceCallText", () => {
	const cases: [string, string, Record<string, unknown>, VoiceCall | null][] = [
		["wren tool say", "wren", { command: "say", text: "hello there" }, { command: "say", text: "hello there" }],
		["wren tool stop", "wren", { command: "stop" }, { command: "stop", text: null }],
		["bash escaped quotes", "bash", { command: 'wren say "a \\"b\\""' }, { command: "say", text: 'a "b"' }],
		["bash single quotes", "bash", { command: "wren say 'it is done'" }, { command: "say", text: "it is done" }],
		["bash env prefix", "bash", { command: "  FOO=1 BAR='x y' wren say \"hi\"" }, { command: "say", text: "hi" }],
		["bash home path", "bash", { command: '~/.local/bin/wren say "home"' }, { command: "say", text: "home" }],
		["bash absolute path", "bash", { command: "/opt/bin/wren pause" }, { command: "pause", text: null }],
		["bash streaming partial", "bash", { command: 'wren say "half wri' }, { command: "say", text: "half wri" }],
		[
			"curl fallback",
			"bash",
			{ command: `curl -s -X POST localhost:8765/speak -d '{"text": "via curl", "append": true}'` },
			{ command: "say", text: "via curl" },
		],
		["curl unparseable", "bash", { command: 'curl -s localhost:8765/speak -d \'{"text": ' }, null],
		["non-voice bash", "bash", { command: 'echo wren say "x"' }, null],
		[
			"chained status then say",
			"bash",
			{ command: 'wren status; wren say "Hello. Voice; on."' },
			{ command: "say", text: "Hello. Voice; on." },
		],
		["chain with non-wren command", "bash", { command: 'cd /tmp && wren say "x"' }, null],
		["unknown wren subcommand", "bash", { command: "wren install" }, null],
		["other tool", "read", { command: 'wren say "x"' }, null],
	];
	for (const [label, tool, args, expected] of cases) {
		test(label, () => {
			expect(voiceCallText(tool, args)).toEqual(expected);
		});
	}
});
