// Copy of the word/hue rows in packages/coding-agent/src/modes/magic-keywords.ts.
// That module imports node-only code, so the browser cannot load it; see
// PLAN.md "Shared UX package" for the planned single source.
const MAGIC_WORDS: readonly { word: string; hue: readonly [number, number] }[] = [
	{ word: "ultrathink", hue: [0, 330] },
	{ word: "orchestrate", hue: [150, 280] },
	{ word: "workflowz", hue: [30, 150] },
	{ word: "jevify", hue: [300, 420] },
];

// Boundaries match the TUI's prose matcher so paths, flags, and calls do not glow.
const MAGIC_RE = new RegExp(
	`(?<![\\p{L}\\p{N}_./\\\\-])(?<!::)(${MAGIC_WORDS.map(w => w.word).join("|")})(?![\\p{L}\\p{N}_/\\\\-])(?!\\.[\\p{L}\\p{N}_-])(?!\\()`,
	"gu",
);

const STOPS = 14;

// The sweep runs from→to→from so a 200%-wide background loops without a seam.
function gradientFor([from, to]: readonly [number, number]): string {
	const stops: string[] = [];
	for (let i = 0; i <= STOPS * 2; i++) {
		const t = i <= STOPS ? i / STOPS : (STOPS * 2 - i) / STOPS;
		stops.push(`hsl(${(from + t * (to - from)) % 360} 90% 62%)`);
	}
	return `linear-gradient(90deg, ${stops.join(", ")})`;
}

const SPAN_BY_WORD: Record<string, string> = Object.fromEntries(
	MAGIC_WORDS.map(w => [
		w.word,
		`<span class="magic-word" style="background-image: ${gradientFor(w.hue)}">${w.word}</span>`,
	]),
);

const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)[^>]*>/g;
// Content inside these is not prose, matching the TUI's code/tag mask.
const SKIP_TAGS: Record<string, true> = { code: true, pre: true, a: true, script: true, style: true, math: true };

/** Wrap magic words found in prose text of rendered markdown HTML. */
export function highlightMagicWords(html: string): string {
	MAGIC_RE.lastIndex = 0;
	if (!MAGIC_RE.test(html)) return html;
	let out = "";
	let last = 0;
	let skipDepth = 0;
	const wrap = (text: string) => (skipDepth > 0 ? text : text.replace(MAGIC_RE, w => SPAN_BY_WORD[w] ?? w));
	for (const m of html.matchAll(TAG_RE)) {
		const start = m.index ?? 0;
		out += wrap(html.slice(last, start)) + m[0];
		last = start + m[0].length;
		if (SKIP_TAGS[m[2].toLowerCase()]) skipDepth += m[1] ? -1 : 1;
		if (skipDepth < 0) skipDepth = 0;
	}
	return out + wrap(html.slice(last));
}
