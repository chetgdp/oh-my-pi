import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RpcConnectionState } from "../../lib/rpc-client";
import { type RowItem, type TranscriptState, extractToolResults, flattenEntries } from "../../lib/transcript-model";
import { type BrowserResizeObserver, type BrowserResizeObserverEntry, browserWindow } from "../../lib/dom";
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
// Row models: flatten SessionEntry[] + live + activeTools into a flat list.
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

interface RowProps {
	item: RowItem;
	isLast: boolean;
	expandAll: boolean;
	onRewind?: (entryId: string) => void;
	canRewind: boolean;
	onRetry?: () => void;
	canRetry: boolean;
	host?: ToolRenderHost;
	rowRef: (node: HTMLDivElement | null) => () => void;
}

const TranscriptRow = memo(function TranscriptRow({
	item,
	isLast,
	expandAll,
	onRewind,
	canRewind,
	onRetry,
	canRetry,
	host,
	rowRef,
}: RowProps): ReactNode {
	return (
		<div
			ref={rowRef}
			className="tr-item"
			data-row-id={item.id}
			style={isLast ? { paddingBottom: END_PADDING_PX } : undefined}
		>
			<RowRenderer
				item={item}
				expandAll={expandAll}
				host={host}
				onRewind={onRewind}
				canRewind={canRewind}
				onRetry={onRetry}
				canRetry={canRetry}
			/>
		</div>
	);
});

// ---------------------------------------------------------------------------
// TranscriptView
// ---------------------------------------------------------------------------

// Start fetching before the reader hits the very top so paging feels continuous.
const LOAD_OLDER_THRESHOLD_PX = 1500;
const END_PADDING_PX = 16;
// The scroller is column-reverse: scrollTop is 0 at the bottom and negative above.
const AT_BOTTOM_PX = 60;

/**
 * Scroll correction for a row that changed height by `delta` while the reader
 * is scrolled up. Column-reverse keeps the content's bottom edge fixed, so the
 * change moves everything above the row's bottom edge. Rows are assumed to
 * change at their end (streamed text, tool output, expanding bodies), so a row
 * ending on or below the viewport top would drag what is on screen; one ending
 * above it moves nothing visible. `rowBottom` and `viewportTop` share
 * coordinates. Returns the amount to subtract from scrollTop.
 */
