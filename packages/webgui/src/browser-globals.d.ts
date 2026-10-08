/**
 * Ambient DOM surface for collab-web modules that run in a real browser but are
 * type-checked here WITHOUT the DOM lib (webgui deliberately excludes `lib: DOM`
 * because the coding-agent RPC type graph is only valid against bun-types).
 *
 * This file augments the empty `@types/react` global stubs (`HTMLElement`,
 * `HTMLDivElement`, `KeyboardEvent`, ...) with exactly the members the upstream
 * collab-web files use.  Keep it minimal -- add members only when a real
 * compile error demands it.
 *
 * `document` is NOT declared here -- it conflicts with the coding-agent stub in
 * `tab-worker.ts`; use `src/lib/dom.ts` instead.
 */

declare global {
	// ---- Elements ----------------------------------------------------------

	interface HTMLElement {
		/** @see collab-web Transcript.tsx ScrollGeometry */
		scrollTop: number;
		readonly scrollHeight: number;
		readonly clientHeight: number;

		/** @see collab-web tool-render/element.tsx */
		getAttribute(name: string): string | null;
		hasAttribute(name: string): boolean;
		readonly isConnected: boolean;
		scrollIntoView(arg?: boolean | { block?: string; inline?: string; behavior?: string }): void;
		scrollTo(options: { top?: number; left?: number; behavior?: string }): void;
		contains(other: unknown): boolean;
		/** @see webgui Markdown.tsx diagram tap */
		closest(selector: string): HTMLElement | null;
		readonly innerHTML: string;
		focus(): void;
		addEventListener(
			type: string,
			listener: (event: unknown) => void,
			options?: { passive?: boolean; capture?: boolean; once?: boolean },
		): void;
		removeEventListener(
			type: string,
			listener: (event: unknown) => void,
			options?: { passive?: boolean; capture?: boolean; once?: boolean },
		): void;
	}
	// HTMLDivElement extends HTMLElement; the stub is already declared by
	// @types/react as `interface HTMLDivElement extends HTMLElement {}`.
	// The members above flow through.

	/** Constructor value so `class Foo extends HTMLElement` works. */
	var HTMLElement: {
		prototype: HTMLElement;
		new (): HTMLElement;
	};

	// ---- Events -----------------------------------------------------------

	interface KeyboardEvent {
		/** True while an IME composition is in progress. */
		readonly isComposing: boolean;
		readonly key: string;
		readonly shiftKey: boolean;
		readonly altKey: boolean;
		readonly metaKey: boolean;
		readonly ctrlKey: boolean;
	}

	// ---- Custom elements --------------------------------------------------

	interface CustomElementRegistry {
		get(name: string): CustomElementConstructor | undefined;
		define(name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions): void;
	}

	interface ElementDefinitionOptions {
		extends?: string;
	}

	type CustomElementConstructor = new (...args: unknown[]) => HTMLElement;

	var customElements: CustomElementRegistry;

	// ---- File API ---------------------------------------------------------

	interface FileList {
		readonly length: number;
		item(index: number): File | null;
		[index: number]: File;
		[Symbol.iterator](): IterableIterator<File>;
	}

	interface FileReader {
		readAsDataURL(blob: Blob | File): void;
		readonly result: string | ArrayBuffer | null;
		onload: ((this: FileReader, ev: ProgressEvent) => void) | null;
		onerror: ((this: FileReader, ev: ProgressEvent) => void) | null;
	}

	var FileReader: {
		prototype: FileReader;
		new (): FileReader;
	};

	interface HTMLInputElement extends HTMLElement {
		files: FileList | null;
	}

	interface HTMLTextAreaElement extends HTMLElement {
		selectionStart: number;
		selectionEnd: number;
		setSelectionRange(start: number, end: number, direction?: "forward" | "backward" | "none"): void;
	}

	// ---- Drag & Drop ------------------------------------------------------

	interface DataTransferItem {
		readonly kind: string;
		readonly type: string;
		getAsFile(): File | null;
	}

	interface DataTransferItemList {
		readonly length: number;
		[index: number]: DataTransferItem;
	}

	interface DataTransfer {
		items: DataTransferItemList;
	}

	// ---- Animation --------------------------------------------------------

	function requestAnimationFrame(callback: (time: number) => void): number;
	function cancelAnimationFrame(id: number): void;

	// ---- Window -----------------------------------------------------------

	interface BrowserWindow {
		open(url?: string, target?: string, features?: string): unknown;
	}

	var window: BrowserWindow;
}

declare module "@oh-my-pi/pi-utils/dom" {
	interface CSSStyleDeclaration {
		height: string;
		overflowY: string;
	}
}
export {};
