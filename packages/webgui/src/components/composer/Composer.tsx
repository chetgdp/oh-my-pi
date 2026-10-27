import { enterSubmits as enterSubmitsFn, historyNavDirection } from "./useComposerKeyboard";
import { ArrowUp, Paperclip, Square, Zap, List } from "lucide-react";
import { createPromptHistoryNavigator } from "../../lib/prompt-history";

/**
 * Pure decision: what send mode should the composer use?
 */
export function resolveSendMode(busy: boolean, busyMode: "steer" | "followUp"): "prompt" | "steer" | "followUp" {
	return busy ? busyMode : "prompt";
}

// iOS: a tap that moves focus off the textarea closes the keyboard, the layout shifts
// under the finger and the click is lost. Cancelling mousedown keeps focus in place.
function keepTextareaFocus(e: { preventDefault(): void }): void {
	e.preventDefault();
}

import { useState, useRef, useCallback, useEffect, useLayoutEffect, memo } from "react";
import { escapeAction, isClearDraftKey } from "../../lib/focus-model";
import type { ReactNode } from "react";
import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { useComposerKeyboard } from "./useComposerKeyboard";
import { SlashAutocomplete, matchingCommands, slashKeyAction } from "./SlashAutocomplete";
import { FileAutocomplete, finePointer, useFileCompletion } from "./FileAutocomplete";
import type { CompleteFn } from "./FileAutocomplete";
import type { ComposerDraft } from "../../lib/session-actions";
import { onDraftsHydrated, readDraft, writeDraft } from "../../lib/drafts";
import { browserDocument, browserWindow } from "../../lib/dom";
import { getWrenState } from "../../lib/wren";
import "./composer.css";

export interface ComposerProps {
	busy: boolean;
	/** Context compaction in progress: sends are forced to Queue and the mode chip is locked. */
	compacting?: boolean;
	commands: readonly RpcAvailableSlashCommand[];
	promptHistory?: readonly string[];
	/** Return false to keep the draft (a refused submit); anything else clears it. */
	onSend(text: string, mode: "prompt" | "steer" | "followUp", images?: readonly string[]): boolean | void;
	onAbort(): void;
	restoredDraft?: ComposerDraft | null;
	onDraftRestored?(): void;
	onDraftChange?(draft: ComposerDraft): void;
	/** Focused subagent id: the composer talks to that agent and Esc returns to Main. */
	focusedAgentId?: string;
	/** Composer text is kept per key, so leaving and returning restores it. */
	draftKey?: string;
	onExitFocus?(): void;
	/** File/path completion source (desktop only); omitted disables `@`/Tab completion. */
	complete?: CompleteFn;
}

/** Max textarea rows before scrolling */
const MAX_ROWS = 8;

const MAC = /Mac|iPhone|iPad/.test(browserWindow.navigator?.userAgent ?? "");