export function scrollCompensation(rowBottom: number, delta: number, viewportTop: number): number {
	return rowBottom >= viewportTop ? delta : 0;
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

	// iOS cancels touch and momentum scrolling on any programmatic scroll write,
	// so corrections wait until the finger is up and momentum has stopped.
	// Scroll events seen while interacting are the user's own, since we write none then.
	const touchingRef = useRef(false);
	const settleTimerRef = useRef<Timer | number | null>(null);
	const lastScrollTopRef = useRef(0);
	// Correction owed for changes below the reading position, not yet written.
	const pendingShiftRef = useRef(0);
	const rowMountedRef = useRef(false);
	const armSettleRef = useRef<() => void>(() => {});

	const checkAtBottom = useCallback(() => {
		const el = parentRef.current;
		if (!el) return;
		const moved = el.scrollTop - lastScrollTopRef.current;
		lastScrollTopRef.current = el.scrollTop;
		const wasAtBottom = atBottomRef.current;
		if (touchingRef.current || settleTimerRef.current !== null) {
			if (settleTimerRef.current !== null) armSettleRef.current();
			// Any upward user motion releases the pin, even inside the 60px band;
			// only downward motion may re-pin before the gesture settles.
			if (moved <= 0) {
				if (moved < 0) atBottomRef.current = false;
				return;
			}
		}
		atBottomRef.current = el.scrollTop > -AT_BOTTOM_PX;
		if (atBottomRef.current && !wasAtBottom) {
			setUnreadCount(0);
		}
	}, []);

	const flushShift = useCallback(() => {
		const el = parentRef.current;
		const shift = pendingShiftRef.current;
		pendingShiftRef.current = 0;
		if (!el || shift === 0 || atBottomRef.current) return;
		el.scrollTop -= shift;
		lastScrollTopRef.current = el.scrollTop;
	}, []);

	// Heights from the previous observation; a row's first entry has none.
	const rowHeightsRef = useRef(new WeakMap<object, number>());
	const observerRef = useRef<BrowserResizeObserver | null>(null);
	const onRowsResized = useCallback(
		(resized: BrowserResizeObserverEntry[]) => {
			const heights = rowHeightsRef.current;
			// Sizes are recorded even when pinned so a later delta starts from the truth.
			// Pinned, the bottom anchor already follows and nothing here reads layout.
			const changes: Array<{ node: HTMLDivElement; delta: number }> = [];
			for (const entry of resized) {
				const size = entry.borderBoxSize?.[0]?.blockSize;
				if (size === undefined) continue;
				const node = entry.target as HTMLDivElement;
				const delta = size - (heights.get(node) ?? 0);
				heights.set(node, size);
				if (delta !== 0) changes.push({ node, delta });
			}
			const el = parentRef.current;
			if (!el || atBottomRef.current || changes.length === 0) return;
			// Observer callbacks run after layout, so these reads do not force one.
			const viewportTop = el.getBoundingClientRect().top;
			for (const { node, delta } of changes) {
				pendingShiftRef.current += scrollCompensation(node.getBoundingClientRect().bottom, delta, viewportTop);
			}
			if (!touchingRef.current && settleTimerRef.current === null) flushShift();
		},
		[flushShift],
	);

	const rowRef = useCallback(
		(node: HTMLDivElement | null) => {
			const Observer = browserWindow.ResizeObserver;
			if (!node || !Observer) return () => {};
			observerRef.current ??= new Observer(onRowsResized);
			const observer = observerRef.current;
			observer.observe(node);
			rowMountedRef.current = true;
			return () => {
				observer.unobserve(node);
				const height = rowHeightsRef.current.get(node);
				const el = parentRef.current;
				if (height === undefined || !el || atBottomRef.current) return;
				// Ref cleanup runs before the node leaves the DOM, so its position is still readable.
				const bottom = node.getBoundingClientRect().bottom;
				pendingShiftRef.current += scrollCompensation(bottom, -height, el.getBoundingClientRect().top);
			};
		},
		[onRowsResized],
	);

	// A removal with no accompanying mount gets no observer callback, so apply it
	// once the commit has laid out. With a mount, the observer applies the net
	// change in one write: applying the removal first could clamp at the bottom.
	useLayoutEffect(() => {
		const mounted = rowMountedRef.current;
		rowMountedRef.current = false;
		if (!mounted && pendingShiftRef.current !== 0 && !touchingRef.current && settleTimerRef.current === null) {
			flushShift();
		}
	});

	useEffect(() => () => observerRef.current?.disconnect(), []);

	const scrollToBottom = useCallback(() => {
		atBottomRef.current = true;
		pendingShiftRef.current = 0;
		setUnreadCount(0);
		const el = parentRef.current;
		if (!el) return;
		el.scrollTo({ top: 0 });
		lastScrollTopRef.current = el.scrollTop;
	}, []);

	const prevPendingCountRef = useRef(pendingUser.length);

	useEffect(() => {
		const userSentMessage = pendingUser.length > prevPendingCountRef.current;
		prevPendingCountRef.current = pendingUser.length;

		if (userSentMessage) scrollToBottom();
		const totalAdded = items.length - prevItemCountRef.current;
		const prependIndex =
			prevFirstItemIdRef.current !== undefined ? items.findIndex(it => it.id === prevFirstItemIdRef.current) : -1;
		const prependedCount = prependIndex > 0 ? prependIndex : 0;
		const appendedCount = Math.max(0, totalAdded - prependedCount);
		if (appendedCount > 0 && !atBottomRef.current) {
			setUnreadCount(c => c + appendedCount);
		}
		prevItemCountRef.current = items.length;
		prevFirstItemIdRef.current = items[0]?.id;
	}, [items, pendingUser.length, scrollToBottom]);

	// Momentum keeps emitting scroll events after touchend; settle 150ms after
	// the last one, then apply the correction owed and re-check.
	const armSettle = useCallback(() => {
		clearTimeout(settleTimerRef.current ?? undefined);
		settleTimerRef.current = setTimeout(() => {
			settleTimerRef.current = null;
			if (touchingRef.current) return;
			flushShift();
			checkAtBottom();
		}, 150);
	}, [checkAtBottom, flushShift]);
	armSettleRef.current = armSettle;

	useEffect(() => {
		const el = parentRef.current;
		if (!el) return;
		const onStart = () => {
			touchingRef.current = true;
			if (settleTimerRef.current !== null) {
				clearTimeout(settleTimerRef.current);
				settleTimerRef.current = null;
			}
		};
		const onEnd = () => {
			touchingRef.current = false;
			armSettleRef.current();
		};
		el.addEventListener("touchstart", onStart, { passive: true });
		el.addEventListener("touchend", onEnd, { passive: true });
		el.addEventListener("touchcancel", onEnd, { passive: true });
		return () => {
			el.removeEventListener("touchstart", onStart);
			el.removeEventListener("touchend", onEnd);
			el.removeEventListener("touchcancel", onEnd);
			clearTimeout(settleTimerRef.current ?? undefined);
		};
	}, []);

	const hasMore = state.hasMore;
	const requestOlder = useCallback(() => {
		if (!onLoadOlder || !hasMore || loadingOlderRef.current) return;
		loadingOlderRef.current = true;
		setIsLoadingOlder(true);
		// Prepended rows land above the reading position; the bottom anchor keeps it still.
		onLoadOlder().finally(() => {
			loadingOlderRef.current = false;
			setIsLoadingOlder(false);
		});
	}, [onLoadOlder, hasMore]);

	useEffect(() => {
		const el = parentRef.current;
		if (!el) return;
		const handler = () => {
			checkAtBottom();
			if (onLoadOlder && el.scrollHeight - el.clientHeight + el.scrollTop <= LOAD_OLDER_THRESHOLD_PX) {
				requestOlder();
			}
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

	const canAct = !isWorking;
	const lastIndex = items.length - 1;

	return (
		<div className="tr-root" ref={parentRef}>
			{!atBottomRef.current && unreadCount > 0 && (
				<div className="tr-jump-slot">
					<button type="button" className="tr-jump-bottom" onClick={scrollToBottom} aria-label="Jump to bottom">
						<ArrowDown size={16} />
						<span className="tr-jump-count">{unreadCount}</span>
					</button>
				</div>
			)}
			<div className="tr-list">
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
				{items.map((item, index) => (
					<TranscriptRow
						key={item.id}
						item={item}
						isLast={index === lastIndex}
						expandAll={expandAll}
						host={toolHost}
						onRewind={onRewind}
						canRewind={canAct}
						onRetry={onRetry}
						canRetry={canAct}
						rowRef={rowRef}
					/>
				))}
			</div>
		</div>
	);
}
