/**
 * Background job tracking for tool calls the host parked as async jobs
 * (bash auto-background, `async: true`, eval, task).
 *
 * Status comes from v3 `job_update` frames and the `get_jobs` snapshot taken on
 * every attach/resync. Output is pulled only for jobs a card is showing
 * (`job_subscribe`), so collapsed cards cost nothing on the wire.
 */
import type { ToolJobHost, ToolJobState, ToolJobView } from "../components/transcript/tool-views/types";

export type JobType = "bash" | "eval" | "task";

export interface JobUpdateFrame {
	type: "job_update";
	toolCallId: string;
	jobId: string;
	jobType: JobType;
	state: ToolJobState;
	startedAt: number;
	endedAt?: number;
}

export interface JobOutputFrame {
	type: "job_output";
	jobId: string;
	text: string;
}

export interface JobInfo {
	toolCallId?: string;
	jobId: string;
	jobType: JobType;
	state: "running";
	startedAt: number;
}

/** Transport the store needs; the session store adapts the RPC client to it. */
export interface JobTransport {
	getJobs(): Promise<JobInfo[]>;
	subscribe(jobId: string): Promise<string>;
	unsubscribe(jobId: string): Promise<void>;
}

export interface JobStore extends ToolJobHost {
	/** True for frames this store consumes. */
	handleFrame(frame: { type: string }): boolean;
	/** New connection: drop host-side subscription state, refetch running jobs, resubscribe watched ones. */
	attach(): void;
	dispose(): void;
}

const JOB_STATES: Record<string, true> = { running: true, completed: true, failed: true, cancelled: true };

function isJobUpdate(frame: { type: string }): frame is JobUpdateFrame {
	const f = frame as Partial<JobUpdateFrame>;
	return (
		f.type === "job_update" &&
		typeof f.toolCallId === "string" &&
		typeof f.jobId === "string" &&
		typeof f.state === "string" &&
		f.state in JOB_STATES &&
		typeof f.startedAt === "number"
	);
}

function isJobOutput(frame: { type: string }): frame is JobOutputFrame {
	const f = frame as Partial<JobOutputFrame>;
	return f.type === "job_output" && typeof f.jobId === "string" && typeof f.text === "string";
}

export function isJobInfo(value: unknown): value is JobInfo {
	return (
		typeof value === "object" &&
		value !== null &&
		"jobId" in value &&
		typeof value.jobId === "string" &&
		"startedAt" in value &&
		typeof value.startedAt === "number" &&
		(!("toolCallId" in value) || value.toolCallId === undefined || typeof value.toolCallId === "string")
	);
}

/** `toLocal` re-bases a host epoch-ms stamp on this device's clock. */
export function createJobStore(transport: JobTransport, toLocal: (hostAt: number) => number = t => t): JobStore {
	const byCall = new Map<string, ToolJobView>();
	/** jobId -> toolCallId, for frames that carry only the job id. */
	const callOf = new Map<string, string>();
	/** Card watch refcounts; a job is subscribed on the host while its count is positive and it runs. */
	const watchers = new Map<string, number>();
	/** Jobs the host currently streams to this connection. */
	const subscribed = new Set<string>();
	/** Subscribed jobs whose tail has not arrived yet; the subscribe reply only fills these. */
	const awaitingTail = new Set<string>();
	const outputs = new Map<string, string>();
	const listeners = new Set<() => void>();
	let seeded = false;
	let generation = 0;
	let disposed = false;

	function notify(): void {
		for (const l of listeners) l();
	}

	function setJob(view: ToolJobView): void {
		byCall.set(view.toolCallId, {
			...view,
			startedAt: toLocal(view.startedAt),
			...(view.endedAt !== undefined ? { endedAt: toLocal(view.endedAt) } : {}),
		});
		callOf.set(view.jobId, view.toolCallId);
	}

	function subscribeOnHost(jobId: string): void {
		if (subscribed.has(jobId)) return;
		subscribed.add(jobId);
		awaitingTail.add(jobId);
		const gen = generation;
		transport.subscribe(jobId).then(
			text => {
				if (disposed || gen !== generation || !awaitingTail.delete(jobId)) return;
				outputs.set(jobId, text);
				notify();
			},
			() => {
				if (gen !== generation) return;
				subscribed.delete(jobId);
				awaitingTail.delete(jobId);
			},
		);
	}

	function unsubscribeOnHost(jobId: string): void {
		awaitingTail.delete(jobId);
		if (!subscribed.delete(jobId)) return;
		transport.unsubscribe(jobId).catch(() => {});
	}

	function isRunning(jobId: string): boolean {
		const call = callOf.get(jobId);
		const view = call === undefined ? undefined : byCall.get(call);
		// Unknown to the tracker yet (start result seen before job_update): the card says it runs.
		return view === undefined || view.state === "running";
	}

	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		job(toolCallId) {
			return byCall.get(toolCallId);
		},
		seeded() {
			return seeded;
		},
		output(jobId) {
			return outputs.get(jobId);
		},
		watch(jobId) {
			watchers.set(jobId, (watchers.get(jobId) ?? 0) + 1);
			if (!disposed && isRunning(jobId)) subscribeOnHost(jobId);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				const n = (watchers.get(jobId) ?? 1) - 1;
				if (n > 0) {
					watchers.set(jobId, n);
					return;
				}
				watchers.delete(jobId);
				outputs.delete(jobId);
				if (!disposed) unsubscribeOnHost(jobId);
			};
		},
		handleFrame(frame) {
			if (isJobUpdate(frame)) {
				setJob({
					toolCallId: frame.toolCallId,
					jobId: frame.jobId,
					state: frame.state,
					startedAt: frame.startedAt,
					...(frame.endedAt !== undefined ? { endedAt: frame.endedAt } : {}),
				});
				if (frame.state === "running") {
					if (watchers.has(frame.jobId)) subscribeOnHost(frame.jobId);
				} else {
					// The host drops the subscription itself when a job settles; the final tail stays on screen.
					subscribed.delete(frame.jobId);
					awaitingTail.delete(frame.jobId);
				}
				notify();
				return true;
			}
			if (isJobOutput(frame)) {
				if (subscribed.has(frame.jobId)) {
					awaitingTail.delete(frame.jobId);
					outputs.set(frame.jobId, frame.text);
					notify();
				}
				return true;
			}
			return frame.type === "job_update" || frame.type === "job_output";
		},
		attach() {
			generation++;
			// The host forgot this connection's subscriptions; shown tails stay until the resubscribe reply replaces them.
			subscribed.clear();
			awaitingTail.clear();
			seeded = false;
			const gen = generation;
			transport.getJobs().then(
				jobs => {
					if (disposed || gen !== generation) return;
					const running = new Set<string>();
					for (const j of jobs) {
						running.add(j.jobId);
						if (j.toolCallId === undefined) continue;
						setJob({ toolCallId: j.toolCallId, jobId: j.jobId, state: "running", startedAt: j.startedAt });
					}
					// Jobs that settled while disconnected lost their frame; the outcome is unknown, so stop the spinner.
					for (const [call, view] of byCall) {
						if (view.state === "running" && !running.has(view.jobId)) {
							byCall.set(call, { ...view, state: "completed" });
						}
					}
					seeded = true;
					for (const jobId of watchers.keys()) {
						if (running.has(jobId)) subscribeOnHost(jobId);
					}
					notify();
				},
				() => {
					// Hosts without job support: nothing is known to run, so parked start results stop spinning.
					if (disposed || gen !== generation) return;
					seeded = true;
					notify();
				},
			);
			notify();
		},
		dispose() {
			disposed = true;
			listeners.clear();
		},
	};
}
