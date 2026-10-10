/**
 * RPC Plan Mode Coordinator: coordinates plan mode state, proposal review
 * lifecycle, and frame broadcasts across one or more RPC connections and
 * optional InteractiveMode TUI hosting.
 */
import type { AgentToolResult } from "@oh-my-pi/pi-agent-core";
import { CompactionCancelledError } from "@oh-my-pi/pi-agent-core/compaction";
import type { Model } from "@oh-my-pi/pi-ai";
import { modelsAreEqual } from "@oh-my-pi/pi-catalog/models";
import type { ConfiguredThinkingLevel } from "@oh-my-pi/pi-tui/thinking";
import { logger, prompt, Snowflake } from "@oh-my-pi/pi-utils";
import {
	humanizePlanTitle,
	normalizePlanTitle,
	type PlanApprovalDetails,
	resolveApprovedPlan,
} from "../../plan-mode/approved-plan";
import { resolvePlanModelTransition } from "../../plan-mode/model-transition";
import { autosaveApprovedPlan } from "../../plan-mode/plan-autosave";
import { listPlanFiles, readPlanFile } from "../../plan-mode/plan-files";
import { cfgPlanEnabled } from "../../plan-mode/settings";
import { Settings } from "../../config/settings";
import planModeApprovedResultPrompt from "../../prompts/system/plan-mode-approved-result.md" with { type: "text" };
import planModeRefineResultPrompt from "../../prompts/system/plan-mode-refine-result.md" with { type: "text" };
import planModeCompactInstructionsPrompt from "../../prompts/system/plan-mode-compact-instructions.md" with { type: "text" };
import type { AgentSession } from "../../session/agent-session";
import type { RpcOutput } from "./rpc-response";
import type {
	RpcPlanReview,
	RpcPlanReviewAction,
	RpcPlanReviewFrame,
	RpcPlanState,
	RpcPlanStateFrame,
} from "./rpc-types";

export interface RpcPlanTuiDelegate {
	isPlanModeEnabled(): boolean;
	isPlanModePaused(): boolean;
	getPlanFilePath(): string | undefined;
	enterPlanMode(options?: {
		planFilePath?: string;
		workflow?: "parallel" | "iterative";
		preserveRestoredModel?: boolean;
	}): Promise<void>;
	exitPlanMode(options?: {
		silent?: boolean;
		paused?: boolean;
		deferModelRestore?: boolean;
		interruptActiveTurn?: boolean;
	}): Promise<void>;
	dismissPlanReview(): void;
	answerPlanReview(action: RpcPlanReviewAction, feedback?: string): boolean;
}

interface PendingPlanReview {
	reviewId: string;
	title: string;
	planFilePath: string;
	markdown: string;
	origin: "headless" | "tui";
	resolve?: (result: AgentToolResult<PlanApprovalDetails>) => void;
	reject?: (error: unknown) => void;
}

export class RpcPlanCoordinator {
	readonly #session: AgentSession;
	#tuiDelegate: RpcPlanTuiDelegate | undefined;
	#pendingReview: PendingPlanReview | null = null;
	#previousModelState: { model: Model; thinkingLevel?: ConfiguredThinkingLevel } | undefined;
	readonly #subscribers: Set<RpcOutput> = new Set();
	#unsubscribeSettings: (() => void) | undefined;
	#lastBroadcastState: RpcPlanState | undefined;

