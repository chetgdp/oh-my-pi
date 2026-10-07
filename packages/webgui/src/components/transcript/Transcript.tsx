import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RpcConnectionState } from "../../lib/rpc-client";
import { type RowItem, type TranscriptState, extractToolResults, flattenEntries } from "../../lib/transcript-model";
import { type BrowserResizeObserver, browserWindow } from "../../lib/dom";
import { Markdown } from "./Markdown";
import { ToolCard } from "./ToolCard";
import type { ToolRenderHost } from "./tool-views/types";
import { DeveloperRow } from "./rows/DeveloperRow";
import { ThinkingRow } from "./rows/ThinkingRow";
import { UserRow } from "./rows/UserRow";
import { SpeakButton } from "./SpeakButton";
import "./transcript.css";

export {
	type RowItem,
	type UserItem,
	type AssistantTextItem,
	type AssistantImageItem,
	type ThinkingItem,
	type ToolCallItem,
	type DeveloperItem,
	type DividerItem,
	type MarkerItem,
	type StopItem,
	type ShimmerItem,
	flattenEntries,
	coalesceTodoRuns,
	buildTranscriptRows,
} from "../../lib/transcript-model";

// ---------------------------------------------------------------------------
// Row models: flatten SessionEntry[] + live + activeTools into a flat list
// that the virtualizer can index.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Row renderer
// ---------------------------------------------------------------------------

