import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import type { DeveloperMessage, ImageContent, TextContent, ToolResultMessage } from "@oh-my-pi/pi-wire";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActiveTool, LiveStream, PendingUserMessage, TranscriptState } from "../../lib/transcript-model";
import { dataUrlToImage } from "../../lib/session-actions";
import { Markdown } from "./Markdown";
import { ToolCard } from "./ToolCard";
import { fmtTokens } from "./format";
import { DeveloperRow } from "./rows/DeveloperRow";
import { ThinkingRow } from "./rows/ThinkingRow";
import { UserRow } from "./rows/UserRow";
import "./transcript.css";

// ---------------------------------------------------------------------------
// Row models: flatten SessionEntry[] + live + activeTools into a flat list
// that the virtualizer can index.
// ---------------------------------------------------------------------------

interface UserItem {
	kind: "user";
	content: string | readonly (TextContent | ImageContent)[];
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

// ---------------------------------------------------------------------------
// Per-entry row item memoization
// ---------------------------------------------------------------------------

interface CachedFinishedEntry {
	key: string;
	items: RowItem[];
	toolCallIds: readonly string[];
	resultsSnapshot: readonly (unknown | undefined)[];
	hadActiveTools: boolean;
}

const finishedEntryCache = new WeakMap<SessionEntry, CachedFinishedEntry>();

function flattenAssistant(
	items: RowItem[],
	msg: AgentMessage,
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
	pending: boolean,
	baseId: string,
	toolCallIds?: string[],
): void {
	const content = "content" in msg && Array.isArray(msg.content) ? msg.content : [];
	for (let i = 0; i < content.length; i++) {
		const block = content[i];
		if (!block || typeof block !== "object") continue;
		switch (block.type) {
			case "thinking":
				items.push({
					kind: "thinking",
					text: typeof block.thinking === "string" ? block.thinking : "",
					redacted: false,
					id: `${baseId}-t${i}`,
				});
				break;
			case "redactedThinking":
				items.push({ kind: "thinking", text: "", redacted: true, id: `${baseId}-rt${i}` });
				break;
			case "text":
				items.push({
					kind: "assistant-text",
					text: typeof block.text === "string" ? block.text : "",
					id: `${baseId}-txt${i}`,
				});
				break;
			case "toolCall": {
				const id = typeof block.id === "string" ? block.id : "";
				const name = typeof block.name === "string" ? block.name : "";
				if (toolCallIds && id) toolCallIds.push(id);
				const act = activeTools.get(id);
				const result = results.get(id);
				items.push({
					kind: "tool-call",
					toolCallId: id,
					name,
					args: act?.args ?? block.arguments,
					intent: (typeof block.intent === "string" ? block.intent : undefined) ?? act?.intent,
					result,
					running: !result && (act !== undefined || pending),
					partialResult: act?.partialResult,
					startedAt: act?.startedAt,
					id: `${baseId}-tc-${id}`,
				});
				break;
			}
			case "image": {
				if ("source" in block && block.source && typeof block.source === "object") {
					items.push({
						kind: "assistant-image",
						source: block.source as Record<string, unknown>,
						id: `${baseId}-img${i}`,
					});
				}
				break;
			}
			default:
				break;
		}
	}

	const stopReason = "stopReason" in msg && typeof msg.stopReason === "string" ? msg.stopReason : undefined;
	const errorMessage = "errorMessage" in msg && typeof msg.errorMessage === "string" ? msg.errorMessage : undefined;
	if (!pending && (stopReason === "error" || stopReason === "aborted")) {
		items.push({
			kind: "stop",
			reason: stopReason,
			errorMessage,
			id: `${baseId}-stop`,
		});
	}
}

function getFinishedEntryItems(
	entry: SessionEntry,
	entryKey: string,
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
): RowItem[] {
	const cached = finishedEntryCache.get(entry);
	if (cached !== undefined && cached.key === entryKey) {
		if (cached.toolCallIds.length === 0) {
			return cached.items;
		}
		const hasActiveNow = cached.toolCallIds.some(id => activeTools.has(id));
		if (!cached.hadActiveTools && !hasActiveNow) {
			let resultsMatch = true;
			for (let i = 0; i < cached.toolCallIds.length; i++) {
				if (results.get(cached.toolCallIds[i]) !== cached.resultsSnapshot[i]) {
					resultsMatch = false;
					break;
				}
			}
			if (resultsMatch) {
				return cached.items;
			}
		}
	}

	const items: RowItem[] = [];
	const toolCallIds: string[] = [];

	switch (entry.type) {
		case "message": {
			const msg = entry.message;
			switch (msg.role) {
				case "user": {
					const userContent = msg.content as string | readonly (TextContent | ImageContent)[];
					items.push({
						kind: "user",
						content: userContent,
						timestamp: entry.timestamp,
						id: entryKey,
					});
					break;
				}
				case "assistant": {
					flattenAssistant(items, msg, results, activeTools, false, entryKey, toolCallIds);
					break;
				}
				case "developer": {
					const devMsg = msg as DeveloperMessage;
					const devContent =
						typeof devMsg.content === "string"
							? devMsg.content
							: Array.isArray(devMsg.content)
								? devMsg.content
										.map(b => (typeof b === "object" && b && "text" in b ? String(b.text) : ""))
										.join("")
								: "";
					items.push({
						kind: "developer",
						content: devContent,
						timestamp: entry.timestamp,
						id: entryKey,
					});
					break;
				}
			}
			break;
		}
		case "compaction": {
			items.push({
				kind: "divider",
				label: `context compacted -- ${fmtTokens(entry.tokensBefore)} tokens`,
				detail: entry.shortSummary ?? entry.summary,
				id: entryKey,
			});
			break;
		}
		case "branch_summary": {
			items.push({
				kind: "divider",
				label: "branch summary",
				detail: entry.summary,
				id: entryKey,
			});
			break;
		}
		case "model_change": {
			items.push({
				kind: "marker",
				text: `model: ${entry.model}`,
				id: entryKey,
			});
			break;
		}
		case "thinking_level_change": {
			items.push({
				kind: "marker",
				text: `thinking: ${entry.thinkingLevel ?? "off"}`,
				id: entryKey,
			});
			break;
		}
	}

	const hadActiveTools = toolCallIds.some(id => activeTools.has(id));
	const resultsSnapshot = toolCallIds.map(id => results.get(id));

	finishedEntryCache.set(entry, {
		key: entryKey,
		items,
		toolCallIds,
		resultsSnapshot,
		hadActiveTools,
	});

	return items;
}

export function flattenEntries(
	entries: readonly SessionEntry[],
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
	live: ReadonlyMap<number, LiveStream>,
	working: boolean,
	pendingUser: readonly PendingUserMessage[],
	entryKeys: ReadonlyMap<string, string>,
): RowItem[] {
	const items: RowItem[] = [];
	const renderedToolIds = new Set<string>();

	// Finished entries (memoized by entry reference to prevent Markdown re-parsing on deltas)
	for (const entry of entries) {
		const entryKey = entryKeys.get(entry.id) ?? entry.id;
		const entryItems = getFinishedEntryItems(entry, entryKey, results, activeTools);
		for (const item of entryItems) {
			items.push(item);
			if (item.kind === "tool-call") {
				renderedToolIds.add(item.toolCallId);
			}
		}
	}

	// Live streams rendered below finished entries, ordered by stream id
	if (live.size > 0) {
		const sortedLive = Array.from(live.entries()).sort(([a], [b]) => a - b);
		for (const [sid, stream] of sortedLive) {
			const baseId = `live:${sid}`;
			flattenAssistant(items, stream.message, results, activeTools, !stream.frozen, baseId);
		}
	}

	// Tail tools not yet incorporated in an assistant message block
	for (const item of items) {
		if (item.kind === "tool-call") renderedToolIds.add(item.toolCallId);
	}
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
		const pendingItem = pendingUser[i];
		let content: string | readonly (TextContent | ImageContent)[];
		if (pendingItem.images && pendingItem.images.length > 0) {
			const parts: (TextContent | ImageContent)[] = [];
			if (pendingItem.text.length > 0) {
				parts.push({ type: "text", text: pendingItem.text });
			}
			for (const imgUrl of pendingItem.images) {
				const img = dataUrlToImage(imgUrl);
				if (img) parts.push(img);
			}
			content = parts;
		} else {
			content = pendingItem.text;
		}
		items.push({ kind: "user", content, timestamp: "", id: `pending-${i}`, pending: true });
	}

