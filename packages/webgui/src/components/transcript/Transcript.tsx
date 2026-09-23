import type { AssistantMessage, DeveloperMessage, SessionEntry, ToolResultMessage } from "@oh-my-pi/pi-wire";
import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ActiveTool, TranscriptState } from "../../lib/transcript-model";
import { Markdown } from "./Markdown";
import { ToolCard } from "./ToolCard";
import { fmtTokens } from "./format";
import { UserRow } from "./rows/UserRow";
import { DeveloperRow } from "./rows/DeveloperRow";
import { ThinkingRow } from "./rows/ThinkingRow";
import "./transcript.css";

// ---------------------------------------------------------------------------
// Row models: flatten SessionEntry[] + stream + activeTools into a flat list
// that the virtualizer can index.
// ---------------------------------------------------------------------------

interface UserItem {
	kind: "user";
	content: string | readonly unknown[];
	timestamp: string;
	id: string;
	pending?: boolean;
}

interface AssistantTextItem {
	kind: "assistant-text";
	text: string;
	id: string;
}

interface AssistantImageItem {
	kind: "assistant-image";
	source: Record<string, unknown>;
	id: string;
}

interface ThinkingItem {
	kind: "thinking";
	text: string;
	redacted: boolean;
	id: string;
}

interface ToolCallItem {
	kind: "tool-call";
	toolCallId: string;
	name: string;
	args: unknown;
	intent?: string;
	result?: ToolResultMessage;
	running: boolean;
	partialResult?: unknown;
	startedAt?: number;
	id: string;
}

interface DeveloperItem {
	kind: "developer";
	content: string;
	timestamp: string;
	id: string;
}

interface DividerItem {
	kind: "divider";
	label: string;
	detail?: string;
	id: string;
}

interface MarkerItem {
	kind: "marker";
	text: string;
	id: string;
}

interface StopItem {
	kind: "stop";
	reason: string;
	errorMessage?: string;
	id: string;
}

interface ShimmerItem {
	kind: "shimmer";
	id: string;
}

type RowItem =
	| UserItem
	| AssistantTextItem
	| AssistantImageItem
	| ThinkingItem
	| ToolCallItem
	| DeveloperItem
	| DividerItem
	| MarkerItem
	| StopItem
	| ShimmerItem;

function flattenEntries(
	entries: readonly SessionEntry[],
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
	stream: AssistantMessage | null,
	streamDone: boolean,
	working: boolean,
	pendingUser: readonly string[],
): RowItem[] {
	const items: RowItem[] = [];
	const renderedToolIds = new Set<string>();

	for (const entry of entries) {
		switch (entry.type) {
			case "message": {
				const msg = entry.message;
				switch (msg.role) {
					case "user":
						items.push({
							kind: "user",
							content: msg.content,
							timestamp: entry.timestamp,
							id: entry.id,
						});
						break;
					case "assistant":
						flattenAssistant(items, msg, results, activeTools, false, entry.id);
						break;
					case "developer":
						items.push({
							kind: "developer",
							content:
								typeof (msg as DeveloperMessage).content === "string"
									? ((msg as DeveloperMessage).content as string)
									: "",
							timestamp: entry.timestamp,
							id: entry.id,
						});
						break;
					// toolResult consumed via results map
				}
				break;
			}
			case "compaction":
				items.push({
					kind: "divider",
					label: `context compacted -- ${fmtTokens(entry.tokensBefore)} tokens`,
					detail: entry.shortSummary ?? entry.summary,
					id: entry.id,
				});
				break;
			case "branch_summary":
				items.push({
					kind: "divider",
					label: "branch summary",
					detail: entry.summary,
					id: entry.id,
				});
				break;
			case "model_change":
				items.push({
					kind: "marker",
					text: `model: ${entry.model}`,
					id: entry.id,
				});
				break;
			case "thinking_level_change":
				items.push({
					kind: "marker",
					text: `thinking: ${entry.thinkingLevel ?? "off"}`,
					id: entry.id,
				});
				break;
		}
	}

	// Streaming assistant message
	if (stream !== null) {
		flattenAssistant(items, stream, results, activeTools, !streamDone, "stream");
	}

	// Collect rendered tool ids for tail tools
	for (const item of items) {
		if (item.kind === "tool-call") renderedToolIds.add(item.toolCallId);
	}

	// Tail tools not yet in a committed/streaming assistant message
	for (const tool of activeTools.values()) {
		if (!renderedToolIds.has(tool.toolCallId)) {
			items.push({
				kind: "tool-call",
				toolCallId: tool.toolCallId,
				name: tool.toolName,
				args: tool.args,
				intent: tool.intent,
				running: true,
				partialResult: tool.partialResult,
				startedAt: tool.startedAt,
				id: `tail-${tool.toolCallId}`,
			});
		}
	}

	for (let i = 0; i < pendingUser.length; i++) {
		items.push({ kind: "user", content: pendingUser[i], timestamp: "", id: `pending-${i}`, pending: true });
	}

	// Shimmer when working with nothing visible
	if ((working || pendingUser.length > 0) && stream === null && activeTools.size === 0) {
		items.push({ kind: "shimmer", id: "shimmer" });
	}

	return items;
}

