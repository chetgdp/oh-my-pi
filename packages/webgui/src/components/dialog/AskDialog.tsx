import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { RpcAskDialogQuestion, RpcExtensionUIResponse } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface AskDialogProps {
	id: string;
	questions: readonly RpcAskDialogQuestion[];
	/** Dialogs waiting behind this one. */
	queued: number;
	onAnswer: (response: RpcExtensionUIResponse) => void;
	/** Hides the sheet without answering; the alert strip reopens it. */
	onClose?: () => void;
}

interface AskAnswer {
	id: string;
	selectedOptions: string[];
	customInput?: string;
}

function initialHighlight(q: RpcAskDialogQuestion): number {
	const r = q.recommended;
	return r !== undefined && r >= 0 && r < q.options.length ? r : 0;
}

/** Builds the host contract: question order, labels in option order, trimmed custom text only when non-empty. */
function buildAnswers(
	questions: readonly RpcAskDialogQuestion[],
	selected: readonly (readonly string[])[],
	custom: readonly string[],
): AskAnswer[] {
	return questions.map((q, i) => {
		const picked = selected[i] ?? [];
		const answer: AskAnswer = {
			id: q.id,
			selectedOptions: q.options.map(o => o.label).filter(label => picked.includes(label)),
		};
		const text = (custom[i] ?? "").trim();
		if (text) answer.customInput = text;
		return answer;
	});
}

