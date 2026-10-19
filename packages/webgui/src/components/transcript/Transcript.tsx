import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type TouchTarget = Pick<HTMLDivElement, "addEventListener" | "removeEventListener">;

function isTouchTarget(value: unknown): value is TouchTarget {
	return !!value && typeof value === "object" && "addEventListener" in value && "removeEventListener" in value;
}

/** Fingers still down after a touch event; 0 when the event carries no touch list. */
function activeTouches(event: unknown): number {
	if (!event || typeof event !== "object" || !("touches" in event)) return 0;
	const touches = event.touches;
	return touches && typeof touches === "object" && "length" in touches && typeof touches.length === "number"
		? touches.length
		: 0;
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
	/** Messages queued on the server while the agent is busy. */
	queue?: TranscriptQueue;
	onRemoveQueued?: (message: string, queue: QueueKind) => void;
}

export type QueueKind = "steering" | "followUp";
export interface TranscriptQueue {
	steering: readonly string[];
	followUp: readonly string[];
}

const EMPTY_QUEUE: TranscriptQueue = { steering: [], followUp: [] };

/**
 * Steering texts delivered during the current turn: entries that left the
 * steering queue while streaming accumulate; everything clears at turn end.
 */
export function nextDeliveredSteers(
	prevSteering: readonly string[],
	nextSteering: readonly string[],
	delivered: readonly string[],
	streaming: boolean,
): readonly string[] {
	if (!streaming) return delivered.length === 0 ? delivered : [];
	const left = prevSteering.filter(text => !nextSteering.includes(text));
	return left.length === 0 ? delivered : [...delivered, ...left];
}

export interface QueueTailProps {
	queue: TranscriptQueue;
	delivered: readonly string[];
	onRemoveQueued?: (message: string, queue: QueueKind) => void;
	/** Same resize-observer ref as transcript rows, so tail changes keep a scrolled-up reader in place. */
	rowRef?: (node: HTMLDivElement | null) => () => void;
}

