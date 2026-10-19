import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
	Bot,
	ChevronRight,
	Cpu,
	DollarSign,
	Eye,
	Gauge,
	Hand,
	Info,
	ListChecks,
	ListTodo,
	Pencil,
	RotateCcw,
	Shrink,
	Trash2,
	Volume2,
} from "lucide-react";
import type { SessionCommandSink, ThinkingLevel } from "../../lib/session-actions";
import { clearContext, compact, handoff, newSession } from "../../lib/session-actions";
import { notify } from "../../lib/notify";
import { browserWindow } from "../../lib/dom";
import { CONTEXT_CRIT_PERCENT, type ContextUsageLevel } from "../../lib/context-usage";

export type ControlCenterPanel = "todos" | "hub" | "subagents" | "usage" | "info" | "models";

export interface ControlCenterTodos {
	done: number;
	total: number;
	current: string | null;
}

export interface ControlCenterAgents {
	running: number;
	names: string[];
}

export interface ControlCenterCtx {
	percent: number | null;
	level: ContextUsageLevel;
	cost: string | null;
	window: string | null;
}

export interface ThinkingOption {
	level: ThinkingLevel;
	label: string;
}

export interface ControlCenterProps {
	open: boolean;
	onClose: () => void;
	/** The top bar rendered in its open state; sits at the top of the sheet. */
	header: ReactNode;
	title: string;
	todos: ControlCenterTodos | null;
	agents: ControlCenterAgents;
	ctx: ControlCenterCtx;
	model: string | null;
	thinking: ThinkingLevel | null;
	thinkingOptions: readonly ThinkingOption[];
	onSetThinking: (level: ThinkingLevel) => void;
	planMode: boolean;
	onTogglePlan: () => void;
	voice: boolean;
	onToggleVoice: () => void;
	expandAll: boolean;
	onToggleExpandAll: () => void;
	/** Streaming or compacting: context-resetting actions wait for idle. */
	busy: boolean;
	sink: SessionCommandSink | null;
	onRename?: (newName: string) => Promise<boolean | void>;
	onOpenPanel: (panel: ControlCenterPanel) => void;
	/** Agents tile target: "hub" when the inspector column is visible, else "subagents". */
	agentsPanel: "hub" | "subagents";
}

type ContextActionKind = "compact" | "handoff" | "clear" | "new_session";

interface ConfirmSpec {
	title: string;
	description: string;
	confirmLabel: string;
	destructive: boolean;
}

const CONFIRM: Record<ContextActionKind, ConfirmSpec> = {
	compact: {
		title: "Compact context",
		description: "Summarize and compact current conversation history? This effect is shared with the TUI.",
		confirmLabel: "Compact",
		destructive: false,
	},
	handoff: {
		title: "Handoff session",
		description: "Produce a handoff summary for this session? This effect is shared with the TUI.",
		confirmLabel: "Handoff",
		destructive: false,
	},
	clear: {
		title: "Clear context",
		description: "Reset session context and drop all conversation history? This effect is shared with the TUI.",
		confirmLabel: "Clear context",
		destructive: true,
	},
	new_session: {
		title: "New session",
		description: "Start a new session? This effect is shared with the TUI.",
		confirmLabel: "New session",
		destructive: false,
	},
};

async function runAction(sink: SessionCommandSink, action: ContextActionKind): Promise<void> {
	switch (action) {
		case "compact":
			await compact(sink);
			notify("info", "Compaction started");
			return;
		case "handoff":
			await handoff(sink);
			notify("info", "Handoff completed");
			return;
		case "clear":
			await clearContext(sink);
			notify("info", "Context cleared");
			return;
		case "new_session":
			await newSession(sink);
			notify("info", "New session started");
			return;
	}
}

