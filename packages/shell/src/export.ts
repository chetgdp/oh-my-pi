/**
 * `/export [N]`: the active branch of a session as plain markdown. A turn is one
 * user prompt and everything up to the next one; tool calls are `· tool args`
 * lines without results; thinking is skipped; compactions are one marker line.
 */
import { assistantText, toolLine } from "./output";

export const COMPACTION_MARKER = "_[earlier context compacted]_";

type Entry = Record<string, unknown>;

/** Entries from the root to `leafId`; `get_entries` returns every branch in append order. */
function activePath(entries: readonly unknown[], leafId: string | null): Entry[] {
	const byId = new Map<string, Entry>();
	for (const entry of entries) {
		if (typeof entry === "object" && entry !== null && typeof (entry as Entry).id === "string") {
			byId.set((entry as Entry).id as string, entry as Entry);
		}
	}
	const path: Entry[] = [];
	let id = leafId;
	while (id !== null) {
		const entry = byId.get(id);
		if (!entry) break;
		path.push(entry);
		id = typeof entry.parentId === "string" ? entry.parentId : null;
	}
	return path.reverse();
}

function userText(message: Entry): string | null {
	const content = message.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return null;
	const parts = content
		.filter(b => typeof b === "object" && b !== null && (b as Entry).type === "text")
		.map(b => String((b as Entry).text ?? ""));
	return parts.length > 0 ? parts.join("\n") : null;
}

/** Markdown blocks of one entry, or null when it has nothing to show; `user` marks a turn start. */
function entryBlocks(entry: Entry): { user: boolean; blocks: string[] } | null {
	if (entry.type === "compaction") return { user: false, blocks: [COMPACTION_MARKER] };
	if (entry.type !== "message" || typeof entry.message !== "object" || entry.message === null) return null;
	const message = entry.message as Entry;
	if (message.role === "user") {
		const text = userText(message)?.replace(/\s+$/, "");
		if (!text) return null;
		return {
			user: true,
			blocks: [
				text
					.split("\n")
					.map(line => (line ? `> ${line}` : ">"))
					.join("\n"),
			],
		};
	}
	if (message.role !== "assistant") return null;
	const blocks: string[] = [];
	const text = assistantText(message)?.replace(/\s+$/, "");
	if (text) blocks.push(text);
	const tools: string[] = [];
	if (Array.isArray(message.content)) {
		for (const block of message.content) {
			if (typeof block !== "object" || block === null) continue;
			const b = block as Entry;
			if (b.type === "toolCall") tools.push(toolLine(String(b.name ?? "tool"), b.arguments));
		}
	}
	if (tools.length > 0) blocks.push(tools.join("\n"));
	return blocks.length > 0 ? { user: false, blocks } : null;
}

/** The transcript, or its last `turns` turns; "" when the branch has nothing to show. */
export function transcriptMarkdown(entries: readonly unknown[], leafId: string | null, turns?: number): string {
	const shown = activePath(entries, leafId)
		.map(entryBlocks)
		.filter(e => e !== null);
	let start = 0;
	if (turns !== undefined) {
		const starts = shown.flatMap((e, i) => (e.user ? [i] : []));
		if (starts.length > turns) start = starts[starts.length - turns]!;
	}
	const blocks = shown.slice(start).flatMap(e => e.blocks);
	return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}
