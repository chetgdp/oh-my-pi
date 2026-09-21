// Bounded ring buffer with monotonic sequence numbers.

export interface SequencedItem<T> {
	seq: number;
	item: T;
}

export class SequencedRingBuffer<T> {
	readonly #capacity: number;
	readonly #items: Array<SequencedItem<T> | undefined>;
	#seq = 0;

	constructor(capacity = 5_000) {
		this.#capacity = capacity;
		this.#items = Array.from({ length: capacity });
	}

	push(item: T): number {
		const seq = ++this.#seq;
		this.#items[seq % this.#capacity] = { seq, item };
		return seq;
	}

	currentSeq(): number {
		return this.#seq;
	}

	/** Returns null when lastSeq has been evicted. */
	getAfter(lastSeq: number): Array<SequencedItem<T>> | null {
		if (lastSeq < 0) return null;
		if (lastSeq >= this.#seq) return [];

		const oldest = this.#oldestSeq();
		if (lastSeq < oldest - 1) return null;

		const result: Array<SequencedItem<T>> = [];
		for (let s = lastSeq + 1; s <= this.#seq; s++) {
			const entry = this.#items[s % this.#capacity];
			if (!entry || entry.seq !== s) return null;
			result.push(entry);
		}
		return result;
	}

	#oldestSeq(): number {
		if (this.#seq <= this.#capacity) return 1;
		return this.#seq - this.#capacity + 1;
	}
}
