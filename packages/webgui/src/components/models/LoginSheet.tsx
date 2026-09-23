import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";
import { browserWindow, browserDocument } from "../../lib/dom";
import type { LoginSheetProps } from "./contract";
import "./login.css";

export function LoginSheet({
	open,
	providerName,
	url,
	instructions,
	progress = [],
	pending,
	result,
	onSubmitInput,
	onCancel,
	onClose,
}: LoginSheetProps): ReactNode {
	const sheetRef = useRef<HTMLDivElement>(null);
	const [inputValue, setInputValue] = useState("");
	const [copied, setCopied] = useState(false);

	// Reset input value when pending request changes
	useEffect(() => {
		setInputValue("");
	}, [pending?.requestId]);

	// Copy url to clipboard
	const handleCopy = useCallback(() => {
		if (!url) return;
		browserWindow.navigator.clipboard
			?.writeText(url)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			})
			.catch(() => {});
	}, [url]);

	// Submit input handler
	const handleSubmit = useCallback(() => {
		if (!pending) return;
		if (pending.kind === "manual_input") {
			const trimmed = inputValue.trim();
			if (trimmed) {
				onSubmitInput(trimmed);
				setInputValue("");
			}
		} else if (pending.kind === "prompt") {
			if (pending.allowEmpty || inputValue.trim()) {
				onSubmitInput(inputValue);
				setInputValue("");
			}
		}
	}, [pending, inputValue, onSubmitInput]);

	// Handle Enter key in inputs
	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	// Focus trap & Esc handler
	useEffect(() => {
		if (!open) return;
		function handleKeyDown(e: KeyboardEvent): void {
			if (e.key === "Escape") {
				e.preventDefault();
				if (result) {
					onClose();
				} else {
					onCancel();
				}
				return;
			}

			if (e.key === "Tab" && sheetRef.current) {
				const focusable = Array.from(
					sheetRef.current.querySelectorAll(
						'button:not([disabled]), input:not([disabled]), a:not([disabled]), [tabindex]:not([tabindex="-1"])',
					),
				) as HTMLElement[];

				if (focusable.length > 0) {
					const first = focusable[0];
					const last = focusable[focusable.length - 1];
					const active = browserDocument.activeElement as HTMLElement | null;

					if (e.shiftKey) {
						if (!active || active === first || !sheetRef.current.contains(active)) {
							e.preventDefault();
							last.focus();
						}
					} else {
						if (!active || active === last || !sheetRef.current.contains(active)) {
							e.preventDefault();
							first.focus();
						}
					}
				}
			}
		}

		const win = globalThis as unknown as {
			addEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
			removeEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
		};
		win.addEventListener("keydown", handleKeyDown);
		return () => win.removeEventListener("keydown", handleKeyDown);
	}, [open, result, onCancel, onClose]);

	if (!open) return null;

	const handleHeaderClose = () => {
		if (result) {
			onClose();
		} else {
			onCancel();
		}
	};

	const canSubmitPrompt = pending?.kind === "prompt" && (Boolean(pending.allowEmpty) || Boolean(inputValue.trim()));
	const canSubmitManual = pending?.kind === "manual_input" && Boolean(inputValue.trim());

	return (
		<>
			<div className="login-backdrop" onClick={handleHeaderClose} />
			<div className="login-sheet" role="dialog" aria-label={`Log in to ${providerName}`} ref={sheetRef}>
				{/* Header */}
				<div className="login-header">
					<span className="login-title">Log in to {providerName}</span>
					<button type="button" className="login-close" aria-label="Close" onClick={handleHeaderClose}>
						<X size={18} />
					</button>
				</div>

				{/* Body */}
				<div className="login-body">
					{/* Sign-in link and copy button */}
					{url ? (
						<div className="login-actions-row">
							<a href={url} target="_blank" rel="noopener noreferrer" className="login-btn-primary">
								Open sign-in page
							</a>
							<button type="button" className="login-btn-secondary" onClick={handleCopy}>
								{copied ? "Copied!" : "Copy link"}
							</button>
						</div>
					) : null}

					{/* Instructions */}
					{instructions ? <div className="login-instructions">{instructions}</div> : null}

					{/* Progress list */}
					{progress.length > 0 ? (
						<div className="login-progress-list">
							{progress.map((msg, index) => (
								<div key={index} className="login-progress-item">
									<span className="login-progress-dot" aria-hidden="true" />
									<span>{msg}</span>
								</div>
							))}
						</div>
					) : null}

					{/* Pending: Manual input */}
					{pending?.kind === "manual_input" && !result ? (
						<div className="login-field">
							<label className="login-field-label" htmlFor="login-manual-input">
								Paste the address of the page you landed on
							</label>
							<div className="login-field-helper">
								After you sign in, the browser opens a page that cannot load. Copy its address and paste it
								here.
							</div>
							<input
								id="login-manual-input"
								type="text"
								className="login-input"
								value={inputValue}
								onChange={e => setInputValue(e.target.value)}
								onKeyDown={handleInputKeyDown}
								autoFocus
							/>
							<div className="login-footer">
								<button
									type="button"
									className="login-btn-primary"
									disabled={!canSubmitManual}
									onClick={handleSubmit}
								>
									Submit
								</button>
							</div>
						</div>
					) : null}

					{/* Pending: Prompt */}
					{pending?.kind === "prompt" && !result ? (
						<div className="login-field">
							<label className="login-field-label" htmlFor="login-prompt-input">
								{pending.message}
							</label>
							<input
								id="login-prompt-input"
								type={pending.secret ? "password" : "text"}
								placeholder={pending.placeholder}
								className="login-input"
								value={inputValue}
								onChange={e => setInputValue(e.target.value)}
								onKeyDown={handleInputKeyDown}
								autoFocus
							/>
							<div className="login-footer">
								<button
									type="button"
									className="login-btn-primary"
									disabled={!canSubmitPrompt}
									onClick={handleSubmit}
								>
									Submit
								</button>
							</div>
						</div>
					) : null}

					{/* Result: Done */}
					{result?.kind === "done" ? (
						<div className="login-status-done">
							{result.identity ? `Connected as ${result.identity}` : "Logged in successfully"}
						</div>
					) : null}

					{/* Result: Failed */}
					{result?.kind === "failed" ? (
						<div className="login-status-failed">{result.cancelled ? "Login cancelled" : result.error}</div>
					) : null}

					{/* Footer action buttons */}
					<div className="login-footer">
						{!result ? (
							<button type="button" className="login-btn-cancel" onClick={onCancel}>
								Cancel
							</button>
						) : result.kind === "done" ? (
							<button type="button" className="login-btn-primary" onClick={onClose}>
								Done
							</button>
						) : (
							<button type="button" className="login-btn-secondary" onClick={onClose}>
								Close
							</button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