export const Composer = memo(function Composer({
	busy,
	compacting = false,
	commands,
	promptHistory = [],
	onSend,
	onAbort,
	restoredDraft,
	onDraftRestored,
	onDraftChange,
	focusedAgentId,
	onExitFocus,
	draftKey,
	complete,
}: ComposerProps): ReactNode {
	const [text, setText] = useState(() => (draftKey ? readDraft(draftKey).text : ""));
	const [busyMode, setBusyMode] = useState<"steer" | "followUp">("steer");
	const [images, setImages] = useState<readonly string[]>(() => (draftKey ? readDraft(draftKey).images : []));
	const [slashDismissed, setSlashDismissed] = useState(false);
	const [slashIndex, setSlashIndex] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const { enterSubmits } = useComposerKeyboard();
	const historyRef = useRef<readonly string[]>(promptHistory);
	historyRef.current = promptHistory;
	const navRef = useRef(createPromptHistoryNavigator(() => historyRef.current));
	// Swap drafts during render, not in an effect: the save effect below would otherwise
	// run once with the old text under the new key.
	const [loadedKey, setLoadedKey] = useState(draftKey);
	if (loadedKey !== draftKey) {
		const next = draftKey ? readDraft(draftKey) : { text: "", images: [] };
		setLoadedKey(draftKey);
		setText(next.text);
		setImages(next.images);
		navRef.current.reset();
	}
	const trimmed = text.trim();
	const canSend = trimmed.length > 0 || images.length > 0;

	const handleSend = useCallback(() => {
		if (!canSend) {
			// Empty submit while the focused agent streams interrupts its turn (TUI parity).
			if (focusedAgentId && busy) onAbort();
			return;
		}
		const mode = resolveSendMode(busy, compacting ? "followUp" : busyMode);
		const accepted = onSend(trimmed, mode, images.length > 0 ? images : undefined);
		if (accepted === false) return;
		setText("");
		setImages([]);
		navRef.current.reset();
		// iOS has no API to stop dictation; dismissing the keyboard ends it so Wren playback is audible.
		// A plain blur is ignored while dictation is listening; a read-only field cannot hold the keyboard.
		const voice = getWrenState();
		const el = textareaRef.current;
		if (el && !finePointer() && (voice.enabled || voice.armed)) {
			el.setAttribute("readonly", "");
			el.blur();
			requestAnimationFrame(() => el.blur());
			setTimeout(() => el.removeAttribute("readonly"), 400);
		}
	}, [canSend, busy, busyMode, compacting, trimmed, images, onSend, onAbort, focusedAgentId]);
	useEffect(() => {
		onDraftChange?.({ text, images });
	}, [text, images, onDraftChange]);
	useEffect(() => {
		if (draftKey) writeDraft(draftKey, { text, images });
	}, [draftKey, text, images]);
	const draftRef = useRef({ text, images });
	draftRef.current = { text, images };
	useEffect(() => {
		if (!draftKey) return;
		// Only fill an empty box: anything typed or attached before storage loaded wins.
		return onDraftsHydrated(() => {
			if (draftRef.current.text !== "" || draftRef.current.images.length > 0) return;
			const saved = readDraft(draftKey);
			setText(saved.text);
			setImages(saved.images);
		});
	}, [draftKey]);

	useEffect(() => {
		if (!restoredDraft) return;
		setText(restoredDraft.text);
		setImages(restoredDraft.images ? [...restoredDraft.images] : []);
		navRef.current.onEdit(restoredDraft.text);
		onDraftRestored?.();
		if (finePointer()) refocusComposer();
	}, [restoredDraft, onDraftRestored]);

	function refocusComposer(): void {
		requestAnimationFrame(() => {
			const el = textareaRef.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		});
	}

	// "/" focuses the composer from anywhere outside a text field (desktop parity with chat apps).
	useEffect(() => {
		function onKey(ev: unknown): void {
			const e = ev as KeyboardEvent;
			if (e.key !== "/" || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
			if ((e.target as { tagName?: string } | null)?.tagName !== "BODY") return;
			if (browserDocument.querySelector('[role="dialog"]') !== null) return;
			e.preventDefault();
			refocusComposer();
		}
		browserWindow.addEventListener("keydown", onKey);
		return () => browserWindow.removeEventListener("keydown", onKey);
	}, []);

	// No command list is offered while focused (only viewer-scoped commands run), so Esc must not be left waiting on it.
	const showSlash = !focusedAgentId && !slashDismissed && text.startsWith("/") && !text.includes(" ");
	const slashMatches = showSlash ? matchingCommands(text, commands) : [];
	const activeSlash = Math.min(slashIndex, Math.max(0, slashMatches.length - 1));

	const pendingCaretRef = useRef<number | null>(null);
	const applyFileCompletion = useCallback((nextText: string, caret: number) => {
		pendingCaretRef.current = caret;
		setText(nextText);
		navRef.current.onEdit(nextText);
	}, []);
	useLayoutEffect(() => {
		const caret = pendingCaretRef.current;
		const el = textareaRef.current;
		if (caret === null || !el) return;
		pendingCaretRef.current = null;
		el.focus();
		el.setSelectionRange(caret, caret);
	}, [text]);
	const files = useFileCompletion(complete, !focusedAgentId && !showSlash && finePointer(), applyFileCompletion);

	function applyHistoryText(nextText: string): void {
		setText(nextText);
		setSlashDismissed(false);
		const el = textareaRef.current;
		if (el) {
			el.value = nextText;
			autoGrow(el);
			const len = nextText.length;
			el.setSelectionRange(len, len);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
		if (files.onKeyDown(e)) return;
		const el = e.currentTarget;
		const slash = slashKeyAction(
			{
				key: e.key,
				shiftKey: e.shiftKey,
				altKey: e.altKey,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
				isComposing: e.nativeEvent.isComposing,
				caretAtEnd: el.selectionStart === el.selectionEnd && el.selectionEnd === el.value.length,
			},
			activeSlash,
			slashMatches.length,
		);
		if (slash) {
			e.preventDefault();
			if (slash.type === "move") setSlashIndex(slash.index);
			else if (slash.type === "accept") handleSlashSelect(slashMatches[activeSlash].name);
			else handleSlashDismiss();
			return;
		}
		if (busy && e.key === "Escape" && !showSlash && !e.nativeEvent.isComposing) {
			e.preventDefault();
			onAbort();
			if (finePointer()) refocusComposer();
			return;
		}
		if (focusedAgentId && e.key === "Escape" && !showSlash && !e.nativeEvent.isComposing) {
			e.preventDefault();
			if (escapeAction(text, images.length) === "clear") {
				setText("");
				setImages([]);
				navRef.current.reset();
			} else {
				onExitFocus?.();
			}
			return;
		}
		if (
			isClearDraftKey(
				{
					code: e.code,
					ctrlKey: e.ctrlKey,
					altKey: e.altKey,
					metaKey: e.metaKey,
					shiftKey: e.shiftKey,
					isComposing: e.nativeEvent.isComposing,
				},
				MAC,
			)
		) {
			e.preventDefault();
			if (text.length > 0 || images.length > 0) {
				setText("");
				setImages([]);
				navRef.current.reset();
			}
			return;
		}
		const navDir = historyNavDirection({
			key: e.key,
			altKey: e.altKey,
			ctrlKey: e.ctrlKey,
			metaKey: e.metaKey,
			shiftKey: e.shiftKey,
			isComposing: e.nativeEvent.isComposing,
			slashOpen: showSlash,
			text,
			selectionStart: e.currentTarget.selectionStart,
			selectionEnd: e.currentTarget.selectionEnd,
		});

		if (navDir === "up") {
			e.preventDefault();
			applyHistoryText(navRef.current.stepUp(text));
			return;
		}
		if (navDir === "down") {
			e.preventDefault();
			applyHistoryText(navRef.current.stepDown());
			return;
		}

		if (
			enterSubmitsFn(
				{
					key: e.key,
					shiftKey: e.shiftKey,
					isComposing: e.nativeEvent.isComposing,
				},
				enterSubmits,
			)
		) {
			e.preventDefault();
			handleSend();
		}
	}

	function autoGrow(el: HTMLTextAreaElement): void {
		el.style.height = "auto";
		const lineHeight = 22;
		const maxHeight = lineHeight * MAX_ROWS;
		el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
		el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
	}

	useEffect(() => {
		if (textareaRef.current) autoGrow(textareaRef.current);
	}, [text]);

	function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
		const val = e.target.value;
		setText(val);
		navRef.current.onEdit(val);
		setSlashDismissed(false);
		setSlashIndex(0);
		files.onTextChange(val, e.target.selectionStart);
	}

	function handleSlashSelect(name: string): void {
		setText("/" + name + " ");
		setSlashDismissed(false);
		textareaRef.current?.focus();
	}

	function handleSlashDismiss(): void {
		setSlashDismissed(true);
		textareaRef.current?.focus();
	}

	// Image handling
	function readFiles(files: FileList | File[]): void {
		for (const file of files) {
			if (!file.type.startsWith("image/")) continue;
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === "string") {
					setImages(prev => [...prev, reader.result as string]);
				}
			};
			reader.readAsDataURL(file);
		}
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
		if (e.target.files) readFiles(e.target.files);
		e.target.value = "";
	}

	function handlePaste(e: React.ClipboardEvent): void {
		const items = e.clipboardData?.items;
		if (!items) return;
		const imageFiles: File[] = [];
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				if (file) imageFiles.push(file);
			}
		}
		if (imageFiles.length > 0) {
			e.preventDefault();
			readFiles(imageFiles);
		}
	}

	function removeImage(idx: number): void {
		setImages(prev => prev.filter((_, i) => i !== idx));
	}

	const effectiveMode = compacting ? "followUp" : busyMode;
	const queueing = busy && effectiveMode === "followUp";

	return (
		<div className={"cmp-composer" + (focusedAgentId ? " cmp-composer--focused" : "")}>
			{files.open && <FileAutocomplete items={files.items} index={files.index} onAccept={files.accept} />}
			{showSlash && <SlashAutocomplete matches={slashMatches} index={activeSlash} onSelect={handleSlashSelect} />}
			{images.length > 0 && (
				<div className="cmp-images">
					{images.map((src, i) => (
						<div key={i} className="cmp-image-chip">
							<img src={src} alt="" className="cmp-image-thumb" />
							<button
								type="button"
								className="cmp-image-remove"
								onMouseDown={keepTextareaFocus}
								onClick={() => removeImage(i)}
								aria-label="Remove image"
							>
								&times;
							</button>
						</div>
					))}
				</div>
			)}
			<div className="cmp-input-row">
				{busy && (
					<button
						type="button"
						className="cmp-round cmp-stop"
						onMouseDown={keepTextareaFocus}
						onClick={onAbort}
						aria-label="Stop"
						title="Stop"
					>
						<Square size={14} />
					</button>
				)}
				<div className="cmp-field">
					{busy && (
						<button
							type="button"
							className={
								"cmp-mode " +
								(queueing ? "cmp-mode--queue" : "cmp-mode--steer") +
								(compacting ? " cmp-mode--lock" : "") +
								(text.length > 0 ? " cmp-mode--compact" : "")
							}
							onMouseDown={keepTextareaFocus}
							onClick={() => setBusyMode(m => (m === "steer" ? "followUp" : "steer"))}
							disabled={compacting}
							aria-label={`Send mode: ${queueing ? "Queue" : "Steer"}`}
							title={compacting ? "Compacting: messages queue" : "Toggle steer / queue"}
						>
							{queueing ? <List size={14} /> : <Zap size={14} />}
							{text.length === 0 && (queueing ? "Queue" : "Steer")}
						</button>
					)}
					<textarea
						ref={textareaRef}
						className="cmp-textarea"
						value={text}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						onPaste={handlePaste}
						onSelect={e => files.onCaretMove(e.currentTarget.value, e.currentTarget.selectionStart)}
						onBlur={files.close}
						placeholder={
							focusedAgentId
								? `Message ${focusedAgentId}... (Esc returns to Main)`
								: busy
									? queueing
										? "Queue a follow-up..."
										: "Steer the agent..."
									: "Message the agent..."
						}
						rows={1}
						enterKeyHint={enterSubmits ? "send" : "enter"}
					/>
					<button
						type="button"
						className="cmp-attach"
						onMouseDown={keepTextareaFocus}
						onClick={() => fileRef.current?.click()}
						disabled={focusedAgentId !== undefined}
						aria-label="Attach image"
					>
						<Paperclip size={18} />
					</button>
				</div>
				<input
					ref={fileRef}
					type="file"
					accept="image/*"
					multiple
					className="cmp-file-input"
					onChange={handleFileChange}
					tabIndex={-1}
				/>
				<button
					type="button"
					className={"cmp-round cmp-btn-primary" + (queueing ? " cmp-send--queue" : "")}
					onMouseDown={keepTextareaFocus}
					onClick={handleSend}
					disabled={!canSend}
					aria-label={busy ? (queueing ? "Queue" : "Steer") : "Send"}
					title={busy ? (queueing ? "Queue" : "Steer") : "Send"}
				>
					<ArrowUp size={18} />
				</button>
			</div>
		</div>
	);
});
