import { useState, useEffect, useCallback, type ReactNode } from "react";
import { browserWindow } from "../../lib/dom";
import type { LoginFlowProps } from "./contract";
import "./login.css";

/** Login body rendered inside the control center; Esc and back navigation belong to the control center. */
export function LoginFlow({
	url,
	instructions,
	progress = [],
	pending,
	result,
	onSubmitInput,
	onCancel,
	onClose,
}: LoginFlowProps): ReactNode {
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

	const canSubmitPrompt = pending?.kind === "prompt" && (Boolean(pending.allowEmpty) || Boolean(inputValue.trim()));
	const canSubmitManual = pending?.kind === "manual_input" && Boolean(inputValue.trim());

	return (
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
						After you sign in, the browser opens a page that cannot load. Copy its address and paste it here.
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
	);
}
