import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Copy, GitBranch, History, X } from "lucide-react";
import { browserWindow } from "../../lib/dom";
import type { BtwState } from "../../lib/session-store";
import type { BtwHistoryRecord } from "@oh-my-pi/pi-coding-agent/session/btw-history";
import { Markdown } from "../transcript/Markdown";
import "./btw-sheet.css";

export interface BtwSheetProps {
	btw: BtwState | null;
	historyRecords?: readonly BtwHistoryRecord[];
	canBranch?: boolean;
	onCancel: () => void;
	onClose: () => void;
	onFollowUp?: (question: string, recordId: string) => void;
	onBranch?: (recordId: string) => void;
	onSelectRecord?: (record: BtwHistoryRecord) => void;
	onLoadHistory?: () => void;
}

export function BtwSheet({
	btw,
	historyRecords = [],
	canBranch = false,
	onCancel,
	onClose,
	onFollowUp,
	onBranch,
	onSelectRecord,
	onLoadHistory,
}: BtwSheetProps): ReactNode {
	const [followUpText, setFollowUpText] = useState("");
	const [showHistory, setShowHistory] = useState(false);
	const [copied, setCopied] = useState(false);
	const [confirmBranch, setConfirmBranch] = useState(false);

	const handleKeyDown = useCallback(
		(e: unknown) => {
			const evt = e as { key?: string; preventDefault?: () => void };
			if (evt.key === "Escape") {
				evt.preventDefault?.();
				if (showHistory) {
					setShowHistory(false);
					return;
				}
				if (confirmBranch) {
					setConfirmBranch(false);
					return;
				}
				if (btw?.status === "running") {
					onCancel();
				} else {
					onClose();
				}
			}
		},
		[btw?.status, onCancel, onClose, showHistory, confirmBranch],
	);

	useEffect(() => {
		if (!btw) return;
		browserWindow.addEventListener("keydown", handleKeyDown);
		return () => browserWindow.removeEventListener("keydown", handleKeyDown);
	}, [btw, handleKeyDown]);

	if (!btw) return null;

	const isRunning = btw.status === "running";
	const currentRecordId = btw.followUpOf ?? btw.btwId;
	const activeRecord = historyRecords.find(r => r.id === currentRecordId);

	const copyAnswer = () => {
		const textToCopy = btw.answer || (activeRecord ? activeRecord.answer : "");
		if (!textToCopy) return;
		const clipboard = browserWindow.navigator?.clipboard;
		if (clipboard?.writeText) {
			void clipboard.writeText(textToCopy).then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			});
		}
	};

	const submitFollowUp = (e?: React.FormEvent) => {
		e?.preventDefault();
		const q = followUpText.trim();
		if (!q || isRunning) return;
		onFollowUp?.(q, currentRecordId);
		setFollowUpText("");
	};

	const handleBranchClick = () => {
		if (!confirmBranch) {
			setConfirmBranch(true);
			return;
		}
		setConfirmBranch(false);
		onBranch?.(currentRecordId);
	};

	return (
		<>
			<div
				className="btw-backdrop"
				onClick={() => {
					if (isRunning) onCancel();
					else onClose();
				}}
			/>
			<div className="btw-sheet" role="dialog" aria-label="Side question (/btw)">
				<div className="btw-header">
					<div className="btw-header-text">
						<span className="btw-badge">/btw</span>
						<span className="btw-question" title={btw.question}>
							{btw.question}
						</span>
					</div>
					<div className="btw-header-actions">
						{onLoadHistory && (
							<button
								type="button"
								className="btw-icon-btn"
								title="History"
								onClick={() => {
									if (!showHistory) onLoadHistory();
									setShowHistory(!showHistory);
								}}
							>
								<History size={14} />
								<span>{showHistory ? "Current" : "History"}</span>
							</button>
						)}
						<button
							type="button"
							className="btw-close"
							aria-label="Close"
							onClick={isRunning ? onCancel : onClose}
						>
							<X size={18} />
						</button>
					</div>
				</div>

				<div className="btw-body">
					{showHistory ? (
						<div className="btw-history-view">
							<div className="btw-history-title">Saved /btw Conversations</div>
							{historyRecords.length === 0 ? (
								<div className="btw-history-empty">No history recorded yet</div>
							) : (
								<div className="btw-history-list">
									{historyRecords.map(rec => (
										<button
											key={rec.id}
											type="button"
											className="btw-history-item"
											onClick={() => {
												onSelectRecord?.(rec);
												setShowHistory(false);
											}}
										>
											<div className="btw-history-item-q">{rec.question}</div>
											<div className="btw-history-item-meta">
												<span>{rec.status}</span>
												{rec.followUps && rec.followUps.length > 0 && (
													<span>{rec.followUps.length} follow-up(s)</span>
												)}
												<span>{new Date(rec.createdAt).toLocaleTimeString()}</span>
											</div>
										</button>
									))}
								</div>
							)}
						</div>
					) : (
						<>
							{activeRecord && activeRecord.followUps && activeRecord.followUps.length > 0 ? (
								<div className="btw-turn">
									<div className="btw-turn-q">
										<span className="btw-q-label">Q:</span>
										<span>{activeRecord.question}</span>
									</div>
									<div className="btw-turn-a">
										<Markdown text={activeRecord.answer} />
									</div>
									{activeRecord.followUps.map((fu, idx) => (
										<div key={idx} className="btw-turn">
											<div className="btw-turn-q">
												<span className="btw-q-label">Q:</span>
												<span>{fu.question}</span>
											</div>
											<div className="btw-turn-a">
												{idx === activeRecord.followUps!.length - 1 && btw.status === "running" ? (
													btw.answer ? (
														<Markdown text={btw.answer} />
													) : (
														<div className="btw-status">Thinking...</div>
													)
												) : (
													<Markdown text={fu.answer} />
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="btw-turn">
									<div className="btw-turn-a">
										{btw.answer ? (
											<Markdown text={btw.answer} />
										) : isRunning ? (
											<div className="btw-status">Thinking...</div>
										) : null}
									</div>
								</div>
							)}

							{btw.status === "error" && (
								<div className="btw-error">Error: {btw.error || "An unknown error occurred"}</div>
							)}
							{btw.status === "cancelled" && <div className="btw-cancelled">Question cancelled.</div>}
						</>
					)}
				</div>

				{!showHistory && !isRunning && onFollowUp && btw.status === "complete" && (
					<form className="btw-followup-form" onSubmit={submitFollowUp}>
						<input
							type="text"
							className="btw-followup-input"
							placeholder="Ask a follow-up question..."
							value={followUpText}
							onChange={e => setFollowUpText(e.target.value)}
						/>
						<button
							type="submit"
							className="btw-btn btw-btn-primary"
							disabled={!followUpText.trim() || isRunning}
						>
							Send
						</button>
					</form>
				)}

				<div className="btw-footer">
					<div className="btw-footer-left">
						{btw.answer && (
							<button type="button" className="btw-btn btw-btn-secondary" onClick={copyAnswer}>
								<Copy size={14} />
								<span>{copied ? "Copied" : "Copy"}</span>
							</button>
						)}
						{canBranch && btw.status === "complete" && onBranch && (
							<button
								type="button"
								className="btw-btn btw-btn-secondary"
								onClick={handleBranchClick}
								title="Branch main session from this /btw answer"
							>
								<GitBranch size={14} />
								<span>{confirmBranch ? "Confirm Branch?" : "Branch"}</span>
							</button>
						)}
					</div>

					<div className="btw-footer-right">
						{isRunning ? (
							<button type="button" className="btw-btn btw-btn-secondary" onClick={onCancel}>
								Cancel
							</button>
						) : (
							<button type="button" className="btw-btn btw-btn-primary" onClick={onClose}>
								Close
							</button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
