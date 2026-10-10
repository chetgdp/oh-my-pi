import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { RpcExtensionUIResponse } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { PendingDialog } from "../../lib/session-store";
import { browserWindow } from "../../lib/dom";
import "../plan/plan-review.css";
import "./extension-dialog.css";

export interface ExtensionDialogSheetProps {
	/** Oldest pending dialog; null renders nothing. */
	dialog: PendingDialog | null;
	/** Dialogs waiting behind this one. */
	queued: number;
	onAnswer: (response: RpcExtensionUIResponse) => void;
}

/** Tool and eval approvals arrive as a plain select with exactly these options. */
export function isApprovalSelect(dialog: PendingDialog): boolean {
	return (
		dialog.method === "select" &&
		dialog.options.length === 2 &&
		dialog.options[0] === "Approve" &&
		dialog.options[1] === "Deny"
	);
}

export function ExtensionDialogSheet({ dialog, queued, onAnswer }: ExtensionDialogSheetProps): ReactNode {
	const [text, setText] = useState("");

	useEffect(() => {
		if (!dialog) return;
		setText(dialog.method === "editor" ? (dialog.prefill ?? "") : "");
	}, [dialog?.id]);

	useEffect(() => {
		if (!dialog) return;
		const id = dialog.id;
		function handleKeyDown(e: unknown): void {
			if ((e as { key?: string }).key === "Escape") onAnswer({ type: "extension_ui_response", id, cancelled: true });
		}
		browserWindow.addEventListener("keydown", handleKeyDown);
		return () => browserWindow.removeEventListener("keydown", handleKeyDown);
	}, [dialog?.id, onAnswer]);

	if (!dialog) return null;

	const id = dialog.id;
	const cancel = (): void => onAnswer({ type: "extension_ui_response", id, cancelled: true });
	const answerValue = (value: string): void => onAnswer({ type: "extension_ui_response", id, value });
	const approval = isApprovalSelect(dialog);
	const heading = approval ? "Approval required" : dialog.method === "confirm" ? dialog.title : "Input requested";
	// Select/input/editor titles carry the question and may span lines; confirm puts it in `message`.
	const prompt = dialog.method === "confirm" ? dialog.message : dialog.title;

	let body: ReactNode = null;
	let footer: ReactNode;
	if (dialog.method === "select" && approval) {
		footer = (
			<>
				<button type="button" className="plan-btn plan-btn-primary" onClick={() => answerValue("Approve")}>
					Approve
				</button>
				<button type="button" className="plan-btn plan-btn-secondary" onClick={() => answerValue("Deny")}>
					Deny
				</button>
			</>
		);
	} else if (dialog.method === "select") {
		body = (
			<div className="xdlg-options" role="listbox">
				{dialog.options.map((option, i) => {
					const description = dialog.optionDetails?.[i]?.description;
					return (
						<button
							key={`${i}:${option}`}
							type="button"
							role="option"
							aria-selected={false}
							className="xdlg-option"
							onClick={() => answerValue(option)}
						>
							<span className="xdlg-option-label">{option}</span>
							{description ? <span className="xdlg-option-desc">{description}</span> : null}
						</button>
					);
				})}
			</div>
		);
		footer = (
			<button type="button" className="plan-btn plan-btn-cancel" onClick={cancel}>
				Cancel
			</button>
		);
	} else if (dialog.method === "confirm") {
		footer = (
			<>
				<button
					type="button"
					className="plan-btn plan-btn-primary"
					onClick={() => onAnswer({ type: "extension_ui_response", id, confirmed: true })}
				>
					Yes
				</button>
				<button
					type="button"
					className="plan-btn plan-btn-secondary"
					onClick={() => onAnswer({ type: "extension_ui_response", id, confirmed: false })}
				>
					No
				</button>
			</>
		);
	} else {
		const editor = dialog.method === "editor";
		body = editor ? (
			<textarea
				className="plan-refine-input xdlg-editor"
				aria-label={dialog.title}
				value={text}
				onChange={e => setText(e.target.value)}
				rows={8}
				autoFocus
				onKeyDown={e => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
						e.preventDefault();
						answerValue(text);
					}
				}}
			/>
		) : (
			<input
				type="text"
				className="plan-refine-input xdlg-input"
				aria-label={dialog.title}
				placeholder={dialog.placeholder}
				value={text}
				onChange={e => setText(e.target.value)}
				autoFocus
				onKeyDown={e => {
					if (e.key === "Enter") {
						e.preventDefault();
						answerValue(text);
					}
				}}
			/>
		);
		footer = (
			<>
				<button type="button" className="plan-btn plan-btn-primary" onClick={() => answerValue(text)}>
					Submit
				</button>
				<button type="button" className="plan-btn plan-btn-cancel" onClick={cancel}>
					Cancel
				</button>
			</>
		);
	}

	return (
		<>
			<div className="plan-backdrop" />
			<div className="plan-review-sheet xdlg-sheet" role="dialog" aria-label={heading} data-method={dialog.method}>
				<div className="plan-review-header">
					<div className="plan-review-header-text">
						<h2 className="plan-review-title">{heading}</h2>
						{queued > 0 ? <span className="plan-review-path">{queued} more waiting</span> : null}
					</div>
					<button type="button" className="plan-review-close" aria-label="Cancel" onClick={cancel}>
						<X size={18} />
					</button>
				</div>
				<div className="plan-review-body xdlg-body">
					{prompt ? <p className="xdlg-prompt">{prompt}</p> : null}
					{body}
				</div>
				<div className="plan-review-footer">{footer}</div>
			</div>
		</>
	);
}