/** Rich multi-question `ask`; parent keys it by dialog id so state resets per request. */
export function AskDialog({ id, questions, queued, onAnswer, onClose }: AskDialogProps): ReactNode {
	const total = questions.length;
	const hasReview = total > 1 || questions.some(q => q.multi);
	const [page, setPage] = useState(0);
	const [selected, setSelected] = useState<string[][]>(() => questions.map(() => []));
	const [custom, setCustom] = useState<string[]>(() => questions.map(() => ""));
	const [highlight, setHighlight] = useState<number[]>(() => questions.map(initialHighlight));

	const cancel = (): void => onAnswer({ type: "extension_ui_response", id, cancelled: true });
	const submit = (sel: readonly (readonly string[])[], txt: readonly string[]): void =>
		onAnswer({ type: "extension_ui_response", id, answers: buildAnswers(questions, sel, txt) });

	const onReview = hasReview && page === total;
	const q = onReview ? null : questions[page];
	const heading = onReview ? "Review answers" : (q?.header ?? "Question");
	const step = onReview ? `Review · ${total} question${total === 1 ? "" : "s"}` : `Q ${page + 1} of ${total}`;

	const setHighlightAt = (qi: number, oi: number): void => setHighlight(h => h.with(qi, oi));

	function choose(qi: number, label: string, oi: number): void {
		const question = questions[qi];
		setHighlightAt(qi, oi);
		if (question.multi) {
			const cur = selected[qi];
			const next = cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label];
			setSelected(selected.with(qi, next));
			return;
		}
		const nextSel = selected.with(qi, [label]);
		const nextCustom = custom.with(qi, "");
		setSelected(nextSel);
		setCustom(nextCustom);
		if (!hasReview) submit(nextSel, nextCustom);
	}

	function typeCustom(qi: number, value: string): void {
		setCustom(custom.with(qi, value));
		// Single-select: free text replaces the chosen option.
		if (!questions[qi].multi && value.trim() && selected[qi].length > 0) setSelected(selected.with(qi, []));
	}

	let body: ReactNode;
	if (q) {
		const qi = page;
		const hl = q.options[highlight[qi]];
		body = (
			<>
				<p className="xdlg-prompt">{q.question}</p>
				<div className="xdlg-options" role={q.multi ? "group" : "radiogroup"} aria-label={q.question}>
					{q.options.map((option, oi) => {
						const isSelected = selected[qi].includes(option.label);
						const cls = [
							"xdlg-option",
							"xdlg-ask-option",
							isSelected ? "xdlg-ask-selected" : "",
							oi === highlight[qi] ? "xdlg-ask-highlight" : "",
						]
							.filter(Boolean)
							.join(" ");
						return (
							<button
								key={`${oi}:${option.label}`}
								type="button"
								role={q.multi ? "checkbox" : "radio"}
								aria-checked={isSelected}
								className={cls}
								autoFocus={oi === highlight[qi]}
								onFocus={() => setHighlightAt(qi, oi)}
								onMouseEnter={() => setHighlightAt(qi, oi)}
								onClick={() => choose(qi, option.label, oi)}
							>
								<span className="xdlg-ask-option-row">
									<span
										className={q.multi ? "xdlg-ask-mark xdlg-ask-check" : "xdlg-ask-mark xdlg-ask-radio"}
									/>
									<span className="xdlg-option-label">{option.label}</span>
									{oi === q.recommended ? <span className="xdlg-ask-badge">Recommended</span> : null}
								</span>
								{option.description ? <span className="xdlg-option-desc">{option.description}</span> : null}
							</button>
						);
					})}
				</div>
				{hl?.preview ? <div className="xdlg-ask-preview">{hl.preview}</div> : null}
				<label className="xdlg-ask-other">
					<span className="xdlg-ask-other-label">Other</span>
					<input
						type="text"
						className="plan-refine-input xdlg-input xdlg-ask-other-input"
						aria-label="Other"
						placeholder={q.multi ? "Add your own answer" : "Type your own answer"}
						value={custom[qi]}
						onChange={e => typeCustom(qi, e.target.value)}
						onKeyDown={e => {
							if (e.key !== "Enter") return;
							e.preventDefault();
							if (hasReview) setPage(qi + 1);
							else submit(selected, custom);
						}}
					/>
				</label>
			</>
		);
	} else {
		const answers = buildAnswers(questions, selected, custom);
		body = (
			<ol className="xdlg-ask-review">
				{questions.map((question, qi) => {
					const a = answers[qi];
					const parts = a.customInput ? [...a.selectedOptions, a.customInput] : a.selectedOptions;
					return (
						<li key={question.id} className="xdlg-ask-review-item">
							<button type="button" className="xdlg-ask-review-q" onClick={() => setPage(qi)}>
								{question.header ?? question.question}
							</button>
							{parts.length > 0 ? (
								<span className="xdlg-ask-review-a">{parts.join(", ")}</span>
							) : (
								<span className="xdlg-ask-unanswered">Unanswered</span>
							)}
						</li>
					);
				})}
			</ol>
		);
	}

	const isLast = hasReview ? onReview : true;
	return (
		<>
			<div className="plan-backdrop" onClick={onClose} />
			<div className="plan-review-sheet xdlg-sheet" role="dialog" aria-label={heading} data-method="ask">
				<div className="plan-review-header">
					<div className="plan-review-header-text">
						<h2 className="plan-review-title">{heading}</h2>
						<span className="plan-review-path">{step}</span>
						{queued > 0 ? <span className="plan-review-path">{queued} more waiting</span> : null}
					</div>
					<button type="button" className="plan-review-close" aria-label="Cancel" onClick={cancel}>
						<X size={18} />
					</button>
				</div>
				<div className="plan-review-body xdlg-body">{body}</div>
				<div className="plan-review-footer">
					{page > 0 ? (
						<button type="button" className="plan-btn plan-btn-secondary" onClick={() => setPage(page - 1)}>
							Back
						</button>
					) : null}
					{isLast ? (
						<button type="button" className="plan-btn plan-btn-primary" onClick={() => submit(selected, custom)}>
							Submit
						</button>
					) : (
						<button type="button" className="plan-btn plan-btn-primary" onClick={() => setPage(page + 1)}>
							Next
						</button>
					)}
					<button type="button" className="plan-btn plan-btn-cancel" onClick={cancel}>
						Cancel
					</button>
				</div>
			</div>
		</>
	);
}