	constructor(session: AgentSession) {
		this.#session = session;
		if (session.settings instanceof Settings) {
			this.#unsubscribeSettings = cfgPlanEnabled.listen(session.settings, () => {
				this.broadcastPlanState();
			});
		}
	}

	dispose(): void {
		this.#unsubscribeSettings?.();
		this.#unsubscribeSettings = undefined;
		this.#subscribers.clear();
	}

	setTuiDelegate(delegate?: RpcPlanTuiDelegate): void {
		this.#tuiDelegate = delegate;
	}

	subscribe(output: RpcOutput): () => void {
		this.#subscribers.add(output);
		const pending = this.getPendingReview();
		if (pending) {
			output({ type: "plan_review", review: pending } satisfies RpcPlanReviewFrame);
		}
		return () => {
			this.#subscribers.delete(output);
		};
	}

	getPlanState(): RpcPlanState {
		const available = this.#session.settings instanceof Settings ? cfgPlanEnabled.get(this.#session.settings) : false;
		let enabled = false;
		let paused = false;
		let planFilePath: string | undefined;

		if (this.#tuiDelegate) {
			enabled = this.#tuiDelegate.isPlanModeEnabled();
			paused = this.#tuiDelegate.isPlanModePaused();
			planFilePath = this.#tuiDelegate.getPlanFilePath();
		} else {
			const planState = this.#session.getPlanModeState?.();
			enabled = Boolean(planState?.enabled);
			planFilePath = planState?.planFilePath;
		}

		return {
			available,
			enabled,
			paused,
			...(planFilePath ? { planFilePath } : {}),
		};
	}

	getPendingReview(): RpcPlanReview | null {
		const pending = this.#pendingReview;
		if (!pending) return null;
		return {
			reviewId: pending.reviewId,
			title: pending.title,
			planFilePath: pending.planFilePath,
			markdown: pending.markdown,
		};
	}

	async setPlanMode(enabled: boolean): Promise<RpcPlanState> {
		if (enabled) {
			const goalState = this.#session.getGoalModeState?.();
			if (goalState?.enabled || goalState?.goal.status === "active") {
				throw new Error("Exit goal mode before entering plan mode.");
			}
			const available =
				this.#session.settings instanceof Settings ? cfgPlanEnabled.get(this.#session.settings) : true;
			if (!available) {
				const error = new Error("Plan mode is disabled in settings (plan.enabled)");
				(error as { code?: string }).code = "plan_disabled";
				throw error;
			}
			if (this.#tuiDelegate) {
				await this.#tuiDelegate.enterPlanMode();
			} else {
				const previous = this.#session.getPlanModeState?.();
				const planFilePath = previous?.planFilePath ?? "local://PLAN.md";
				this.#session.setPlanModeState?.({
					enabled: true,
					planFilePath,
					workflow: previous?.workflow ?? "parallel",
					reentry: previous !== undefined,
				});

				if (this.#session.model) {
					this.#previousModelState = {
						model: this.#session.model,
						thinkingLevel: this.#session.configuredThinkingLevel?.(),
					};
				}
				const resolved = this.#session.resolveRoleModelWithThinking?.("plan");
				if (resolved?.model) {
					const transition = resolvePlanModelTransition(
						this.#session.model,
						resolved,
						this.#session.isStreaming ?? false,
					);
					if (transition.kind === "thinking") {
						this.#session.setThinkingLevel?.(transition.thinkingLevel);
					} else if (transition.kind === "apply") {
						await this.#session.setModelTemporary?.(transition.model, transition.thinkingLevel, {
							ephemeral: true,
						});
					}
				}

				this.#session.setPlanProposalHandler?.(title => this.#handleHeadlessProposal(title));
			}
		} else {
			await this.#exitPlanMode();
			this.clearPendingReview();
		}

		this.broadcastPlanState();
		return this.getPlanState();
	}

	async approvePlan(reviewId: string, action: RpcPlanReviewAction, feedback?: string): Promise<RpcPlanState> {
		if (action !== "execute" && action !== "compact" && action !== "refine") {
			throw new Error(`Invalid plan review action: ${String(action)}`);
		}

		if (!this.#pendingReview || this.#pendingReview.reviewId !== reviewId) {
			const error = new Error(`Unknown or stale plan review: ${reviewId}`);
			(error as { code?: string }).code = "stale_review_id";
			throw error;
		}

		const review = this.#pendingReview;
		this.#pendingReview = null;
		this.#broadcastReview(null);

		if (review.origin === "tui") {
			const answered = this.#tuiDelegate?.answerPlanReview(action, feedback);
			if (!answered) {
				const error = new Error(`Unknown or stale plan review: ${reviewId}`);
				(error as { code?: string }).code = "stale_review_id";
				throw error;
			}
			return this.getPlanState();
		}

		// Headless origin
		if (action === "execute") {
			const planContent = (await this.#readPlanFile(review.planFilePath)) ?? review.markdown;
			await autosaveApprovedPlan({
				settings: this.#session.settings,
				cwd: this.#session.sessionManager?.getCwd?.() ?? process.cwd(),
				title: review.title,
				planContent,
			});

			this.#session.setPlanReferencePath?.(review.planFilePath);
			await this.#exitPlanMode();
			this.broadcastPlanState();

			const text = prompt.render(planModeApprovedResultPrompt, {
				planFilePath: review.planFilePath,
			});
			review.resolve?.({
				content: [{ type: "text", text }],
				details: { planFilePath: review.planFilePath, title: review.title, planExists: true },
			});
		} else if (action === "compact") {
			const planContent = (await this.#readPlanFile(review.planFilePath)) ?? review.markdown;
			await autosaveApprovedPlan({
				settings: this.#session.settings,
				cwd: this.#session.sessionManager?.getCwd?.() ?? process.cwd(),
				title: review.title,
				planContent,
			});

			this.#session.setPlanReferencePath?.(review.planFilePath);
			this.#session.markPlanInternalAbortPending?.();
			let compactCancelled = false;
			try {
				await this.#exitPlanMode({ deferModelRestore: true });
				this.broadcastPlanState();

				const compactionPrompt = prompt.render(planModeCompactInstructionsPrompt, {
					planFilePath: review.planFilePath,
				});
				try {
					await this.#session.compact?.(undefined, {
						internalGuidance: compactionPrompt,
						suppressContinuation: true,
					});
				} catch (error) {
					if (error instanceof CompactionCancelledError) {
						compactCancelled = true;
					} else {
						logger.warn("Plan-mode compaction failed; proceeding with plan execution", { error });
					}
				}
				await this.#restorePreviousModel();
			} finally {
				this.#session.clearPlanInternalAbortPending?.();
			}

			if (compactCancelled) {
				review.reject?.(new CompactionCancelledError());
				return this.getPlanState();
			}

			const text = prompt.render(planModeApprovedResultPrompt, {
				planFilePath: review.planFilePath,
			});
			review.resolve?.({
				content: [{ type: "text", text }],
				details: { planFilePath: review.planFilePath, title: review.title, planExists: true },
			});
		} else if (action === "refine") {
			const currentState = this.#session.getPlanModeState?.();
			if (currentState?.enabled && currentState.planFilePath !== review.planFilePath) {
				this.#session.setPlanModeState?.({ ...currentState, planFilePath: review.planFilePath });
			}
			this.broadcastPlanState();

			const normalizedTitle = normalizePlanTitle(review.title).title;
			const text = feedback?.trim()
				? feedback.trim()
				: prompt.render(planModeRefineResultPrompt, {
						title: normalizedTitle,
					});

			review.resolve?.({
				content: [{ type: "text", text }],
				details: { planFilePath: review.planFilePath, title: review.title, planExists: true },
			});
		}

		return this.getPlanState();
	}

	startTuiProposal(input: { title: string; planFilePath: string; planContent: string }): string {
		const reviewId = Snowflake.next();
		this.#pendingReview = {
			reviewId,
			title: input.title,
			planFilePath: input.planFilePath,
			markdown: input.planContent,
			origin: "tui",
		};
		this.#broadcastReview({
			reviewId,
			title: input.title,
			planFilePath: input.planFilePath,
			markdown: input.planContent,
		});
		return reviewId;
	}

	endTuiProposal(reviewId?: string): void {
		if (!this.#pendingReview) return;
		if (reviewId !== undefined && this.#pendingReview.reviewId !== reviewId) return;
		if (this.#pendingReview.origin !== "tui") return;

		this.#pendingReview = null;
		this.#broadcastReview(null);
		this.broadcastPlanState();
	}

	clearPendingReview(): void {
		const pending = this.#pendingReview;
		if (!pending) return;

		this.#pendingReview = null;
		if (pending.origin === "headless") {
			pending.reject?.(new Error("Plan review aborted"));
		} else if (pending.origin === "tui") {
			this.#tuiDelegate?.dismissPlanReview();
		}
		this.#broadcastReview(null);
	}

	broadcastPlanState(force = false): void {
		const state = this.getPlanState();
		if (
			!force &&
			this.#lastBroadcastState &&
			this.#lastBroadcastState.available === state.available &&
			this.#lastBroadcastState.enabled === state.enabled &&
			this.#lastBroadcastState.paused === state.paused &&
			this.#lastBroadcastState.planFilePath === state.planFilePath
		) {
			return;
		}
		this.#lastBroadcastState = state;
		const frame: RpcPlanStateFrame = { type: "plan_state", state };
		for (const output of this.#subscribers) {
			output(frame);
		}
	}

	async #handleHeadlessProposal(title: string): Promise<AgentToolResult<PlanApprovalDetails>> {
		const state = this.#session.getPlanModeState?.();
		if (!state?.enabled) {
			throw new Error("Plan mode is not active.");
		}

		const resolved = await resolveApprovedPlan({
			suppliedTitle: title,
			statePlanFilePath: state.planFilePath,
			readPlan: url => this.#readPlanFile(url),
			listPlanFiles: () => this.#listPlanFiles(),
		});

		const displayTitle = title.trim() || humanizePlanTitle(resolved.title) || resolved.title;

		const reviewId = Snowflake.next();
		const { promise, resolve, reject } = Promise.withResolvers<AgentToolResult<PlanApprovalDetails>>();

		this.#pendingReview = {
			reviewId,
			title: displayTitle,
			planFilePath: resolved.planFilePath,
			markdown: resolved.planContent,
			origin: "headless",
			resolve,
			reject,
		};

		this.#broadcastReview({
			reviewId,
			title: displayTitle,
			planFilePath: resolved.planFilePath,
			markdown: resolved.planContent,
		});

		return promise;
	}

	async #readPlanFile(planFilePath: string): Promise<string | null> {
		return readPlanFile(planFilePath, {
			localProtocolOptions: {
				getArtifactsDir: () => this.#session.sessionManager?.getArtifactsDir?.() ?? "",
				getSessionId: () => this.#session.sessionManager?.getSessionId?.() ?? "",
			},
			cwd: this.#session.sessionManager?.getCwd?.() ?? process.cwd(),
		});
	}

	async #listPlanFiles(): Promise<string[]> {
		return listPlanFiles({
			localProtocolOptions: {
				getArtifactsDir: () => this.#session.sessionManager?.getArtifactsDir?.() ?? "",
				getSessionId: () => this.#session.sessionManager?.getSessionId?.() ?? "",
			},
		});
	}

	async #exitPlanMode(options?: { deferModelRestore?: boolean }): Promise<void> {
		if (this.#tuiDelegate) {
			await this.#tuiDelegate.exitPlanMode({ silent: true, deferModelRestore: options?.deferModelRestore });
		} else {
			this.#session.setPlanProposalHandler?.(null);
			this.#session.setPlanModeState?.(undefined);
			if (!options?.deferModelRestore) {
				await this.#restorePreviousModel();
			}
		}
	}

	async #restorePreviousModel(): Promise<void> {
		const prev = this.#previousModelState;
		this.#previousModelState = undefined;
		if (!prev) return;
		if (this.#session.model && modelsAreEqual(this.#session.model, prev.model)) {
			this.#session.setThinkingLevel?.(prev.thinkingLevel);
		} else {
			await this.#session.setModelTemporary?.(prev.model, prev.thinkingLevel, { ephemeral: true });
		}
	}

	#broadcastReview(review: RpcPlanReview | null): void {
		const frame: RpcPlanReviewFrame = { type: "plan_review", review };
		for (const output of this.#subscribers) {
			output(frame);
		}
	}
	/**
	 * Restore plan mode state on session resume/reconcile if persisted mode was plan.
	 * Brand new sessions or sessions that did not persist plan mode are unchanged.
	 */
	async restoreFromSession(): Promise<boolean> {
		if (this.#tuiDelegate) return false;
		if (!cfgPlanEnabled.get(this.#session.settings)) return false;
		const context = this.#session.sessionManager?.buildSessionContext?.();
		if (!context || context.mode !== "plan") return false;
		const planFilePath = (context.modeData?.planFilePath as string | undefined) ?? "local://PLAN.md";
		const previous = this.#session.getPlanModeState?.();
		this.#session.setPlanModeState?.({
			enabled: true,
			planFilePath,
			workflow: previous?.workflow ?? "parallel",
			reentry: true,
		});
		this.#session.setPlanProposalHandler?.(title => this.#handleHeadlessProposal(title));
		this.broadcastPlanState();
		return true;
	}
}

const coordinators = new WeakMap<object, RpcPlanCoordinator>();

export function getRpcPlanCoordinator(session: AgentSession): RpcPlanCoordinator {
	let coordinator = coordinators.get(session);
	if (!coordinator) {
		coordinator = new RpcPlanCoordinator(session);
		coordinators.set(session, coordinator);
	}
	return coordinator;
}
