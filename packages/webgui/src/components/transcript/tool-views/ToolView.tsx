/**
 * Tool card chrome + per-tool dispatch. Works in the collab-web app and inside
 * the `<omp-tool-view>` web component embedded in HTML session exports.
 */
import { INTENT_FIELD } from "@oh-my-pi/pi-wire";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { followTail, isAtBottom } from "./follow-tail";
import { formatJobDuration, useJobClock } from "./job-clock";
import { resolveToolRenderer } from "./registry";
import type { ToolJobHost, ToolJobView, ToolRenderHost, ToolRenderProps, ToolResultLike } from "./types";
import { isRecord, replaceTabs, stripAnsi } from "./util";
import { voiceCallText } from "./voice";
import "./tool-render.css";

export interface ToolViewProps {
	name: string;
	/** Wire tool-call id; keys background job tracking. */
	toolCallId?: string;
	args?: unknown;
	result?: ToolResultLike;
	/** Tool is still executing (live collab view). */
	running?: boolean;
	/** Model-provided intent (`i`), shown atop the body. */
	intent?: string;
	/** Streaming partial output tail while running. */
	partial?: string;
	/** Latest streamed `details` snapshot while running; rendered as a provisional result. */
	liveDetails?: unknown;
	defaultOpen?: boolean;
	/** Host capabilities (sub-session drill-down, …). */
	host?: ToolRenderHost;
	/** Total calls in a coalesced consecutive run. */
	groupCount?: number;
}

function normalizeArgs(raw: unknown): { args: Record<string, unknown>; intent: string | undefined } {
	if (!isRecord(raw)) return { args: {}, intent: undefined };
	const intent = typeof raw[INTENT_FIELD] === "string" ? (raw[INTENT_FIELD] as string).trim() : undefined;
	if (!(INTENT_FIELD in raw)) return { args: raw, intent };
	const args: Record<string, unknown> = {};
	for (const k in raw) {
		if (k !== INTENT_FIELD) args[k] = raw[k];
	}
	return { args, intent };
}

interface XdevDispatch {
	tool: string;
	args: Record<string, unknown>;
	inner: unknown;
}

function executeXdevDispatch(props: ToolViewProps): XdevDispatch | null {
	if (props.name !== "write" || props.result?.isError === true || !isRecord(props.result?.details)) return null;
	const xdev = props.result.details.xdev;
	if (!isRecord(xdev) || xdev.mode !== "execute" || typeof xdev.tool !== "string") return null;
	return { tool: xdev.tool, args: isRecord(xdev.args) ? xdev.args : {}, inner: xdev.inner };
}

const noSubscribe = (): (() => void) => () => {};

/**
 * The call's background job: the host's report when it has one, else the parked start
 * result (`details.async`) until this connection's jobs snapshot lands.
 */
function useToolJob(jobs: ToolJobHost | undefined, toolCallId: string | undefined, result: ToolResultLike | undefined) {
	const parked = isRecord(result?.details) ? result.details.async : undefined;
	const parkedJobId = isRecord(parked) && typeof parked.jobId === "string" ? parked.jobId : undefined;
	const subscribe = jobs ? jobs.subscribe : noSubscribe;
	const getTracked = () => (jobs && toolCallId ? jobs.job(toolCallId, parkedJobId) : undefined);
	const getSeeded = () => jobs?.seeded() ?? true;
	const tracked = useSyncExternalStore(subscribe, getTracked, getTracked);
	const seeded = useSyncExternalStore(subscribe, getSeeded, getSeeded);
	if (tracked || seeded || !toolCallId || !isRecord(parked)) return tracked;
	if (parked.state !== "running" || parkedJobId === undefined) return undefined;
	return { toolCallId, jobId: parkedJobId, state: "running", startedAt: 0 } satisfies ToolJobView;
}

function JobLabel({ job }: { job: ToolJobView }): ReactNode {
	if (job.state !== "running") {
		const took =
			job.endedAt !== undefined && job.startedAt > 0 ? ` · ${formatJobDuration(job.endedAt - job.startedAt)}` : "";
		return <span className="tv-job">{`${job.state} · ${job.jobId}${took}`}</span>;
	}
	return job.startedAt > 0 ? (
		<RunningJobLabel jobId={job.jobId} startedAt={job.startedAt} />
	) : (
		<span className="tv-job tv-job--run">{`running · ${job.jobId}`}</span>
	);
}

function RunningJobLabel({ jobId, startedAt }: { jobId: string; startedAt: number }): ReactNode {
	const now = useJobClock();
	return <span className="tv-job tv-job--run">{`running · ${jobId} · ${formatJobDuration(now - startedAt)}`}</span>;
}