const RowRenderer = memo(function RowRenderer({
	item,
	expandAll,
	onRewind,
	canRewind,
	onRetry,
	host,
	canRetry,
}: {
	item: RowItem;
	expandAll: boolean;
	onRewind?: (entryId: string) => void;
	canRewind?: boolean;
	onRetry?: () => void;
	host?: ToolRenderHost;
	canRetry?: boolean;
}): ReactNode {
	switch (item.kind) {
		case "user":
			return (
				<UserRow
					content={item.content}
					timestamp={item.timestamp}
					pending={item.pending}
					entryId={item.entryId}
					reaction={item.reaction}
					onRewind={onRewind}
					canRewind={canRewind}
				/>
			);
		case "assistant-text":
			if (!item.text) return null;
			return (
				<div className="tr-row tr-row--assistant">
					<div className="tr-body">
						<Markdown text={item.text} />
					</div>
					<div className="tr-assistant-actions">
						<SpeakButton text={item.text} />
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
							liveDetails={item.liveDetails}
							expandAll={expandAll}
							host={host}
							groupCount={item.groupCount}
						/>
					</div>
				</div>
			);
		case "developer":
			return <DeveloperRow content={item.content} timestamp={item.timestamp} label={item.label} />;
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
					{onRetry && (item.reason === "error" || item.reason === "aborted") && (
						<button
							type="button"
							className="tr-retry-btn"
							onClick={onRetry}
							disabled={!canRetry}
							aria-label="Retry failed turn"
						>
							Retry
						</button>
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
const LOAD_OLDER_THRESHOLD_PX = 1500;

export function shouldAdjustScrollOnItemSizeChange(
	item: { end: number },
	hasCachedSize: boolean,
	scrollOffset: number,
	scrollAdjustments: number,
	scrollDirection: "forward" | "backward" | null,
): boolean {
	// First measurements of prepended rows entering the top must not push the
	// viewport down while scrolling up.
	if (!hasCachedSize) {
		return false;
	}
	// Subsequent size changes of rows above the viewport (e.g. an expanded tool
	// card) must compensate so reading position stays stable, unless scrolling up.
	const scrollOffsetWithAdj = scrollOffset + scrollAdjustments;
	return item.end <= scrollOffsetWithAdj && scrollDirection !== "backward";
}
export interface TranscriptViewProps {
	state: TranscriptState;
	historyLoaded?: boolean;
	connection?: RpcConnectionState;
	streaming: boolean;
	expandAll: boolean;
	onLoadOlder?: () => Promise<void>;
	onRewind?: (entryId: string) => void;
	onRetry?: () => void;
	/** Host capabilities for tool cards (agent drill-down links). */
	toolHost?: ToolRenderHost;
}

export function TranscriptView({
	state,
	historyLoaded = true,
	connection = "ready",
	streaming,
	expandAll,
	onLoadOlder,
	onRewind,
	onRetry,
	toolHost,
}: TranscriptViewProps): ReactNode {
	const { entries, live, activeTools, working, pendingUser, entryKeys } = state;

	const results = useMemo(() => extractToolResults(entries), [entries]);

	const isWorking = working || streaming;
	const items = useMemo(
		() => flattenEntries(entries, results, activeTools, live, isWorking, pendingUser, entryKeys),
		[entries, results, activeTools, live, isWorking, pendingUser, entryKeys],
	);

	const parentRef = useRef<HTMLDivElement | null>(null);
	const atBottomRef = useRef(true);
	const loadingOlderRef = useRef(false);
	const [isLoadingOlder, setIsLoadingOlder] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const prevItemCountRef = useRef(items.length);
	const prevFirstItemIdRef = useRef<string | undefined>(items[0]?.id);
	const itemsRef = useRef(items);
	itemsRef.current = items;

	const getItemKey = useCallback((index: number) => itemsRef.current[index]?.id ?? index, []);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 120,
		getItemKey,
		anchorTo: "end",
		overscan: 8,
		paddingEnd: 16,
		scrollPaddingEnd: 16,
		// Expand-all resizes many rows at once; measuring inside the observer
		// callback re-triggers it in the same frame and the browser reports a loop.
		useAnimationFrameWithResizeObserver: true,
	});

	virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance) =>
		shouldAdjustScrollOnItemSizeChange(
			item,
			instance.itemSizeCache.has(item.key),
			instance.scrollOffset ?? 0,
			instance.scrollAdjustments,
			instance.scrollDirection,
		);

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

		const countChanged = items.length !== prevItemCountRef.current;
		if (atBottomRef.current && items.length > 0) {
			if (countChanged || userSentMessage) {
				virtualizer.scrollToIndex(items.length - 1, { align: "end" });
				requestAnimationFrame(() => {
					if (parentRef.current && atBottomRef.current) {
						parentRef.current.scrollTop = parentRef.current.scrollHeight;
					}
				});
			}
		} else if (appendedCount > 0 && !atBottomRef.current) {
			setUnreadCount(c => c + appendedCount);
		}
		prevItemCountRef.current = items.length;
		prevFirstItemIdRef.current = items[0]?.id;
	}, [items.length, pendingUser.length, virtualizer]);

	// Streaming grows the last row without changing the count. Re-pin on total
	// size instead; the oversized write is clamped by the browser, so no layout
	// read is needed here.
	const totalSize = virtualizer.getTotalSize();
	useLayoutEffect(() => {
		const el = parentRef.current;
		if (el && atBottomRef.current) el.scrollTop = Number.MAX_SAFE_INTEGER;
	}, [totalSize]);

	// The virtualizer measures on the next animation frame, so total size can
	// lag a streaming row by a frame. Observing the last row re-pins as soon as
	// layout settles.
	const lastRowObserverRef = useRef<BrowserResizeObserver | null>(null);
	const lastRowRef = useCallback(
		(node: HTMLDivElement | null) => {
			virtualizer.measureElement(node);
			const Observer = browserWindow.ResizeObserver;
			if (!Observer) return;
			lastRowObserverRef.current ??= new Observer(() => {
				const el = parentRef.current;
				if (el && atBottomRef.current) el.scrollTop = Number.MAX_SAFE_INTEGER;
			});
			lastRowObserverRef.current.disconnect();
			if (node) lastRowObserverRef.current.observe(node);
		},
		[virtualizer],
	);
	useEffect(() => () => lastRowObserverRef.current?.disconnect(), []);

	const hasMore = state.hasMore;
	const requestOlder = useCallback(() => {
		if (!onLoadOlder || !hasMore || loadingOlderRef.current) return;
		loadingOlderRef.current = true;
		setIsLoadingOlder(true);
		// TanStack Virtual anchors prepended rows natively before paint via anchorTo: "end".
		onLoadOlder().finally(() => {
			loadingOlderRef.current = false;
			setIsLoadingOlder(false);
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
	}, [items.length, hasMore, requestOlder]);

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
			{isLoadingOlder && (
				<div className="tr-loading-older" role="status" aria-label="Loading older messages">
					<span className="tr-spin" aria-hidden="true" />
				</div>
			)}
			{items.length === 0 &&
				(historyLoaded ? (
					<div className="tr-empty">no activity yet</div>
				) : (
					<div className="tr-empty tr-empty--loading" role="status" aria-live="polite">
						<span className="tr-spin tr-spin--lg" aria-hidden="true" />
						<span>{connection === "ready" ? "Loading history…" : "Connecting…"}</span>
					</div>
				))}
			<div className="tr-virtual-space" style={{ height: `${totalSize}px` }}>
				{virtualItems.map(virtualRow => {
					const item = items[virtualRow.index];
					return (
						<div
							key={item.id}
							data-index={virtualRow.index}
							ref={virtualRow.index === items.length - 1 ? lastRowRef : virtualizer.measureElement}
							className="tr-virtual-row"
							style={{ transform: `translateY(${virtualRow.start}px)` }}
						>
							<RowRenderer
								item={item}
								expandAll={expandAll}
								host={toolHost}
								onRewind={onRewind}
								canRewind={!isWorking}
								onRetry={onRetry}
								canRetry={!isWorking}
							/>
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
