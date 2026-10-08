import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AgentHubState } from "../../lib/agent-hub-model";
import { agentIdLabel, buildHubRows, childrenOf, computeTotals, parentOf } from "../../lib/agent-hub-model";
import { isFocusable } from "../../lib/focus-model";
import { browserWindow } from "../../lib/dom";
import { draftKey } from "../../lib/drafts";
import { fmtCost, fmtTokens } from "../../lib/format";
import { notify } from "../../lib/notify";
import { killAgent, reviveAgent, type SessionCommandSink } from "../../lib/session-actions";
import type { ToolRenderHost } from "../transcript/tool-views/types";
import { HubDetail } from "./HubDetail";
import { HubTranscript } from "./HubTranscript";
import { HubTree } from "./HubTree";
import "./agent-hub.css";

export interface AgentHubScreenProps {
	hub: AgentHubState;
	sink: SessionCommandSink | null;
	/** Scopes steer-box drafts to this session. */
	instanceId: string;
	/** Agent to select and open (from a task card link or the route). */
	focusAgentId?: string;
	/** Focus the main view on this agent and close the hub (TUI: Enter on a live agent). */
	onFocusAgent(id: string): void;
	onClose(): void;
}

type Tab = "details" | "transcript";

function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function isTypingTarget(target: unknown): boolean {
	const tag = (target as { tagName?: string } | null)?.tagName;
	return tag === "INPUT" || tag === "TEXTAREA";
}

