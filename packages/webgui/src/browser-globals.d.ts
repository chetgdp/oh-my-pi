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

	// ---- Window -----------------------------------------------------------

	interface BrowserWindow {
		open(url?: string, target?: string, features?: string): unknown;
	}

	var window: BrowserWindow;
}

export {};
