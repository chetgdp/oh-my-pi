import { enterSubmits as enterSubmitsFn } from "./useComposerKeyboard";

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
import type { ReactNode } from "react";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";
import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { useComposerKeyboard } from "./useComposerKeyboard";
import { SlashAutocomplete } from "./SlashAutocomplete";
import type { ComposerDraft } from "../../lib/session-actions";
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
	onSend(text: string, mode: "prompt" | "steer" | "followUp", images?: readonly string[]): void;
	onAbort(): void;
	onSetModel(provider: string, modelId: string): void;
	onSetThinkingLevel(level: ThinkingLevel): void;
	restoredDraft?: ComposerDraft | null;
	onDraftRestored?(): void;
	onDraftChange?(draft: ComposerDraft): void;
}

/** Max textarea rows before scrolling */
const MAX_ROWS = 8;

export function Composer({
	busy,
	commands,
	onSend,
	onAbort,
	restoredDraft,
	onDraftRestored,
	onDraftChange,
}: ComposerProps): ReactNode {
	const [text, setText] = useState("");
	const [busyMode, setBusyMode] = useState<"steer" | "followUp">("steer");
	const [images, setImages] = useState<string[]>([]);
	const [slashDismissed, setSlashDismissed] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const { enterSubmits } = useComposerKeyboard();

	const trimmed = text.trim();
	const canSend = trimmed.length > 0 || images.length > 0;

	const handleSend = useCallback(() => {
		if (!canSend) return;
		const mode = resolveSendMode(busy, busyMode);
		onSend(trimmed, mode, images.length > 0 ? images : undefined);
		setText("");
		setImages([]);
	}, [canSend, busy, busyMode, trimmed, images, onSend]);

	useEffect(() => {
		onDraftChange?.({ text, images });
	}, [text, images, onDraftChange]);

	useEffect(() => {
		if (!restoredDraft) return;
		setText(restoredDraft.text);
		setImages(restoredDraft.images ? [...restoredDraft.images] : []);
		onDraftRestored?.();
	}, [restoredDraft, onDraftRestored]);

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
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
		setText(e.target.value);
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

	const showSlash = !slashDismissed && text.startsWith("/") && !text.includes(" ");

	return (
		<div className="cmp-composer">
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
				<textarea
					ref={textareaRef}
					className="cmp-textarea"
					value={text}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					placeholder={busy ? "Steer or follow up..." : "Message the agent..."}
					rows={1}
					enterKeyHint={enterSubmits ? "send" : "enter"}
				/>
				<button
					type="button"
					className="cmp-attach"
					onClick={() => fileRef.current?.click()}
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