	if ((working || pendingUser.length > 0) && live.size === 0 && activeTools.size === 0) {
		items.push({ kind: "shimmer", id: "shimmer" });
	}

	return items;
}

// ---------------------------------------------------------------------------
// Row renderer
// ---------------------------------------------------------------------------

const RowRenderer = memo(function RowRenderer({ item, expandAll }: { item: RowItem; expandAll: boolean }): ReactNode {
	switch (item.kind) {
		case "user":
			return <UserRow content={item.content} timestamp={item.timestamp} pending={item.pending} />;
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

// Start fetching before the reader hits the very top so paging feels continuous.
const LOAD_OLDER_THRESHOLD_PX = 200;

export interface TranscriptViewProps {
	state: TranscriptState;
	streaming: boolean;
	expandAll: boolean;
	onLoadOlder?: () => Promise<void>;
}

export function TranscriptView({ state, streaming, expandAll, onLoadOlder }: TranscriptViewProps): ReactNode {
	const { entries, live, activeTools, working, pendingUser, entryKeys } = state;

	const results = useMemo(() => {
		const map = new Map<string, ToolResultMessage>();
		for (const entry of entries) {
			if (entry.type === "message" && entry.message.role === "toolResult") {
				map.set(entry.message.toolCallId, entry.message as unknown as ToolResultMessage);
			}
		}
		return map;
	}, [entries]);

	const isWorking = working || streaming;
	const items = useMemo(
		() => flattenEntries(entries, results, activeTools, live, isWorking, pendingUser, entryKeys),
		[entries, results, activeTools, live, isWorking, pendingUser, entryKeys],
	);

	const parentRef = useRef<HTMLDivElement | null>(null);
	const atBottomRef = useRef(true);
	const loadingOlderRef = useRef(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const prevItemCountRef = useRef(items.length);
	const prevFirstItemIdRef = useRef<string | undefined>(items[0]?.id);
	const prevScrollHeightRef = useRef<number>(0);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 48,
		overscan: 8,
		// Expand-all resizes many rows at once; measuring inside the observer
		// callback re-triggers it in the same frame and the browser reports a loop.
		useAnimationFrameWithResizeObserver: true,
	});

	const checkAtBottom = useCallback(() => {
		const el = parentRef.current;
		if (!el) return;
		prevScrollHeightRef.current = el.scrollHeight;
		const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
		const wasAtBottom = atBottomRef.current;
		atBottomRef.current = gap <= 60;
		if (atBottomRef.current && !wasAtBottom) {
			setUnreadCount(0);
		}
	}, []);

	const prevPendingCountRef = useRef(pendingUser.length);

	useEffect(() => {
		const userSentMessage = pendingUser.length > prevPendingCountRef.current;
		prevPendingCountRef.current = pendingUser.length;

		if (userSentMessage) {
			atBottomRef.current = true;
			setUnreadCount(0);
		}
		const totalAdded = items.length - prevItemCountRef.current;
		const prependIndex =
			prevFirstItemIdRef.current !== undefined ? items.findIndex(it => it.id === prevFirstItemIdRef.current) : -1;
		const prependedCount = prependIndex > 0 ? prependIndex : 0;
		const appendedCount = Math.max(0, totalAdded - prependedCount);

		if (atBottomRef.current && items.length > 0) {
			virtualizer.scrollToIndex(items.length - 1, { align: "end" });
			requestAnimationFrame(() => {
				if (parentRef.current && atBottomRef.current) {
					parentRef.current.scrollTop = parentRef.current.scrollHeight;
					prevScrollHeightRef.current = parentRef.current.scrollHeight;
				}
			});
		} else if (appendedCount > 0 && !atBottomRef.current) {
			setUnreadCount(c => c + appendedCount);
		}

		if (prependedCount > 0 && !atBottomRef.current) {
			const el = parentRef.current;
			if (el && prevScrollHeightRef.current > 0) {
				const prevHeight = prevScrollHeightRef.current;
				requestAnimationFrame(() => {
					if (parentRef.current && !atBottomRef.current) {
						const newHeight = parentRef.current.scrollHeight;
						parentRef.current.scrollTop += newHeight - prevHeight;
						prevScrollHeightRef.current = parentRef.current.scrollHeight;
					}
				});
			}
		} else if (parentRef.current) {
			prevScrollHeightRef.current = parentRef.current.scrollHeight;
		}

		prevItemCountRef.current = items.length;
		prevFirstItemIdRef.current = items[0]?.id;
	}, [items, pendingUser.length, virtualizer]);

	const hasMore = state.hasMore;
	const requestOlder = useCallback(() => {
		if (!onLoadOlder || !hasMore || loadingOlderRef.current) return;
		loadingOlderRef.current = true;
		// Scroll anchoring for the prepended rows happens in the items effect above.
		onLoadOlder().finally(() => {
			loadingOlderRef.current = false;
		});
	}, [onLoadOlder, hasMore]);

	useEffect(() => {
		const el = parentRef.current;
		if (!el || !onLoadOlder) return;
		const handler = () => {
			checkAtBottom();
			if (el.scrollTop <= LOAD_OLDER_THRESHOLD_PX) requestOlder();
		};
		el.addEventListener("scroll", handler, { passive: true });
		return () => el.removeEventListener("scroll", handler);
	}, [onLoadOlder, checkAtBottom, requestOlder]);

	// A page shorter than the viewport never scrolls, so no scroll event would
	// ever ask for the next one.
	useEffect(() => {
		const el = parentRef.current;
		if (el && el.scrollHeight <= el.clientHeight) requestOlder();
	}, [items, requestOlder]);

	useEffect(() => {
		if (onLoadOlder) return;
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
