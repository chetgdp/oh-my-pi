/**
 * Tool card chrome + per-tool dispatch. Works in the collab-web app and inside
 * the `<omp-tool-view>` web component embedded in HTML session exports.
 */
import { INTENT_FIELD } from "@oh-my-pi/pi-wire";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { formatJobDuration, useJobClock } from "./job-clock";
import { resolveToolRenderer } from "./registry";
import type { ToolJobHost, ToolJobView, ToolRenderHost, ToolRenderProps, ToolResultLike } from "./types";
import { isRecord, replaceTabs, stripAnsi } from "./util";
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
 * result (`details.async`) until this connection's running-jobs snapshot lands.
 */
function useToolJob(jobs: ToolJobHost | undefined, toolCallId: string | undefined, result: ToolResultLike | undefined) {
	const subscribe = jobs ? jobs.subscribe : noSubscribe;
	const getTracked = () => (jobs && toolCallId ? jobs.job(toolCallId) : undefined);
	const getSeeded = () => jobs?.seeded() ?? true;
	const tracked = useSyncExternalStore(subscribe, getTracked, getTracked);
	const seeded = useSyncExternalStore(subscribe, getSeeded, getSeeded);
	if (tracked || seeded || !toolCallId || !isRecord(result?.details)) return tracked;
	const parked = result.details.async;
	if (!isRecord(parked) || parked.state !== "running" || typeof parked.jobId !== "string") return undefined;
	return { toolCallId, jobId: parked.jobId, state: "running", startedAt: 0 } satisfies ToolJobView;
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
	if (!text) return null;
	const clean = stripAnsi(replaceTabs(text));
	return <pre className="tv-job-output">{clean.length > 16384 ? `…${clean.slice(-16384)}` : clean}</pre>;
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
	const base = props.defaultOpen ?? renderer.defaultOpen ?? false;
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