export function AgentHubScreen({
	hub,
	sink,
	instanceId,
	focusAgentId,
	onFocusAgent,
	onClose,
}: AgentHubScreenProps): ReactNode {
	const [tree, setTree] = useState(true);
	const [filter, setFilter] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(focusAgentId ?? null);
	const [tab, setTab] = useState<Tab>("details");
	const [detailOpen, setDetailOpen] = useState(focusAgentId !== undefined);
	const [confirmKill, setConfirmKill] = useState<string | null>(null);
	const filterRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (focusAgentId === undefined) return;
		setSelectedId(focusAgentId);
		setDetailOpen(true);
		setTab("transcript");
	}, [focusAgentId]);

	const rows = useMemo(() => buildHubRows(hub.agents, { tree, filter }), [hub.agents, tree, filter]);
	const totals = useMemo(() => computeTotals(hub.agents), [hub.agents]);

	// Keep a valid selection as the roster changes.
	const effectiveId =
		selectedId !== null && rows.some(r => r.entry.id === selectedId) ? selectedId : (rows[0]?.entry.id ?? null);
	const selected = effectiveId === null ? undefined : hub.agents.get(effectiveId);

	const toolHost = useMemo<ToolRenderHost>(
		() => ({
			hasAgent: id => hub.agents.has(id),
			openAgent: id => {
				setSelectedId(id);
				setDetailOpen(true);
				setTab("transcript");
			},
		}),
		[hub.agents],
	);

	const kill = (id: string): void => {
		if (!sink) return;
		killAgent(sink, id).catch(err => notify("error", errMsg(err)));
	};
	const revive = (id: string): void => {
		if (!sink) return;
		reviveAgent(sink, id).catch(err => notify("error", errMsg(err)));
	};

	const canKill = selected !== undefined && selected.kind === "sub" && selected.status !== "aborted";
	const canRevive = selected !== undefined && selected.kind === "sub" && selected.status === "parked";

	// The handler reads the latest state through a ref so the listener is bound once.
	const latest = useRef({ rows, effectiveId, selected, canKill, canRevive, confirmKill, filter });
	latest.current = { rows, effectiveId, selected, canKill, canRevive, confirmKill, filter };
	// Live agents open in the main view; advisors and aborted agents only have the read-only in-hub transcript.
	const openEntry = (id: string): void => {
		if (isFocusable(hub.agents.get(id))) {
			onFocusAgent(id);
			return;
		}
		setSelectedId(id);
		setDetailOpen(true);
		setTab("transcript");
	};
	const openEntryRef = useRef(openEntry);
	openEntryRef.current = openEntry;
	useEffect(() => {
		const handle = (e: unknown): void => {
			const ev = e as KeyboardEvent;
			if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
			const s = latest.current;
			if (ev.key === "Escape") {
				if (isTypingTarget(ev.target) && s.filter === "") {
					(ev.target as { blur?: () => void }).blur?.();
					return;
				}
				ev.preventDefault();
				if (s.confirmKill !== null) setConfirmKill(null);
				else if (s.filter !== "") {
					setFilter("");
					filterRef.current?.blur();
				} else onClose();
				return;
			}
			if (isTypingTarget(ev.target)) return;
			const move = (delta: number): void => {
				if (s.rows.length === 0) return;
				const at = s.rows.findIndex(r => r.entry.id === s.effectiveId);
				const next = Math.max(0, Math.min(s.rows.length - 1, (at < 0 ? 0 : at) + delta));
				setSelectedId(s.rows[next].entry.id);
			};
			if (s.confirmKill !== null) {
				if (ev.key === "Enter" || ev.key === "y") {
					ev.preventDefault();
					kill(s.confirmKill);
					setConfirmKill(null);
				} else if (ev.key === "n") setConfirmKill(null);
				return;
			}
			switch (ev.key) {
				case "j":
				case "ArrowDown":
					ev.preventDefault();
					move(1);
					break;
				case "k":
				case "ArrowUp":
					ev.preventDefault();
					move(-1);
					break;
				case "Enter":
					if (s.selected) {
						ev.preventDefault();
						openEntryRef.current(s.selected.id);
					}
					break;
				case "t":
					setTree(v => !v);
					break;
				case "/":
					ev.preventDefault();
					filterRef.current?.focus();
					break;
				case "r":
					if (s.canRevive && s.effectiveId) revive(s.effectiveId);
					break;
				case "x":
					if (s.canKill && s.effectiveId) setConfirmKill(s.effectiveId);
					break;
			}
		};
		browserWindow.addEventListener("keydown", handle);
		return () => browserWindow.removeEventListener("keydown", handle);
		// kill/revive close over sink only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [onClose, sink]);

	const statusCounts = (["running", "idle", "parked", "aborted"] as const).filter(k => totals.counts[k] > 0);

	return (
		<div className="ah-screen" data-detail-open={detailOpen ? "true" : undefined}>
			<header className="ah-header">
				<h2>Agent Hub</h2>
				<div className="ah-totals">
					<span>{fmtCost(totals.cost)}</span>
					<span>{totals.requests} req</span>
					<span>{totals.tools} tools</span>
					<span>{fmtTokens(totals.tokens)} tok</span>
					{statusCounts.map(k => (
						<span key={k} className="ah-count">
							<span className={`ah-dot ah-dot--${k}`} />
							{totals.counts[k]} {k}
						</span>
					))}
				</div>
				<button
					type="button"
					className="ah-icon-btn"
					onClick={onClose}
					aria-label="Close agent hub"
					title="Close (Esc)"
				>
					<X size={18} />
				</button>
			</header>
			<div className="ah-body">
				<aside className="ah-left">
					<div className="ah-toolbar">
						<input
							ref={filterRef}
							className="ah-input"
							value={filter}
							placeholder="Filter (/)"
							aria-label="Filter agents"
							onChange={e => setFilter(e.currentTarget.value)}
							onKeyDown={e => {
								if (e.key === "Enter" || e.key === "ArrowDown") filterRef.current?.blur();
							}}
						/>
						<button
							type="button"
							className="ah-btn"
							data-active={tree ? "true" : undefined}
							onClick={() => setTree(v => !v)}
							title="Toggle tree (t)"
						>
							{tree ? "Tree" : "List"}
						</button>
					</div>
					{!hub.loaded ? (
						<div className="ah-empty">Loading agents...</div>
					) : (
						<HubTree
							rows={rows}
							tree={tree}
							selectedId={effectiveId}
							onSelect={id => {
								setSelectedId(id);
								setDetailOpen(true);
							}}
							onOpen={openEntry}
						/>
					)}
				</aside>
				<main className="ah-right">
					{selected ? (
						<>
							<div className="ah-detail-head">
								<button type="button" className="ah-btn ah-back" onClick={() => setDetailOpen(false)}>
									Back
								</button>
								<span className={`ah-dot ah-dot--${selected.status}`} />
								<strong className="ah-title">{agentIdLabel(selected.id)}</strong>
								{selected.agent && selected.kind === "sub" ? (
									<span className="ah-chip">{selected.agent}</span>
								) : null}
								<span className="ah-spacer" />
								{canRevive && (
									<button
										type="button"
										className="ah-btn"
										onClick={() => revive(selected.id)}
										title="Revive (r)"
									>
										Revive
									</button>
								)}
								{canKill &&
									(confirmKill === selected.id ? (
										<span className="ah-confirm">
											Kill {agentIdLabel(selected.id)}?
											<button
												type="button"
												className="ah-btn ah-btn--danger"
												onClick={() => {
													kill(selected.id);
													setConfirmKill(null);
												}}
											>
												Confirm
											</button>
											<button type="button" className="ah-btn" onClick={() => setConfirmKill(null)}>
												Cancel
											</button>
										</span>
									) : (
										<button
											type="button"
											className="ah-btn ah-btn--danger"
											onClick={() => setConfirmKill(selected.id)}
											title="Kill (x)"
										>
											Kill
										</button>
									))}
							</div>
							<div className="ah-tabs" role="tablist">
								<button
									type="button"
									role="tab"
									aria-selected={tab === "details"}
									className="ah-tab"
									onClick={() => setTab("details")}
								>
									Details
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={tab === "transcript"}
									className="ah-tab"
									onClick={() => setTab("transcript")}
								>
									Transcript
								</button>
							</div>
							{tab === "details" ? (
								<HubDetail
									entry={selected}
									parent={parentOf(hub.agents, selected.id)}
									children={childrenOf(hub.agents, selected.id)}
									onSelect={id => setSelectedId(id)}
								/>
							) : (
								<HubTranscript
									key={selected.id}
									sink={sink}
									entry={selected}
									toolHost={toolHost}
									draftKey={draftKey(instanceId, `hub:${selected.id}`)}
								/>
							)}
						</>
					) : (
						<div className="ah-empty">Select an agent.</div>
					)}
				</main>
			</div>
			<footer className="ah-help">j/k move · Enter open · t tree · / filter · r revive · x kill · Esc close</footer>
		</div>
	);
}

export default AgentHubScreen;
