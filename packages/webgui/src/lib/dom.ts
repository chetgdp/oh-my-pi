/**
 * Typed accessor for browser globals.
 *
 * webgui type-checks WITHOUT the DOM lib because the coding-agent RPC type
 * graph (which this package imports) is only valid against bun-types.
 * All browser API usage goes through the narrow interfaces below.
 */

export interface BrowserDocument {
	getElementById(id: string): Element | null;
}

export interface BrowserWindow {
	document: BrowserDocument;
	localStorage: {
		getItem(k: string): string | null;
		setItem(k: string, v: string): void;
		removeItem(k: string): void;
	};
	location: {
		origin: string;
		protocol: string;
		host: string;
		pathname: string;
		search: string;
		hash: string;
	};
	matchMedia(query: string): { matches: boolean };
	addEventListener(type: string, listener: () => void): void;
	removeEventListener(type: string, listener: () => void): void;
	visualViewport: {
		height: number;
		offsetTop: number;
		addEventListener(type: string, listener: () => void): void;
		removeEventListener(type: string, listener: () => void): void;
	} | null;
}

export const browserWindow = globalThis as unknown as BrowserWindow;
export const browserDocument = browserWindow.document;
