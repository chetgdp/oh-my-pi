import * as path from "node:path";
import { byteLength, headBytes } from "./sizes";
import { DayLog, readDayFiles } from "./store";

/** Bounds the `<items>` block: titles only, at most ~16 KB after the view on every turn. */
export const MAX_OPEN_ITEMS = 128;
export const TITLE_BYTES = 96;
export const ITEM_BYTES = 4096;

export type OmemItemOp = "add" | "edit" | "close" | "reopen" | "prioritize";

/** Items without a priority rank as this tier, so logs written before priorities replay unchanged. */
const DEFAULT_PRIORITY = 2;

function rank(item: OmemItem): number {
	return item.priority ?? DEFAULT_PRIORITY;
}

/** The default tier stays unmarked: an unprioritized list renders byte-identical to before. */
function mark(item: OmemItem): string {
	return rank(item) === DEFAULT_PRIORITY ? "" : `P${rank(item)} `;
}

/** One line of `items/YYYY-MM-DD.jsonl`; `i` orders the ops, `at` is the chat's message count then. */
interface ItemRecord {
	i: number;
	op: OmemItemOp;
	id: number;
	/** Absent in records written before items had titles, and in close/reopen. */
	title?: string;
	text: string;
	/** 1 (highest) to 3; only in add, edit and prioritize records that set it. */
	priority?: number;
	at: number;
	date: string;
}

export interface OmemItem {
	id: number;
	/** Absent until an add or edit sets one; `render` then shows the head of `text`. */
	title?: string;
	text: string;
	priority?: number;
	openedAt: number;
	closedAt?: number;
	why?: string;
}

/**
 * Open items kept outside the summary tree, so compaction cannot drop them.
 * Append-only op log, replayed at open; the agent edits it with the `items` tool.
 */
export class Items {
	readonly #log: DayLog;
	readonly #items = new Map<number, OmemItem>();
	#ops = 0;
	#nextId = 1;

	constructor(dir: string) {
		const itemsDir = path.join(dir, "items");
		const records = readDayFiles<ItemRecord>(itemsDir).sort((a, b) => a.i - b.i);
		for (const rec of records) this.#apply(rec);
		this.#log = new DayLog(itemsDir);
	}

