import { type ReactNode, useEffect, useState } from "react";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import { agentIdLabel, entryMetrics } from "../../lib/agent-hub-model";
import { fmtCost, fmtDuration, fmtTokens, relTime } from "../../lib/format";
import { type BrowserDocument, browserWindow } from "../../lib/dom";

const ELAPSED_TICK_MS = 1000;
const REL_TIME_TICK_MS = 30_000;

/**
 * Wall clock that re-renders only its caller every `intervalMs`. Paused while
 * the document is hidden; refreshes immediately when it becomes visible.
 */
export function useNow(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		// Resolved per mount, not at import: the module may load before a document exists.
		const doc: BrowserDocument | undefined = browserWindow.document;
		let timer: Timer | null = null;
		const sync = (): void => {
			const visible = doc === undefined || doc.visibilityState === "visible";
			if (visible && timer === null) {
				setNow(Date.now());
				timer = setInterval(() => setNow(Date.now()), intervalMs);
			} else if (!visible && timer !== null) {
				clearInterval(timer);
				timer = null;
			}
		};
		sync();
		doc?.addEventListener("visibilitychange", sync);
		return () => {
			doc?.removeEventListener("visibilitychange", sync);
			clearInterval(timer ?? undefined);
		};
	}, [intervalMs]);
	return now;
}

/** Running-tool elapsed time; the only 1s tick in the hub. */
export function Elapsed(props: { sinceMs: number }): ReactNode {
	const now = useNow(ELAPSED_TICK_MS);
	return fmtDuration(Math.max(0, now - props.sinceMs));
}

function RelTime(props: { tsMs: number }): ReactNode {
	useNow(REL_TIME_TICK_MS);
	return relTime(props.tsMs);
}

function Field(props: { label: string; children: ReactNode }): ReactNode {
	return (
		<div className="ah-field">
			<span className="ah-field-label">{props.label}</span>
			<span className="ah-field-value">{props.children}</span>
		</div>
	);
}

function AgentLinkButton(props: { entry: AgentRosterEntry; onSelect(id: string): void }): ReactNode {
	return (
		<button type="button" className="ah-link" onClick={() => props.onSelect(props.entry.id)}>
			<span className={`ah-dot ah-dot--${props.entry.status}`} />
			{agentIdLabel(props.entry.id)}
		</button>
	);
}