function flattenAssistant(
	items: RowItem[],
	msg: AssistantMessage,
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
	pending: boolean,
	baseId: string,
): void {
	for (let i = 0; i < msg.content.length; i++) {
		const block = msg.content[i];
		switch (block.type) {
			case "thinking":
				items.push({ kind: "thinking", text: block.thinking, redacted: false, id: `${baseId}-t${i}` });
				break;
			case "redactedThinking":
				items.push({ kind: "thinking", text: "", redacted: true, id: `${baseId}-rt${i}` });
				break;
			case "text":
				items.push({ kind: "assistant-text", text: block.text, id: `${baseId}-txt${i}` });
				break;
			case "toolCall": {
				const act = activeTools.get(block.id);
				const result = results.get(block.id);
				items.push({
					kind: "tool-call",
					toolCallId: block.id,
					name: block.name,
					args: act?.args ?? block.arguments,
					intent: block.intent ?? act?.intent,
					result,
					running: !result && (act !== undefined || pending),
					partialResult: act?.partialResult,
					startedAt: act?.startedAt,
					id: `${baseId}-tc-${block.id}`,
				});
				break;
			}
			default: {
				// Handle image blocks
				const anyBlock = block as Record<string, unknown>;
				if (anyBlock.type === "image" && anyBlock.source) {
					items.push({
						kind: "assistant-image",
						source: anyBlock.source as Record<string, unknown>,
						id: `${baseId}-img${i}`,
					});
				}
				break;
			}
		}
	}

	const stop = msg.stopReason;
	if (!pending && (stop === "error" || stop === "aborted")) {
		items.push({
			kind: "stop",
			reason: stop,
			errorMessage: msg.errorMessage,
			id: `${baseId}-stop`,
		});
	}
}

// ---------------------------------------------------------------------------
// Row renderer
// ---------------------------------------------------------------------------

const RowRenderer = memo(function RowRenderer({ item, expandAll }: { item: RowItem; expandAll: boolean }): ReactNode {
	switch (item.kind) {
		case "user":
			return <UserRow content={item.content as string} timestamp={item.timestamp} pending={item.pending} />;
		case "assistant-text":
			return (
				<div className="tr-row tr-row--assistant">
					<div className="tr-body">
						<Markdown text={item.text} />
					</div>
				</div>
			);
		case "assistant-image": {
			const src = item.source;
			const data = typeof src.data === "string" ? src.data : "";
			const mime = typeof src.media_type === "string" ? src.media_type : "image/png";
			const imgSrc = data ? `data:${mime};base64,${data}` : undefined;
			return imgSrc ? (
				<div className="tr-row tr-row--assistant">
					<div className="tr-body">
						<img className="tr-msg-img" src={imgSrc} alt="" />
					</div>
				</div>
			) : null;
		}
		case "thinking":
			return <ThinkingRow text={item.text} redacted={item.redacted} expandAll={expandAll} />;
		case "tool-call":
			return (
				<div className="tr-row tr-row--assistant">
					<div className="tr-body">
						<ToolCard
							toolCallId={item.toolCallId}
							name={item.name}
							args={item.args}
							intent={item.intent}
							result={item.result}
							running={item.running}
							partialResult={item.partialResult}
							expandAll={expandAll}
						/>
					</div>
				</div>
			);
		case "developer":
			return <DeveloperRow content={item.content} timestamp={item.timestamp} />;
		case "divider":
			return (
				<div className="tr-divider" title={item.detail}>
					<span>{item.label}</span>
				</div>
			);
		case "marker":
			return (
				<div className="tr-row tr-row--marker">
					<span className="tr-marker">{item.text}</span>
				</div>
			);
		case "stop":
			return (
				<div className="tr-stop">
					<span className={`tr-chip ${item.reason === "error" ? "tr-chip--err" : "tr-chip--warn"}`}>
						{item.reason}
					</span>
					{item.errorMessage !== undefined && item.errorMessage.length > 0 && (
						<span className="tr-stop-msg">{item.errorMessage}</span>
					)}
				</div>
			);
		case "shimmer":
			return (
				<div className="tr-row tr-row--assistant">
					<div className="tr-shimmer">thinking...</div>
				</div>
			);
	}
});

// ---------------------------------------------------------------------------
// TranscriptView
// ---------------------------------------------------------------------------

export interface TranscriptViewProps {
	state: TranscriptState;
	streaming: boolean;
	expandAll: boolean;
	onLoadOlder?: () => Promise<void>;
}