/** Delivered-steer markers and dashed queued bubbles rendered after the last row. */
export function QueueTail({ queue, delivered, onRemoveQueued, rowRef }: QueueTailProps): ReactNode {
	const bubble = (text: string, kind: QueueKind, index: number): ReactNode => (
		<div key={`q-${kind}-${index}`} ref={rowRef} className="tr-row tr-row--queued" data-queue={kind}>
			<div className="tr-queued">
				<span className="tr-queued-body">
					<small className="tr-queued-label">
						{kind === "steering" ? "Steer · next tool boundary" : "Queued · sends after this turn"}
					</small>
					{text}
				</span>
				<button
					type="button"
					className="tr-queued-remove"
					aria-label="Remove queued message"
					onClick={() => onRemoveQueued?.(text, kind)}
				>
					✕
				</button>
			</div>
		</div>
	);
	return (
		<>
			{delivered.map((text, i) => (
				<div key={`d-${i}`} ref={rowRef} className="tr-row tr-row--marker" title={text}>
					<span className="tr-marker">Steer delivered</span>
				</div>
			))}
			{queue.steering.map((t, i) => bubble(t, "steering", i))}
			{queue.followUp.map((t, i) => bubble(t, "followUp", i))}
		</>
	);
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
	queue = EMPTY_QUEUE,
	onRemoveQueued,
}: TranscriptViewProps): ReactNode {
	const { entries, live, activeTools, working, entryKeys } = state;
	// A pending send already shown as a queued bubble must not render twice.
	const pendingUser = useMemo(() => {
		if (queue.steering.length === 0 && queue.followUp.length === 0) return state.pendingUser;
		return state.pendingUser.filter(p => !queue.steering.includes(p.text) && !queue.followUp.includes(p.text));
	}, [state.pendingUser, queue]);

	const results = useMemo(() => extractToolResults(entries), [entries]);

	const isWorking = working || streaming;
	const prevSteeringRef = useRef(queue.steering);
	const [delivered, setDelivered] = useState<readonly string[]>([]);
	useEffect(() => {
		const prev = prevSteeringRef.current;
		prevSteeringRef.current = queue.steering;
		setDelivered(d => nextDeliveredSteers(prev, queue.steering, d, isWorking));
	}, [queue.steering, isWorking]);
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
	// so while a gesture is held (finger down, momentum, wheel) corrections move
	// `.tr-list` with a bottom margin instead, folded into scrollTop at settle.
	// Scroll events with movement are the user's own: our writes update lastScrollTopRef.
	const listRef = useRef<HTMLDivElement | null>(null);
	const touchingRef = useRef(false);
	const touchMovedRef = useRef(false);
	const settleTimerRef = useRef<Timer | number | null>(null);
	const lastScrollTopRef = useRef(0);
	// Reading anchor: a row near the viewport top, its bottom relative to the
	// viewport bottom (the column-reverse origin, so viewport resizes are not
	// drift) and the scrollTop when measured. The bottom edge, not the top: a row
	// entering from above first paints at its 120px placeholder and grows upward,
	// which must not count as drift.
	const anchorRef = useRef<{ node: HTMLDivElement["children"][number]; bottom: number; st: number } | null>(null);
	// Held correction currently applied as margin; positive moves the list down.
	const offsetRef = useRef(0);
	const armSettleRef = useRef<() => void>(() => {});

	const holding = (): boolean => touchingRef.current || settleTimerRef.current !== null;

	const setOffset = useCallback((value: number) => {
		offsetRef.current = value;
		const list = listRef.current;
		if (list) list.style.setProperty("margin-bottom", value === 0 ? "" : `${-value}px`);
	}, []);

	const captureAnchor = useCallback(
		(el: HTMLDivElement, list: HTMLDivElement, viewTop: number, viewBottom: number) => {
			// Rows are in DOM order top to bottom; binary search keeps this to O(log n) reads.
			const kids = list.children;
			let lo = 0;
			let hi = kids.length - 1;
			let found: (typeof kids)[number] | null = null;
			while (lo <= hi) {
				const mid = (lo + hi) >> 1;
				const kid = kids[mid];
				if (kid.getBoundingClientRect().bottom > viewTop) {
					found = kid;
					hi = mid - 1;
				} else {
					lo = mid + 1;
				}
			}
			anchorRef.current = found
				? { node: found, bottom: found.getBoundingClientRect().bottom - viewBottom, st: el.scrollTop }
				: null;
		},
		[],
	);

	/** Restore the anchor's expected screen position, then re-anchor at the viewport top. */
	const reanchor = useCallback(() => {
		const el = parentRef.current;
		const list = listRef.current;
		if (!el || !list) return;
		if (atBottomRef.current) {
			anchorRef.current = null;
			return;
		}
		let box = el.getBoundingClientRect();
		const a = anchorRef.current;
		if (a?.node.isConnected) {
			const expected = a.bottom - (el.scrollTop - a.st);
			const shift = expected - (a.node.getBoundingClientRect().bottom - box.bottom);
			if (Math.abs(shift) >= 0.5) {
				if (holding()) {
					setOffset(offsetRef.current + shift);
				} else {
					el.scrollTop -= shift;
					lastScrollTopRef.current = el.scrollTop;
				}
				box = el.getBoundingClientRect();
			}
		}
		captureAnchor(el, list, box.top, box.bottom);
	}, [captureAnchor, setOffset]);

	const checkAtBottom = useCallback(() => {
		const el = parentRef.current;
		if (!el) return;
		const moved = el.scrollTop - lastScrollTopRef.current;
		lastScrollTopRef.current = el.scrollTop;
		if (moved !== 0) {
			if (touchingRef.current) touchMovedRef.current = true;
			else armSettleRef.current();
		}
		const wasAtBottom = atBottomRef.current;
		if (holding()) {
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

	const observerRef = useRef<BrowserResizeObserver | null>(null);
	const rowRef = useCallback(
		(node: HTMLDivElement | null) => {
			const Observer = browserWindow.ResizeObserver;
			if (!node || !Observer) return () => {};
			// Callbacks run after layout, so the reads in reanchor do not force one.
			// Pinned, reanchor reads nothing: the bottom anchor already follows.
			observerRef.current ??= new Observer(() => reanchor());
			const observer = observerRef.current;
			observer.observe(node);
			return () => observer.unobserve(node);
		},
		[reanchor],
	);

	// Corrections run only in observer callbacks, never at commit: a forced
	// layout in a layout effect precedes the frame's own layout, in which
	// content-visibility may skip a row that just grew and restore its last
	// observed size, so a commit-time correction can be wrong by paint time.
	// The list is observed so removals, which resize no remaining row, still
	// report.
	const setList = useCallback(
		(node: HTMLDivElement | null) => {
			listRef.current = node;
			const unobserve = rowRef(node);
			return () => {
				unobserve();
				listRef.current = null;
			};
		},
		[rowRef],
	);

	useEffect(() => () => observerRef.current?.disconnect(), []);

	const scrollToBottom = useCallback(() => {
		atBottomRef.current = true;
		anchorRef.current = null;
		setOffset(0);
		setUnreadCount(0);
		const el = parentRef.current;
		if (!el) return;
		el.scrollTo({ top: 0 });
		lastScrollTopRef.current = el.scrollTop;
	}, [setOffset]);

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

	// Fold the held margin into scrollTop in one task (no visible movement), then
	// re-check the pin. Inside the band the pin closes the gap so the tail shows.
	const settle = useCallback(() => {
		const el = parentRef.current;
		if (!el || holding()) return;
		const off = offsetRef.current;
		if (off !== 0) {
			setOffset(0);
			if (!atBottomRef.current) {
				el.scrollTop -= off;
				const a = anchorRef.current;
				if (a) a.st -= off;
			}
			lastScrollTopRef.current = el.scrollTop;
		}
		checkAtBottom();
		if (atBottomRef.current) {
			anchorRef.current = null;
			if (el.scrollTop !== 0) {
				el.scrollTo({ top: 0 });
				lastScrollTopRef.current = el.scrollTop;
			}
		} else {
			reanchor();
		}
	}, [checkAtBottom, reanchor, setOffset]);

	// Momentum and wheel input keep emitting events; settle 150ms after the last one.
	const armSettle = useCallback(() => {
		clearTimeout(settleTimerRef.current ?? undefined);
		settleTimerRef.current = setTimeout(() => {
			settleTimerRef.current = null;
			settle();
		}, 150);
	}, [settle]);
	armSettleRef.current = armSettle;

	useEffect(() => {
		const el = parentRef.current;
		if (!el) return;
		// touchend fires at the touchstart target even after it leaves the DOM,
		// where it no longer bubbles here; listening on the target itself keeps
		// the touching flag from sticking.
		const targets = new Set<TouchTarget>();
		const detach = () => {
			for (const t of targets) {
				t.removeEventListener("touchend", onEnd);
				t.removeEventListener("touchcancel", onEnd);
			}
			targets.clear();
		};
		const onStart = (e: unknown) => {
			if (!touchingRef.current) touchMovedRef.current = false;
			touchingRef.current = true;
			if (settleTimerRef.current !== null) {
				clearTimeout(settleTimerRef.current);
				settleTimerRef.current = null;
			}
			const target = e && typeof e === "object" && "target" in e && isTouchTarget(e.target) ? e.target : el;
			if (!targets.has(target)) {
				targets.add(target);
				target.addEventListener("touchend", onEnd, { passive: true });
				target.addEventListener("touchcancel", onEnd, { passive: true });
			}
		};
		function onEnd(e: unknown) {
			if (activeTouches(e) > 0) return;
			detach();
			touchingRef.current = false;
			// A tap moved nothing, so no momentum follows: correct now.
			if (touchMovedRef.current) armSettle();
			else settle();
		}
		const onWheel = () => {
			if (!touchingRef.current) armSettle();
		};
		el.addEventListener("touchstart", onStart, { passive: true });
		el.addEventListener("wheel", onWheel, { passive: true });
		return () => {
			el.removeEventListener("touchstart", onStart);
			el.removeEventListener("wheel", onWheel);
			detach();
			clearTimeout(settleTimerRef.current ?? undefined);
		};
	}, [armSettle, settle]);

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
			reanchor();
			if (onLoadOlder && el.scrollHeight - el.clientHeight + el.scrollTop <= LOAD_OLDER_THRESHOLD_PX) {
				requestOlder();
			}
		};
		el.addEventListener("scroll", handler, { passive: true });
		return () => el.removeEventListener("scroll", handler);
	}, [onLoadOlder, checkAtBottom, reanchor, requestOlder]);

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
			<div className="tr-list" ref={setList}>
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
				<QueueTail queue={queue} delivered={delivered} onRemoveQueued={onRemoveQueued} rowRef={rowRef} />
			</div>
		</div>
	);
}
