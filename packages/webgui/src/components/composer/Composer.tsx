import { enterSubmits as enterSubmitsFn, historyNavDirection } from "./useComposerKeyboard";
import { ChevronUp, ChevronDown } from "lucide-react";
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

import { useState, useRef, useCallback, useEffect } from "react";
import { escapeAction } from "../../lib/focus-model";
import type { ReactNode } from "react";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";
import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { useComposerKeyboard } from "./useComposerKeyboard";
import { SlashAutocomplete } from "./SlashAutocomplete";
import type { ComposerDraft } from "../../lib/session-actions";
import { onDraftsHydrated, readDraft, writeDraft } from "../../lib/drafts";
import "./composer.css";

export interface ComposerModel {
	id: string;
	name: string;
	provider: {
		id: string;
		name: string;
	};
}

export interface ComposerProps {
	busy: boolean;
	models: readonly ComposerModel[];
	currentModel?: ComposerModel;
	thinkingLevel?: ThinkingLevel;
	commands: readonly RpcAvailableSlashCommand[];
	promptHistory?: readonly string[];
	/** Return false to keep the draft (a refused submit); anything else clears it. */
	onSend(text: string, mode: "prompt" | "steer" | "followUp", images?: readonly string[]): boolean | void;
	onAbort(): void;
	onSetModel(provider: string, modelId: string): void;
	onSetThinkingLevel(level: ThinkingLevel): void;
	restoredDraft?: ComposerDraft | null;
	onDraftRestored?(): void;
	onDraftChange?(draft: ComposerDraft): void;
	/** Focused subagent id: the composer talks to that agent and Esc returns to Main. */
	focusedAgentId?: string;
	/** Composer text is kept per key, so leaving and returning restores it. */
	draftKey?: string;
	onExitFocus?(): void;
}

/** Max textarea rows before scrolling */
const MAX_ROWS = 8;

export function Composer({
	busy,
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
}: ComposerProps): ReactNode {
	const [text, setText] = useState(() => (draftKey ? readDraft(draftKey).text : ""));
	const [busyMode, setBusyMode] = useState<"steer" | "followUp">("steer");
	const [images, setImages] = useState<readonly string[]>(() => (draftKey ? readDraft(draftKey).images : []));
	const [slashDismissed, setSlashDismissed] = useState(false);
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
		const mode = resolveSendMode(busy, busyMode);
		const accepted = onSend(trimmed, mode, images.length > 0 ? images : undefined);
		if (accepted === false) return;
		setText("");
		setImages([]);
		navRef.current.reset();
	}, [canSend, busy, busyMode, trimmed, images, onSend, onAbort, focusedAgentId]);
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
	}, [restoredDraft, onDraftRestored]);

	// No command list is offered while focused (only viewer-scoped commands run), so Esc must not be left waiting on it.
	const showSlash = !focusedAgentId && !slashDismissed && text.startsWith("/") && !text.includes(" ");

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

	function handleHistoryUp(): void {
		const nextText = navRef.current.stepUp(text);
		applyHistoryText(nextText);
	}

	function handleHistoryDown(): void {
		const nextText = navRef.current.stepDown();
		applyHistoryText(nextText);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
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
			handleHistoryUp();
			return;
		}
		if (navDir === "down") {
			e.preventDefault();
			handleHistoryDown();
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

	// showSlash computed above for keyboard and rendering

	return (
		<div className={"cmp-composer" + (focusedAgentId ? " cmp-composer--focused" : "")}>
			{showSlash && (
				<SlashAutocomplete
					text={text}
					commands={commands}
					onSelect={handleSlashSelect}
					onDismiss={handleSlashDismiss}
				/>
			)}
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
				<div className="cmp-history-nav" role="group" aria-label="Prompt history">
					<button
						type="button"
						className="cmp-history-btn"
						onMouseDown={keepTextareaFocus}
						onClick={handleHistoryUp}
						aria-label="Previous prompt"
						title="Previous prompt"
					>
						<ChevronUp size={16} />
					</button>
					<button
						type="button"
						className="cmp-history-btn"
						onMouseDown={keepTextareaFocus}
						onClick={handleHistoryDown}
						aria-label="Next prompt"
						title="Next prompt"
					>
						<ChevronDown size={16} />
					</button>
				</div>
				<textarea
					ref={textareaRef}
					className="cmp-textarea"
					value={text}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					placeholder={
						focusedAgentId
							? `Message ${focusedAgentId}... (Esc returns to Main)`
							: busy
								? "Steer or follow up..."
								: "Message the agent..."
					}
					rows={1}
					enterKeyHint={enterSubmits ? "send" : "enter"}
				/>
				<button
					type="button"
					className="cmp-attach"
					onClick={() => fileRef.current?.click()}
					disabled={focusedAgentId !== undefined}
					aria-label="Attach image"
				>
					+
				</button>
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
					className="cmp-btn-primary"
					onMouseDown={keepTextareaFocus}
					onClick={handleSend}
					disabled={!canSend}
				>
					{busy ? (busyMode === "steer" ? "Steer" : "Queue") : "Send"}
				</button>
			</div>
			{busy && (
				<div className="cmp-actions">
					<div className="cmp-segmented" role="radiogroup" aria-label="Send mode">
						<button
							type="button"
							role="radio"
							aria-checked={busyMode === "steer"}
							className={"cmp-seg-btn" + (busyMode === "steer" ? " cmp-seg-active" : "")}
							onMouseDown={keepTextareaFocus}
							onClick={() => setBusyMode("steer")}
						>
							Steer
						</button>
						<button
							type="button"
							role="radio"
							aria-checked={busyMode === "followUp"}
							className={"cmp-seg-btn" + (busyMode === "followUp" ? " cmp-seg-active" : "")}
							onMouseDown={keepTextareaFocus}
							onClick={() => setBusyMode("followUp")}
						>
							Queue
						</button>
					</div>
					<button
						type="button"
						className="cmp-btn-primary cmp-btn-stop"
						onMouseDown={keepTextareaFocus}
						onClick={onAbort}
					>
						Stop
					</button>
				</div>
			)}
		</div>
	);
}
