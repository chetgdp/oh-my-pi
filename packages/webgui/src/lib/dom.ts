/**
 * Typed accessor for browser globals.
 *
 * webgui type-checks WITHOUT the DOM lib because the coding-agent RPC type
 * graph (which this package imports) is only valid against bun-types.
 * All browser API usage goes through the narrow interfaces below.
 */

export interface BrowserDocument {
	getElementById(id: string): Element | null;
	activeElement: (Element & { tagName?: string }) | null;
	addEventListener(type: string, listener: () => void): void;
	removeEventListener(type: string, listener: () => void): void;
	documentElement: {
		dataset: Record<string, string | undefined>;
		style: {
			setProperty(property: string, value: string): void;
			removeProperty(property: string): void;
		};
	};
}

export interface BrowserNavigator {
	/** iOS Safari only: true when running as a home-screen web app. */
	standalone?: boolean;
}

export interface BrowserWindow {
	document: BrowserDocument;
	navigator: BrowserNavigator;
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