export function ControlCenter(props: ControlCenterProps): ReactNode {
	const { open, onClose, busy, sink, onOpenPanel } = props;
	const [confirm, setConfirm] = useState<ContextActionKind | null>(null);
	const [pending, setPending] = useState(false);
	const [renaming, setRenaming] = useState(false);
	const [editName, setEditName] = useState(props.title);

	useEffect(() => {
		if (!open && confirm === null && !renaming) return;
		const onKey = (e: unknown): void => {
			if (e === null || typeof e !== "object" || !("key" in e) || e.key !== "Escape") return;
			if (confirm !== null) {
				if (!pending) setConfirm(null);
			} else if (renaming) {
				setRenaming(false);
			} else {
				onClose();
			}
		};
		browserWindow.addEventListener("keydown", onKey);
		return () => browserWindow.removeEventListener("keydown", onKey);
	}, [open, confirm, renaming, pending, onClose]);

	const execute = useCallback(async () => {
		if (confirm === null || !sink) {
			setConfirm(null);
			return;
		}
		setPending(true);
		try {
			await runAction(sink, confirm);
		} catch (err: unknown) {
			notify("error", err instanceof Error ? err.message : String(err));
		} finally {
			setPending(false);
			setConfirm(null);
		}
	}, [confirm, sink]);

	const ask = (action: ContextActionKind): void => {
		if (busy || !sink) return;
		onClose();
		setConfirm(action);
	};
	const go = (panel: ControlCenterPanel): void => {
		onClose();
		onOpenPanel(panel);
	};

	const confirmSpec = confirm === null ? null : CONFIRM[confirm];
	const lock = busy || !sink;
	const { todos, agents, ctx } = props;
	const crit = ctx.percent !== null && ctx.percent >= CONTEXT_CRIT_PERCENT;
	const ctxMeta = [ctx.cost, ctx.window && `${ctx.window} window`].filter(Boolean).join(" · ");

	return (
		<>
			{open && (
				<>
					<div className="cc-scrim" onClick={onClose} />
					<div className="cc" role="dialog" aria-modal="true" aria-label="Control center">
						{props.header}
						<div className="cc-body">
							<div className="cc-lbl">This session</div>
							<div className="cc-grid">
								<button type="button" className="cc-tile" onClick={() => go("todos")}>
									<span className="cc-h">
										<ListTodo size={15} />
										Todos
										<ChevronRight size={15} className="cc-go" />
									</span>
									<span className="cc-big">
										{todos ? todos.done : 0}
										<small> of {todos ? todos.total : 0}</small>
									</span>
									<span className="cc-sub">{todos?.current ? `Now: ${todos.current}` : "No active todo"}</span>
								</button>
								<button type="button" className="cc-tile" onClick={() => go(props.agentsPanel)}>
									<span className="cc-h">
										<Bot size={15} />
										Agents
										<ChevronRight size={15} className="cc-go" />
									</span>
									<span className="cc-big">
										{agents.running}
										<small> running</small>
									</span>
									<span className="cc-sub">
										{agents.names.length === 0
											? "None"
											: agents.names.length === 1
												? agents.names[0]
												: `${agents.names[0]}, ${agents.names.length - 1} more`}
									</span>
								</button>
								<div className="cc-tile cc-tile--wide" data-level={ctx.level}>
									<span className="cc-h">
										<Gauge size={15} />
										Context
										{ctxMeta && <span className="cc-go cc-meta">{ctxMeta}</span>}
									</span>
									<span className="cc-big">{ctx.percent === null ? "–" : `${Math.round(ctx.percent)}%`}</span>
									<div className="cc-meter" data-level={ctx.level}>
										<i style={{ width: `${Math.min(100, Math.max(0, ctx.percent ?? 0))}%` }} />
									</div>
									<div className="cc-tbtns">
										<button
											type="button"
											className={crit ? "cc-solid" : undefined}
											disabled={lock}
											onClick={() => ask("compact")}
										>
											<Shrink size={16} />
											Compact
										</button>
										<button type="button" disabled={lock} onClick={() => ask("handoff")}>
											<Hand size={16} />
											Handoff
										</button>
									</div>
									{busy && <span className="cc-sub">Available when this turn ends.</span>}
								</div>
								<div className="cc-tile cc-tile--wide">
									<button type="button" className="cc-h cc-h-btn" onClick={() => go("models")}>
										<Cpu size={15} />
										Model
										<b className="cc-model">{props.model ?? "—"}</b>
										<ChevronRight size={15} className="cc-go" />
									</button>
									<div className="cc-seg" role="group" aria-label="Thinking level">
										{props.thinkingOptions.map(opt => (
											<button
												key={opt.level}
												type="button"
												className={props.thinking === opt.level ? "cc-on" : undefined}
												aria-pressed={props.thinking === opt.level}
												onClick={() => props.onSetThinking(opt.level)}
											>
												{opt.label}
											</button>
										))}
									</div>
								</div>
							</div>
							<div className="cc-row3">
								<button
									type="button"
									className={`cc-tile cc-tgl${props.planMode ? " cc-on" : ""}`}
									aria-pressed={props.planMode}
									onClick={props.onTogglePlan}
								>
									<span className="cc-h">
										<ListChecks size={15} />
									</span>
									<span className="cc-nm">Plan mode</span>
									<span className="cc-sub">{props.planMode ? "On" : "Off"}</span>
								</button>
								<button
									type="button"
									className={`cc-tile cc-tgl${props.voice ? " cc-on" : ""}`}
									aria-pressed={props.voice}
									onClick={props.onToggleVoice}
								>
									<span className="cc-h">
										<Volume2 size={15} />
									</span>
									<span className="cc-nm">Voice</span>
									<span className="cc-sub">{props.voice ? "On" : "Off"}</span>
								</button>
								<button
									type="button"
									className={`cc-tile cc-tgl${props.expandAll ? " cc-on" : ""}`}
									aria-pressed={props.expandAll}
									onClick={props.onToggleExpandAll}
								>
									<span className="cc-h">
										<Eye size={15} />
									</span>
									<span className="cc-nm">Tools</span>
									<span className="cc-sub">{props.expandAll ? "Expanded" : "Collapsed"}</span>
								</button>
							</div>
							<div className="cc-rnd">
								{props.onRename && (
									<button
										type="button"
										onClick={() => {
											onClose();
											setEditName(props.title);
											setRenaming(true);
										}}
									>
										<span className="cc-c">
											<Pencil size={18} />
										</span>
										Rename
									</button>
								)}
								<button type="button" onClick={() => go("usage")}>
									<span className="cc-c">
										<DollarSign size={18} />
									</span>
									Usage
								</button>
								<button type="button" onClick={() => go("info")}>
									<span className="cc-c">
										<Info size={18} />
									</span>
									Details
								</button>
								<button type="button" className="cc-red" disabled={lock} onClick={() => ask("clear")}>
									<span className="cc-c">
										<Trash2 size={18} />
									</span>
									Clear
								</button>
								<button type="button" className="cc-red" disabled={lock} onClick={() => ask("new_session")}>
									<span className="cc-c">
										<RotateCcw size={18} />
									</span>
									New session
								</button>
							</div>
							{busy && (
								<div className="cc-foot">Compact, Handoff, Clear and New session wait for the turn to end.</div>
							)}
						</div>
						<button type="button" className="cc-close" onClick={onClose} aria-label="Close control center">
							<i />
						</button>
					</div>
				</>
			)}

			{confirmSpec && (
				<>
					<div className="tb-popover-backdrop" onClick={() => !pending && setConfirm(null)} />
					<div className="tb-confirm-dialog" role="dialog" aria-modal="true" aria-label={confirmSpec.title}>
						<div className="tb-confirm-title">{confirmSpec.title}</div>
						<div className="tb-confirm-desc">{confirmSpec.description}</div>
						<div className="tb-confirm-actions">
							<button
								type="button"
								className="tb-confirm-btn tb-confirm-btn--cancel"
								disabled={pending}
								onClick={() => setConfirm(null)}
							>
								Cancel
							</button>
							<button
								type="button"
								className={`tb-confirm-btn ${confirmSpec.destructive ? "tb-confirm-btn--destructive" : "tb-confirm-btn--primary"}`}
								disabled={pending}
								onClick={execute}
							>
								{pending ? "Processing..." : confirmSpec.confirmLabel}
							</button>
						</div>
					</div>
				</>
			)}

			{renaming && (
				<>
					<div className="tb-popover-backdrop" onClick={() => setRenaming(false)} />
					<div className="tb-rename-dialog" role="dialog" aria-label="Rename session">
						<form
							onSubmit={async e => {
								e.preventDefault();
								const trimmed = editName.trim();
								if (trimmed && trimmed !== props.title) await props.onRename?.(trimmed);
								setRenaming(false);
							}}
						>
							<div className="tb-rename-title">Rename Session</div>
							<input
								type="text"
								className="tb-rename-input"
								value={editName}
								autoFocus
								onChange={e => setEditName(e.target.value)}
								placeholder="Session name"
							/>
							<div className="tb-rename-actions">
								<button
									type="button"
									className="tb-rename-btn tb-rename-btn--cancel"
									onClick={() => setRenaming(false)}
								>
									Cancel
								</button>
								<button type="submit" className="tb-rename-btn tb-rename-btn--save" disabled={!editName.trim()}>
									Save
								</button>
							</div>
						</form>
					</div>
				</>
			)}
		</>
	);
}