/** Mounted only while the card is open, so collapsed cards never stream. */
function JobOutput({ jobs, jobId }: { jobs: ToolJobHost; jobId: string }): ReactNode {
	useEffect(() => jobs.watch(jobId), [jobs, jobId]);
	const getText = () => jobs.output(jobId);
	const text = useSyncExternalStore(jobs.subscribe, getText, getText);
	const pane = useRef<HTMLPreElement>(null);
	// A ref, not state: scrolling must not re-render, and the layout effect reads it synchronously.
	const following = useRef(true);
	useLayoutEffect(() => {
		if (pane.current) followTail(pane.current, following.current);
	}, [text]);
	if (!text) return null;
	const clean = stripAnsi(replaceTabs(text));
	return (
		<pre
			ref={pane}
			className="tv-job-output"
			onScroll={e => {
				following.current = isAtBottom(e.currentTarget);
			}}
		>
			{clean.length > 16384 ? `…${clean.slice(-16384)}` : clean}
		</pre>
	);
}

function stopErrorText(err: unknown): string {
	return err instanceof Error && err.message.includes("unknown_job") ? "job already ended" : "stop failed";
}

/** Sits beside the header button, not inside it, so a tap never toggles the card. */
function JobStop({ jobs, jobId }: { jobs: ToolJobHost; jobId: string }): ReactNode {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cancel = jobs.cancel;
	if (!cancel) return null;
	return (
		<>
			{error && (
				<span className="tv-job-stop-err" role="alert">
					{error}
				</span>
			)}
			<button
				type="button"
				className="tv-job-stop"
				disabled={pending}
				aria-label={`Stop ${jobId}`}
				title={`Stop ${jobId}`}
				onClick={() => {
					setPending(true);
					setError(null);
					cancel.call(jobs, jobId).then(
						// Stays disabled: the cancelled job_update unmounts the button.
						() => {},
						err => {
							setPending(false);
							setError(stopErrorText(err));
						},
					);
				}}
			>
				{pending ? "stopping…" : "stop"}
			</button>
		</>
	);
}

export function ToolView(props: ToolViewProps): ReactNode {
	const xdev = executeXdevDispatch(props);
	const { args, intent: argIntent } = normalizeArgs(props.args);
	const intent = props.intent?.trim() || argIntent;
	const name = xdev?.tool ?? props.name;
	const live = props.running && !props.result && props.liveDetails !== undefined;
	const result = xdev
		? { content: props.result!.content, details: xdev.inner, isError: props.result!.isError }
		: live
			? { content: [], details: props.liveDetails }
			: props.result;
	const renderer = resolveToolRenderer(name);

	// The global expand toggle wins whenever it changes; a per-card tap
	// overrides it until the next global change. Default open falls back to
	// the renderer's defaultOpen policy (e.g. todo tree).
	const [override, setOverride] = useState<{ base: boolean; open: boolean } | null>(null);
	// Spoken text is meant to be read at a glance, so voice `say` cards open
	// regardless of the global toggle; a tap still collapses them.
	const voiceSay = voiceCallText(name, xdev?.args ?? args)?.command === "say";
	const base = voiceSay || (props.defaultOpen ?? renderer.defaultOpen ?? false);
	const open = override !== null && override.base === base ? override.open : base;
	const setOpen = (fn: (v: boolean) => boolean) => setOverride({ base, open: fn(open) });

	const jobs = props.host?.jobs;
	const job = useToolJob(jobs, props.toolCallId, props.result);
	const renderProps: ToolRenderProps = {
		name,
		args: xdev?.args ?? args,
		result,
		running: props.running,
		host: props.host,
		groupCount: props.groupCount,
		...(job ? { job } : {}),
	};
	const jobFailed = job !== undefined && (job.state === "failed" || job.state === "cancelled");
	const isError = props.result?.isError === true || jobFailed;
	const status = props.running || job?.state === "running" ? "run" : isError ? "err" : props.result ? "ok" : "pending";
	const partial = props.running && !props.result && props.partial ? stripAnsi(replaceTabs(props.partial)) : "";

	return (
		<div className={`tv-card${isError ? " tv-card--error" : ""}`}>
			<div className="tv-head-row">
				<button
					type="button"
					className="tv-head"
					aria-expanded={open}
					onClick={() => setOpen(v => !v)}
					title={intent || undefined}
				>
					{status === "run" ? (
						<span className="tv-spin" aria-label="running" />
					) : (
						<span className={`tv-status tv-status--${status}`} aria-hidden="true" />
					)}
					<span className="tv-name">{xdev ? `xd://${name}` : name}</span>
					<span className="tv-sum">
						<renderer.Summary {...renderProps} />
					</span>
					{job && <JobLabel job={job} />}
					<span className="tv-chev" aria-hidden="true" />
				</button>
				{job?.state === "running" && jobs && <JobStop key={job.jobId} jobs={jobs} jobId={job.jobId} />}
			</div>
			{open && (
				<div className="tv-body">
					{intent && <div className="tv-intent">{intent}</div>}
					{renderer.Body ? <renderer.Body {...renderProps} /> : null}
					{job && jobs && <JobOutput jobs={jobs} jobId={job.jobId} />}
				</div>
			)}
			{partial && <pre className="tv-partial">{partial.length > 2048 ? `…${partial.slice(-2048)}` : partial}</pre>}
		</div>
	);
}
