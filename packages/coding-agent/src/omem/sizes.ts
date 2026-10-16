export const NODE_BYTES = 512;
export const VIEW_HIGH = 128_000;
export const VIEW_LOW = 64_000;
export const CVIEW_HIGH = 32_000;
export const CVIEW_LOW = 16_000;
export const JOBS = 8;
export const TRIES = 5;
/** Echo results are clipped to this many chars, head plus tail; other text is split at it. */
export const TEXT_CHARS = 30_000;

export function byteLength(text: string): number {
	return Buffer.byteLength(text, "utf8");
}

/** First `max` bytes of `text`, never ending inside a UTF-8 sequence. */
export function headBytes(text: string, max: number): string {
	const buf = Buffer.from(text, "utf8");
	if (buf.length <= max) return text;
	let end = max;
	while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
	return buf.subarray(0, end).toString("utf8");
}

function isHighSurrogate(code: number): boolean {
	return code >= 0xd800 && code <= 0xdbff;
}

/** Clip to head and tail of `max` chars in all, without splitting surrogate pairs. */
export function clipEcho(text: string, max = TEXT_CHARS): string {
	if (text.length <= max) return text;
	const marker = `\n[... ${text.length - max} chars clipped ...]\n`;
	let head = Math.floor(max / 2);
	if (isHighSurrogate(text.charCodeAt(head - 1))) head--;
	let tailStart = text.length - (max - head);
	if (isHighSurrogate(text.charCodeAt(tailStart - 1))) tailStart++;
	return text.slice(0, head) + marker + text.slice(tailStart);
}

/** Split into pieces of at most `max` chars, preferring newline then space boundaries. */
export function splitText(text: string, max = TEXT_CHARS): string[] {
	const pieces: string[] = [];
	let rest = text;
	while (rest.length > max) {
		let cut = rest.lastIndexOf("\n", max);
		if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
		if (cut < max / 2) cut = max;
		else cut += 1;
		if (isHighSurrogate(rest.charCodeAt(cut - 1))) cut--;
		pieces.push(rest.slice(0, cut));
		rest = rest.slice(cut);
	}
	pieces.push(rest);
	return pieces;
}