export function TranscriptView({ state, streaming, expandAll, onLoadOlder }: TranscriptViewProps): ReactNode {
	const { entries, stream, streamDone, activeTools, working, pendingUser } = state;

	const results = useMemo(() => {
		const map = new Map<string, ToolResultMessage>();
		for (const entry of entries) {
			if (entry.type === "message" && entry.message.role === "toolResult") {
				map.set(entry.message.toolCallId, entry.message);
			}
		}
		return map;
	}, [entries]);

	const items = useMemo(
		() => flattenEntries(entries, results, activeTools, stream, streamDone, working || streaming, pendingUser),
		[entries, results, activeTools, stream, streamDone, working, streaming, pendingUser],
	);

	const parentRef = useRef<HTMLDivElement | null>(null);
	const atBottomRef = useRef(true);
	const loadingOlderRef = useRef(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const prevItemCountRef = useRef(items.length);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 48,
		overscan: 8,
	});

	// Track whether we are at the bottom
	const checkAtBottom = useCallback(() => {
		const el = parentRef.current;
		if (!el) return;
		const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
		const wasAtBottom = atBottomRef.current;
		atBottomRef.current = gap <= 60;
		if (atBottomRef.current && !wasAtBottom) {
			setUnreadCount(0);
		}
	}, []);

	// Track pendingUser length so sending a message always forces a scroll to the bottom
	const prevPendingCountRef = useRef(pendingUser.length);

	// Auto-scroll to bottom when new items arrive and we were at bottom, or when the user sends a message
	useEffect(() => {
		const userSentMessage = pendingUser.length > prevPendingCountRef.current;
		prevPendingCountRef.current = pendingUser.length;

		if (userSentMessage) {
			atBottomRef.current = true;
			setUnreadCount(0);
		}

		if (atBottomRef.current && items.length > 0) {
			virtualizer.scrollToIndex(items.length - 1, { align: "end" });
			// Request animation frame to re-scroll after virtualizer measures dynamic row height
			requestAnimationFrame(() => {
				if (parentRef.current && atBottomRef.current) {
					parentRef.current.scrollTop = parentRef.current.scrollHeight;
				}
			});
		} else if (items.length > prevItemCountRef.current && !atBottomRef.current) {
			setUnreadCount(c => c + (items.length - prevItemCountRef.current));
		}
		prevItemCountRef.current = items.length;
	}, [items.length, pendingUser.length, virtualizer]);

	// Load older when scrolled to top
	useEffect(() => {
		const el = parentRef.current;
		if (!el || !onLoadOlder) return;
		const handler = () => {
			checkAtBottom();
			if (el.scrollTop <= 0 && !loadingOlderRef.current) {
				loadingOlderRef.current = true;
				const prevHeight = el.scrollHeight;
				onLoadOlder()
					.then(() => {
						// Preserve scroll position after prepend
						requestAnimationFrame(() => {
							const newHeight = el.scrollHeight;
							el.scrollTop = newHeight - prevHeight;
							loadingOlderRef.current = false;
						});
					})
					.catch(() => {
						loadingOlderRef.current = false;
					});
			}
		};
		el.addEventListener("scroll", handler, { passive: true });
		return () => el.removeEventListener("scroll", handler);
	}, [onLoadOlder, checkAtBottom]);

	// Also check bottom on scroll when no onLoadOlder
	useEffect(() => {
		if (onLoadOlder) return; // already handled above
		const el = parentRef.current;
		if (!el) return;
		const handler = () => checkAtBottom();
		el.addEventListener("scroll", handler, { passive: true });
		return () => el.removeEventListener("scroll", handler);
	}, [onLoadOlder, checkAtBottom]);

	const jumpToBottom = useCallback(() => {
		virtualizer.scrollToIndex(items.length - 1, { align: "end" });
		atBottomRef.current = true;
		setUnreadCount(0);
	}, [virtualizer, items.length]);

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div className="tr-root" ref={parentRef}>
			{items.length === 0 && <div className="tr-empty">no activity yet</div>}
			<div className="tr-virtual-space" style={{ height: `${virtualizer.getTotalSize()}px` }}>
				{virtualItems.map(virtualRow => {
					const item = items[virtualRow.index];
					return (
						<div
							key={item.id}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							className="tr-virtual-row"
							style={{ transform: `translateY(${virtualRow.start}px)` }}
						>
							<RowRenderer item={item} expandAll={expandAll} />
						</div>
					);
				})}
			</div>
			{!atBottomRef.current && unreadCount > 0 && (
				<button type="button" className="tr-jump-bottom" onClick={jumpToBottom} aria-label="Jump to bottom">
					<ArrowDown size={16} />
					{unreadCount > 0 && <span className="tr-jump-count">{unreadCount}</span>}
				</button>
			)}
		</div>
	);
}
