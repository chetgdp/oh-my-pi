import * as path from "node:path";
import { byteLength } from "./sizes";
import { DayLog, readDayFiles } from "./store";

/** Bounds the `<items>` block: at most ~9 KB after the view on every turn. */
export const MAX_OPEN_ITEMS = 30;
export const ITEM_BYTES = 300;

export type OmemItemOp = "add" | "edit" | "close" | "reopen";

/** One line of `items/YYYY-MM-DD.jsonl`; `i` orders the ops, `at` is the chat's message count then. */
interface ItemRecord {
	i: number;
	op: OmemItemOp;
	id: number;
	text: string;
	at: number;
	date: string;
}

export interface OmemItem {
	id: number;
	text: string;
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
				this.#items.set(rec.id, { id: rec.id, text: rec.text, openedAt: rec.at });
				this.#nextId = Math.max(this.#nextId, rec.id + 1);
				break;
			case "edit":
				if (item) item.text = rec.text;
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
		}
	}

	#write(op: OmemItemOp, id: number, text: string, at: number): void {
		const rec: ItemRecord = { i: this.#ops, op, id, text, at, date: new Date().toISOString() };
		this.#log.append(rec);
		this.#apply(rec);
	}

	open(): OmemItem[] {
		return [...this.#items.values()].filter(item => item.closedAt === undefined);
	}

	get(id: number): OmemItem | undefined {
		return this.#items.get(id);
	}

	/** Applies one op; returns an error message, or undefined on success. */
	change(op: OmemItemOp, args: { id?: number; text?: string }, at: number): string | undefined {
		const text = args.text?.replace(/\s+/g, " ").trim() ?? "";
		if ((op === "add" || op === "edit") && !text) return `${op} needs text`;
		if (op === "close" && !text) return "close needs text: why the item is done, with evidence";
		if ((op === "add" || op === "edit") && byteLength(text) > ITEM_BYTES) {
			return `text is ${byteLength(text)} bytes; an item holds at most ${ITEM_BYTES}`;
		}
		if (op === "add") {
			if (this.open().length >= MAX_OPEN_ITEMS) {
				return `${MAX_OPEN_ITEMS} items are open; close or merge some first`;
			}
			this.#write("add", this.#nextId, text, at);
			return undefined;
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
		this.#write(op, item.id, text, at);
		return undefined;
	}

	render(): string {
		const lines = this.open().map(item => `#${item.id} (from message ${item.openedAt}) ${item.text}\n`);
		return `<items>\n${lines.join("")}</items>`;
	}

	close(): void {
		this.#log.close();
	}
}
