import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CompletionItem, CompletionResult } from "../../server/complete";
import { browserWindow } from "../../lib/dom";

export type CompleteFn = (
	text: string,
	cursor: number,
	force: boolean,
	signal: AbortSignal,
) => Promise<CompletionResult | null>;

const DEBOUNCE_MS = 100;
const AT_TOKEN_RE = /(?:^|\s)@[^\s]*$/;
const DIRECTORY_RE = /[\\/]["']?$/;

/** Pure: the text and caret after accepting `item` for a list produced at `cursor`. */
export function applyCompletion(
	text: string,
	cursor: number,
	prefix: string,
	item: CompletionItem,
): { text: string; cursor: number; directory: boolean } {
	const before = text.slice(0, cursor - prefix.length);
	const directory = DIRECTORY_RE.test(item.value);
	const suffix = directory ? "" : " ";
	return {
		text: before + item.value + suffix + text.slice(cursor),
		cursor: before.length + item.value.length + suffix.length,
		directory,
	};
}

/** Fine pointer only: touch keyboards have no Tab and the popup would cover the transcript. */
export function finePointer(): boolean {
	if (typeof browserWindow.matchMedia !== "function") return false;
	return browserWindow.matchMedia("(pointer: fine)")?.matches ?? false;
}

interface OpenList {
	items: readonly CompletionItem[];
	prefix: string;
	/** Caret offset the list was computed for. */
	cursor: number;
	force: boolean;
}

export interface FileCompletionKeyEvent {
	key: string;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	nativeEvent: { isComposing: boolean };
	currentTarget: { value: string; selectionStart: number; selectionEnd: number };
	preventDefault(): void;
	stopPropagation(): void;
}

export interface FileCompletion {
	open: boolean;
	items: readonly CompletionItem[];
	index: number;
	/** Call after every text edit with the new value and caret. */
	onTextChange(text: string, cursor: number): void;
	/** Call on caret moves; closes when the caret leaves the completed token. */
	onCaretMove(text: string, cursor: number): void;
	/** Returns true when the key was consumed. */
	onKeyDown(e: FileCompletionKeyEvent): boolean;
	accept(i: number): void;
	close(): void;
}

/**
 * TUI-style file completion state. `apply` writes accepted text into the composer
 * and must place the caret at `cursor` once the textarea shows `text`.
 */
export function useFileCompletion(
	complete: CompleteFn | undefined,
	enabled: boolean,
	apply: (text: string, cursor: number) => void,
): FileCompletion {
	const [list, setList] = useState<OpenList | null>(null);
	const [index, setIndex] = useState(0);
	const listRef = useRef<OpenList | null>(null);
	listRef.current = list;
	const timerRef = useRef<Timer | undefined>(undefined);
	const ctrlRef = useRef<AbortController | null>(null);
	const textRef = useRef("");
	const active = enabled && complete !== undefined;

	const cancel = useCallback(() => {
		clearTimeout(timerRef.current);
		ctrlRef.current?.abort();
		ctrlRef.current = null;
	}, []);

	const close = useCallback(() => {
		cancel();
		setList(null);
	}, [cancel]);

	useEffect(() => {
		if (!active) close();
	}, [active, close]);
	useEffect(() => cancel, [cancel]);

	const request = useCallback(
		(text: string, cursor: number, force: boolean, delay: number) => {
			if (!complete) return;
			cancel();
			const run = (): void => {
				const ctrl = new AbortController();
				ctrlRef.current = ctrl;
				complete(text, cursor, force, ctrl.signal).then(
					result => {
						if (ctrl.signal.aborted) return;
						ctrlRef.current = null;
						if (!result || result.items.length === 0) {
							setList(null);
							return;
						}
						setIndex(0);
						setList({ items: result.items, prefix: result.prefix, cursor, force });
					},
					() => {
						if (ctrl.signal.aborted) return;
						ctrlRef.current = null;
						setList(null);
					},
				);
			};
			if (delay > 0) timerRef.current = setTimeout(run, delay);
			else run();
		},
		[complete, cancel],
	);

	const onTextChange = useCallback(
		(text: string, cursor: number) => {
			textRef.current = text;
			if (!active) return;
			const current = listRef.current;
			if (current || AT_TOKEN_RE.test(text.slice(0, cursor))) {
				request(text, cursor, current?.force ?? false, DEBOUNCE_MS);
			} else {
				close();
			}
		},
		[active, request, close],
	);

	const onCaretMove = useCallback(
		(text: string, cursor: number) => {
			const current = listRef.current;
			if (!current) return;
			const anchor = current.cursor - current.prefix.length;
			if (cursor < anchor || /\s/.test(text.slice(anchor, cursor))) close();
		},
		[close],
	);

	const accept = useCallback(
		(i: number) => {
			const current = listRef.current;
			const item = current?.items[i];
			if (!current || !item) return;
			const next = applyCompletion(textRef.current, current.cursor, current.prefix, item);
			textRef.current = next.text;
			setList(null);
			cancel();
			apply(next.text, next.cursor);
			if (next.directory) request(next.text, next.cursor, current.force, 0);
		},
		[apply, cancel, request],
	);

	const onKeyDown = useCallback(
		(e: FileCompletionKeyEvent): boolean => {
			if (!active || e.nativeEvent.isComposing) return false;
			textRef.current = e.currentTarget.value;
			const current = listRef.current;
			if (current) {
				const n = current.items.length;
				switch (e.key) {
					case "ArrowDown":
						e.preventDefault();
						setIndex(i => (i + 1) % n);
						return true;
					case "ArrowUp":
						e.preventDefault();
						setIndex(i => (i - 1 + n) % n);
						return true;
					case "Enter":
					case "Tab":
						if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
						e.preventDefault();
						accept(index);
						return true;
					case "Escape":
						e.preventDefault();
						e.stopPropagation();
						close();
						return true;
					default:
						return false;
				}
			}
			if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
				const { value, selectionStart, selectionEnd } = e.currentTarget;
				if (selectionStart !== selectionEnd) return false;
				e.preventDefault();
				request(value, selectionStart, true, 0);
				return true;
			}
			return false;
		},
		[active, accept, close, index, request],
	);

	return {
		open: list !== null,
		items: list?.items ?? [],
		index,
		onTextChange,
		onCaretMove,
		onKeyDown,
		accept,
		close,
	};
}

export function FileAutocomplete({
	items,
	index,
	onAccept,
}: {
	items: readonly CompletionItem[];
	index: number;
	onAccept(i: number): void;
}): ReactNode {
	return (
		<div className="cmp-slash cmp-files" role="listbox" aria-label="File completions">
			{items.map((item, i) => (
				<button
					key={item.value}
					type="button"
					role="option"
					className={"cmp-slash-item" + (i === index ? " cmp-slash-active" : "")}
					aria-selected={i === index}
					onMouseDown={e => e.preventDefault()}
					onClick={() => onAccept(i)}
				>
					<span className="cmp-slash-name">{item.label}</span>
					{item.description && <span className="cmp-slash-desc">{item.description}</span>}
				</button>
			))}
		</div>
	);
}
