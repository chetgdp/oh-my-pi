import { useState, useRef, useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { RpcPlanReview, RpcPlanReviewAction } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionCommandSink } from "../../lib/session-actions";
import { approvePlan } from "../../lib/session-actions";
import { notify } from "../../lib/notify";
import { Markdown } from "../transcript/Markdown";
import { browserWindow } from "../../lib/dom";
import "./plan-review.css";

export interface PlanReviewSheetProps {
	review: RpcPlanReview | null;
	sink?: SessionCommandSink | null;
	onApprove?: (reviewId: string, action: RpcPlanReviewAction, feedback?: string) => Promise<void>;
	onClose?: () => void;
}

export function PlanReviewSheet({ review, sink, onApprove, onClose }: PlanReviewSheetProps): ReactNode {
	const [inFlight, setInFlight] = useState(false);
	const [showRefine, setShowRefine] = useState(false);
	const [feedback, setFeedback] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Reset refine mode when reviewId changes
	useEffect(() => {
		setShowRefine(false);
		setFeedback("");
	}, [review?.reviewId]);

	// Auto-focus textarea when entering refine mode
	useEffect(() => {
		if (showRefine) {
			textareaRef.current?.focus();
		}
	}, [showRefine]);

	// Escape key to cancel refine or close sheet
	useEffect(() => {
		if (!review) return;
		function handleKeyDown(e: unknown): void {
			const evt = e as { key?: string };
			if (evt.key === "Escape") {
				if (showRefine) {
					setShowRefine(false);
				} else if (onClose) {
					onClose();
				}
			}
		}
		const win = browserWindow;
		win.addEventListener("keydown", handleKeyDown);
		return () => win.removeEventListener("keydown", handleKeyDown);
	}, [review, showRefine, onClose]);

	if (!review) return null;

	const handleAction = async (action: RpcPlanReviewAction, fbText?: string): Promise<void> => {
		if (inFlight) return;
		setInFlight(true);
		try {
			const trimmed = fbText?.trim();
			const finalFb = trimmed && trimmed.length > 0 ? trimmed : undefined;
			if (onApprove) {
				await onApprove(review.reviewId, action, finalFb);
			} else if (sink) {
				await approvePlan(sink, review.reviewId, action, finalFb);
			}
		} catch (err: unknown) {
			notify("error", `Failed to approve plan: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setInFlight(false);
		}
	};

	return (
		<>
			<div className="plan-backdrop" onClick={onClose} />
			<div className="plan-review-sheet" role="dialog" aria-label={review.title || "Plan Review"}>
				<div className="plan-review-header">
					<div className="plan-review-header-text">
						<h2 className="plan-review-title">{review.title || "Plan Review"}</h2>
						{review.planFilePath ? (
							<span className="plan-review-path" title={review.planFilePath}>
								{review.planFilePath}
							</span>
						) : null}
					</div>
					{onClose ? (
						<button
							type="button"
							className="plan-review-close"
							aria-label="Close"
							onClick={onClose}
							disabled={inFlight}
						>
							<X size={18} />
						</button>
					) : null}
				</div>

				<div className="plan-review-body">
					<Markdown text={review.markdown} />
				</div>

				{showRefine ? (
					<div className="plan-refine-section">
						<label className="plan-refine-label" htmlFor="plan-refine-textarea">
							Feedback for refinement (optional):
						</label>
						<textarea
							id="plan-refine-textarea"
							ref={textareaRef}
							className="plan-refine-input"
							value={feedback}
							onChange={e => setFeedback(e.target.value)}
							placeholder="Explain what to change in the plan..."
							rows={3}
							disabled={inFlight}
							onKeyDown={e => {
								if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
									e.preventDefault();
									void handleAction("refine", feedback);
								}
							}}
						/>
					</div>
				) : null}

				<div className="plan-review-footer">
					{showRefine ? (
						<>
							<button
								type="button"
								className="plan-btn plan-btn-primary"
								onClick={() => handleAction("refine", feedback)}
								disabled={inFlight}
							>
								Send feedback
							</button>
							<button
								type="button"
								className="plan-btn plan-btn-secondary"
								onClick={() => handleAction("execute")}
								disabled={inFlight}
							>
								Approve and execute
							</button>
							<button
								type="button"
								className="plan-btn plan-btn-secondary"
								onClick={() => handleAction("compact")}
								disabled={inFlight}
							>
								Approve and compact
							</button>
							<button
								type="button"
								className="plan-btn plan-btn-cancel"
								onClick={() => setShowRefine(false)}
								disabled={inFlight}
							>
								Cancel
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								className="plan-btn plan-btn-primary"
								onClick={() => handleAction("execute")}
								disabled={inFlight}
							>
								Approve and execute
							</button>
							<button
								type="button"
								className="plan-btn plan-btn-secondary"
								onClick={() => handleAction("compact")}
								disabled={inFlight}
							>
								Approve and compact
							</button>
							<button
								type="button"
								className="plan-btn plan-btn-secondary plan-btn-refine"
								onClick={() => setShowRefine(true)}
								disabled={inFlight}
							>
								Refine
							</button>
						</>
					)}
				</div>
			</div>
		</>
	);
}
