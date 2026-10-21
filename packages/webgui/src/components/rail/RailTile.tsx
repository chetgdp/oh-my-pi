import type { ReactNode } from "react";
import "./rail.css";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** First grapheme of `name`, upper-cased; "?" when blank. */
export function railGlyph(name: string): string {
	const first = graphemes.segment(name.trim())[Symbol.iterator]().next().value;
	return first ? first.segment.toUpperCase() : "?";
}

/**
 * One square of a collapsed column rail (left sessions, right subagents):
 * first grapheme of `name`, a status dot (`dot` picks its color via
 * `data-dot`), and an optional corner badge for "needs you".
 */
export function RailTile(props: {
	name: string;
	/** Full accessible label and hover title; defaults to `name`. */
	label?: string;
	current?: boolean;
	/** Dot color key: "on" (ok), "running", "idle", "parked", "aborted", or "off" (faint). */
	dot: string;
	badge?: boolean;
	dataId?: string;
	onClick(): void;
}): ReactNode {
	const { name, label = name, current, dot, badge, dataId, onClick } = props;
	return (
		<button
			type="button"
			className={current ? "rail-item rail-item--current" : "rail-item"}
			onClick={onClick}
			title={label}
			aria-label={label}
			aria-current={current ? "page" : undefined}
			data-id={dataId}
			data-dot={dot}
		>
			{railGlyph(name)}
			<span className="rail-dot" aria-hidden="true" />
			{badge && <span className="rail-badge" aria-hidden="true" />}
		</button>
	);
}