export function HubDetail(props: {
	entry: AgentRosterEntry;
	parent: AgentRosterEntry | undefined;
	children: readonly AgentRosterEntry[];
	onSelect(id: string): void;
}): ReactNode {
	const { entry, parent, children, onSelect } = props;
	const p = entry.progress;
	const m = entryMetrics(entry);
	const ctxPct =
		m?.contextTokens !== undefined && m.contextWindow
			? Math.min(100, (m.contextTokens / m.contextWindow) * 100)
			: null;
	const running = entry.status === "running";
	const toolMs = p?.currentToolStartMs;
	const model = entry.resolvedModel ?? p?.resolvedModel;

	return (
		<div className="ah-detail">
			<section className="ah-section">
				<h3>Status</h3>
				<Field label="State">
					<span className={`ah-badge ah-badge--${entry.status}`}>{entry.status}</span>
					{entry.detached && <span className="ah-badge">detached</span>}
				</Field>
				{entry.agent && <Field label="Agent">{entry.agent}</Field>}
				{model && (
					<Field label="Model">
						{model}
						{p?.resolvedThinkingLevel ? ` (${p.resolvedThinkingLevel})` : ""}
						{p?.resolvedModelIsFallback ? " fallback" : ""}
					</Field>
				)}
				{(entry.modelRole ?? p?.modelRole) && <Field label="Role">{entry.modelRole ?? p?.modelRole}</Field>}
				<Field label="Created">
					<RelTime tsMs={entry.createdAt} />
				</Field>
				<Field label="Active">
					<RelTime tsMs={entry.lastActivity} />
				</Field>
				{entry.description && <Field label="About">{entry.description}</Field>}
				{entry.task && <Field label="Task">{entry.task}</Field>}
			</section>

			{(running || p?.retryState || p?.retryFailure || entry.activity) && (
				<section className="ah-section">
					<h3>Now</h3>
					{running && p?.currentTool && (
						<Field label="Tool">
							<code>{p.currentTool}</code>
							{p.currentToolArgs ? <span className="ah-dim"> {p.currentToolArgs}</span> : null}
							{toolMs !== undefined ? (
								<span className="ah-dim">
									{" "}
									<Elapsed sinceMs={toolMs} />
								</span>
							) : null}
						</Field>
					)}
					{(p?.lastIntent ?? entry.activity) && <Field label="Intent">{p?.lastIntent ?? entry.activity}</Field>}
					{p?.retryState && (
						<Field label="Retry">
							<span className="ah-badge ah-badge--warn">
								{p.retryState.attempt}/{p.retryState.maxAttempts}
							</span>{" "}
							{p.retryState.errorMessage}
						</Field>
					)}
					{p?.retryFailure && (
						<Field label="Failed">
							<span className="ah-badge ah-badge--aborted">after {p.retryFailure.attempt}</span>{" "}
							{p.retryFailure.errorMessage}
						</Field>
					)}
				</section>
			)}

			{m && (
				<section className="ah-section">
					<h3>Usage</h3>
					<Field label="Tokens">{fmtTokens(m.tokens)}</Field>
					<Field label="Requests">{m.requests}</Field>
					<Field label="Tools">{m.tools}</Field>
					<Field label="Cost">{fmtCost(m.cost)}</Field>
					<Field label="Duration">{fmtDuration(m.durationMs)}</Field>
					{ctxPct !== null && (
						<Field label="Context">
							<span
								className="ah-gauge"
								role="meter"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={Math.round(ctxPct)}
							>
								<span
									className={`ah-gauge-fill${ctxPct >= 90 ? " ah-gauge-fill--danger" : ctxPct >= 70 ? " ah-gauge-fill--warn" : ""}`}
									style={{ width: `${ctxPct}%` }}
								/>
							</span>{" "}
							{Math.round(ctxPct)}% ({fmtTokens(m.contextTokens ?? 0)}/{fmtTokens(m.contextWindow ?? 0)})
						</Field>
					)}
				</section>
			)}

			<section className="ah-section">
				<h3>Lineage</h3>
				<Field label="Parent">
					{parent ? <AgentLinkButton entry={parent} onSelect={onSelect} /> : <span className="ah-dim">none</span>}
				</Field>
				<Field label="Children">
					{children.length === 0 ? (
						<span className="ah-dim">none</span>
					) : (
						<span className="ah-links">
							{children.map(c => (
								<AgentLinkButton key={c.id} entry={c} onSelect={onSelect} />
							))}
						</span>
					)}
				</Field>
			</section>

			{(entry.outputPath || entry.patchPath || entry.branchName) && (
				<section className="ah-section">
					<h3>Changes</h3>
					{entry.branchName && <Field label="Branch">{entry.branchName}</Field>}
					{entry.patchPath && (
						<Field label="Patch">
							<code>{entry.patchPath}</code>
						</Field>
					)}
					{entry.outputPath && (
						<Field label="Output">
							<code>{entry.outputPath}</code>
						</Field>
					)}
				</section>
			)}

			{p && (p.recentTools.length > 0 || p.recentOutput.length > 0) && (
				<section className="ah-section">
					<h3>Recent</h3>
					{p.recentTools.slice(0, 8).map((t, i) => (
						<div key={`${t.endMs}:${i}`} className="ah-recent">
							<code>{t.tool}</code> <span className="ah-dim">{t.args}</span>
						</div>
					))}
					{p.recentOutput.length > 0 && <pre className="ah-output">{p.recentOutput.slice(-8).join("\n")}</pre>}
				</section>
			)}
		</div>
	);
}
