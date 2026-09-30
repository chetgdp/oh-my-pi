import { type ReactNode, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { HubRow } from "../../lib/agent-hub-model";
import { agentIdLabel, entryMetrics } from "../../lib/agent-hub-model";
import { fmtCost, fmtTokens } from "../../lib/format";

/** Above this many rows only the visible window is mounted. */
export const VIRTUALIZE_THRESHOLD = 200;
const ROW_HEIGHT = 44;

function Row(props: {
	row: HubRow;
	selected: boolean;
	tree: boolean;
	onSelect(id: string): void;
	onOpen(id: string): void;
}): ReactNode {
	const { row, selected, tree, onSelect, onOpen } = props;
	const { entry } = row;
	const m = entryMetrics(entry);
	const ref = useRef<HTMLButtonElement | null>(null);
	useEffect(() => {
		if (selected) ref.current?.scrollIntoView?.({ block: "nearest" });
	}, [selected]);
	return (
		<button
			ref={ref}
			type="button"
			className="ah-row"
			data-selected={selected ? "true" : undefined}
			data-agent-id={entry.id}
			style={{ paddingLeft: 8 + (tree ? row.depth * 16 : 0) }}
			onClick={() => onSelect(entry.id)}
			onDoubleClick={() => onOpen(entry.id)}
		>
			<span className={`ah-dot ah-dot--${entry.status}`} title={entry.status} />
			<span className="ah-row-main">
				<span className="ah-row-name">
					<span className="ah-row-label">{agentIdLabel(entry.id)}</span>
					{entry.agent && entry.kind === "sub" ? <span className="ah-chip">{entry.agent}</span> : null}
				</span>
				<span className="ah-row-sub">{entry.activity ?? entry.description ?? entry.task ?? entry.status}</span>
			</span>
			{(entry.unreadIrc ?? 0) > 0 && <span className="ah-badge ah-badge--accent">{entry.unreadIrc}</span>}
			{m && (
				<span className="ah-row-metrics">
					{fmtTokens(m.tokens)} · {fmtCost(m.cost)}
				</span>
			)}
		</button>
	);
}

export function HubTree(props: {
	rows: readonly HubRow[];
	tree: boolean;
	selectedId: string | null;
	onSelect(id: string): void;
	onOpen(id: string): void;
}): ReactNode {
	const { rows, tree, selectedId, onSelect, onOpen } = props;
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const virtual = rows.length > VIRTUALIZE_THRESHOLD;
	const virtualizer = useVirtualizer({
		count: virtual ? rows.length : 0,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 12,
	});

	const selectedIndex = selectedId === null ? -1 : rows.findIndex(r => r.entry.id === selectedId);
	useEffect(() => {
		if (selectedIndex < 0) return;
		if (virtual) virtualizer.scrollToIndex(selectedIndex);
	}, [selectedIndex, virtual, virtualizer]);

	if (rows.length === 0) return <div className="ah-empty">No agents match.</div>;

	return (
		<div className="ah-tree" ref={scrollRef} role="listbox" aria-label="Agents">
			{virtual ? (
				<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
					{virtualizer.getVirtualItems().map(item => {
						const row = rows[item.index];
						return (
							<div
								key={row.entry.id}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									height: item.size,
									transform: `translateY(${item.start}px)`,
								}}
							>
								<Row
									row={row}
									tree={tree}
									selected={row.entry.id === selectedId}
									onSelect={onSelect}
									onOpen={onOpen}
								/>
							</div>
						);
					})}
				</div>
			) : (
				rows.map(row => (
					<Row
						key={row.entry.id}
						row={row}
						tree={tree}
						selected={row.entry.id === selectedId}
						onSelect={onSelect}
						onOpen={onOpen}
					/>
				))
			)}
		</div>
	);
}