	#apply(rec: ItemRecord): void {
		this.#ops = Math.max(this.#ops, rec.i + 1);
		const item = this.#items.get(rec.id);
		switch (rec.op) {
			case "add":
				this.#items.set(rec.id, {
					id: rec.id,
					title: rec.title,
					text: rec.text,
					priority: rec.priority,
					openedAt: rec.at,
				});
				this.#nextId = Math.max(this.#nextId, rec.id + 1);
				break;
			case "edit":
				if (item) {
					item.text = rec.text;
					if (rec.title !== undefined) item.title = rec.title;
					if (rec.priority !== undefined) item.priority = rec.priority;
				}
				break;
			case "close":
				if (item) {
					item.closedAt = rec.at;
					item.why = rec.text;
				}
				break;
			case "reopen":
				if (item) {
					item.closedAt = undefined;
					item.why = undefined;
				}
				break;
			case "prioritize":
				if (item) item.priority = rec.priority;
				break;
		}
	}

	#write(op: OmemItemOp, id: number, text: string, at: number, title?: string, priority?: number): void {
		const rec: ItemRecord = { i: this.#ops, op, id, title, text, priority, at, date: new Date().toISOString() };
		this.#log.append(rec);
		this.#apply(rec);
	}

	/** Open items, highest priority first, then by id. */
	open(): OmemItem[] {
		return [...this.#items.values()]
			.filter(item => item.closedAt === undefined)
			.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
	}

	get(id: number): OmemItem | undefined {
		return this.#items.get(id);
	}

	/**
	 * Full items, open or closed (newest close first); `id` picks one, `query` matches
	 * title, text or close reason, case-insensitive.
	 */
	list(state: "open" | "closed", id?: number, query?: string): string {
		const closed = state === "closed";
		const q = query?.trim().toLowerCase();
		const found = [...this.#items.values()]
			.filter(item => (item.closedAt !== undefined) === closed)
			.filter(item => id === undefined || item.id === id)
			.filter(item => !q || `${item.title ?? ""} ${item.text} ${item.why ?? ""}`.toLowerCase().includes(q));
		if (id !== undefined && found.length === 0) return `Error: no ${state} item #${id}`;
		if (closed) found.sort((a, b) => b.closedAt! - a.closedAt! || b.id - a.id);
		else found.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
		const lines = found.map(item => {
			const body = item.title && item.text ? `${item.title} | ${item.text}` : item.title || item.text;
			return closed
				? `#${item.id} (from message ${item.openedAt}, closed at ${item.closedAt}) ${body} | why: ${item.why}\n`
				: `${mark(item)}#${item.id} (from message ${item.openedAt}) ${body}\n`;
		});
		return `<${state}>\n${lines.join("")}</${state}>`;
	}

	/** Applies one op; returns the changed item's id, or an error message. */
	change(
		op: OmemItemOp,
		args: { id?: number; title?: string; text?: string; priority?: number },
		at: number,
	): number | string {
		const text = args.text?.replace(/\s+/g, " ").trim() ?? "";
		const title = args.title?.replace(/\s+/g, " ").trim() ?? "";
		const priority = op === "add" || op === "edit" || op === "prioritize" ? args.priority : undefined;
		if (op === "add" && !title) return "add needs a title";
		if (op === "edit" && !title && !text) return "edit needs a title or text";
		if (op === "close" && !text) return "close needs text: why the item is done, with evidence";
		if (op === "prioritize" && priority === undefined) return "prioritize needs a priority: 1, 2 or 3";
		if (priority !== undefined && priority !== 1 && priority !== 2 && priority !== 3) {
			return `priority is ${priority}; it is 1 (highest), 2 or 3`;
		}
		if (op === "add" || op === "edit") {
			if (byteLength(title) > TITLE_BYTES) {
				return `title is ${byteLength(title)} bytes; a title holds at most ${TITLE_BYTES}`;
			}
			if (byteLength(text) > ITEM_BYTES) {
				return `text is ${byteLength(text)} bytes; an item holds at most ${ITEM_BYTES}`;
			}
		}
		if (op === "add") {
			if (this.open().length >= MAX_OPEN_ITEMS) {
				return `${MAX_OPEN_ITEMS} items are open; close or merge some first`;
			}
			const id = this.#nextId;
			this.#write("add", id, text, at, title, priority);
			return id;
		}
		const item = args.id === undefined ? undefined : this.#items.get(args.id);
		if (!item) return `no item #${args.id ?? "?"}`;
		const isOpen = item.closedAt === undefined;
		if (op === "reopen") {
			if (isOpen) return `item #${item.id} is already open`;
			if (this.open().length >= MAX_OPEN_ITEMS) return `${MAX_OPEN_ITEMS} items are open; close some first`;
		} else if (!isOpen) {
			return `item #${item.id} is closed; reopen it first`;
		}
		if (op === "edit") this.#write("edit", item.id, text || item.text, at, title || item.title, priority);
		else if (op === "prioritize") this.#write("prioritize", item.id, "", at, undefined, priority);
		else this.#write(op, item.id, text, at);
		return item.id;
	}

	/** The index shown after the view: titles only, highest priority first; `list` gives the text. */
	render(): string {
		const lines = this.open().map(
			item =>
				`${mark(item)}#${item.id} (from message ${item.openedAt}) ${item.title ?? headBytes(item.text, TITLE_BYTES)}\n`,
		);
		return `<items>\n${lines.join("")}</items>`;
	}

	close(): void {
		this.#log.close();
	}
}
