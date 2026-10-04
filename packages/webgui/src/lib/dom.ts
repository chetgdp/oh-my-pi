/**
 * Typed accessor for browser globals.
 *
 * webgui type-checks WITHOUT the DOM lib because the coding-agent RPC type
 * graph (which this package imports) is only valid against bun-types.
 * All browser API usage goes through the narrow interfaces below.
 */

export interface BrowserAnchorElement {
	href: string;
	download: string;
	click(): void;
}

export interface BrowserDocument {
	getElementById(id: string): Element | null;
	createElement(tagName: "a"): BrowserAnchorElement;
	createElement(tagName: string): Element;
	activeElement: (Element & { tagName?: string }) | null;
	body: Element & {
		appendChild(node: unknown): void;
		removeChild(node: unknown): void;
	};
	addEventListener(type: string, listener: () => void): void;
	removeEventListener(type: string, listener: () => void): void;
	readonly visibilityState: "visible" | "hidden";
	documentElement: {
		dataset: Record<string, string | undefined>;
		style: {
			setProperty(property: string, value: string): void;
			removeProperty(property: string): void;
		};
	};
	fonts: {
		add(face: BrowserFontFace): void;
	};
}

export interface BrowserNavigator {
	/** iOS Safari only: true when running as a home-screen web app. */
	standalone?: boolean;
	clipboard?: {
		writeText(text: string): Promise<void>;
	};
}

export interface BrowserFontFace {
	readonly status: string;
}

export interface BrowserFontFaceConstructor {
	new (
		family: string,
		source: string,
		descriptors?: { weight?: string; style?: string; display?: string },
	): BrowserFontFace;
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
	addEventListener(type: string, listener: (e: unknown) => void): void;
	removeEventListener(type: string, listener: (e: unknown) => void): void;
	visualViewport: {
		height: number;
		offsetTop: number;
		addEventListener(type: string, listener: () => void): void;
		removeEventListener(type: string, listener: () => void): void;
	} | null;
	requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
	cancelIdleCallback?: (handle: number) => void;
	FontFace: BrowserFontFaceConstructor;
}

export const browserWindow = globalThis as unknown as BrowserWindow;
export const browserDocument = browserWindow.document;

/** Download a Blob as a file using an anchor element. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = browserDocument.createElement("a");
	a.href = url;
	a.download = filename;
	browserDocument.body.appendChild(a);
	a.click();
	browserDocument.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
