/** First automatic retry after a failed load; doubles per failure. */
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;
/** Automatic retries per failure streak; after that only the next `request()` tries again. */
const RETRY_LIMIT = 6;

/**
 * A code-split module loaded on first use. A failed load is never cached:
 * a dynamic `import()` rejection (offline, or a chunk missing from the
 * server) clears the pending promise, retries with backoff, and any later
 * `request()` tries again. Listeners fire once the module is available.
 */
export class LazyModule<T> {
	#importer: () => Promise<T>;
	#value: T | null = null;
	#pending: Promise<T> | null = null;
	#failures = 0;
	#retryQueued = false;
	#listeners = new Set<() => void>();

	constructor(importer: () => Promise<T>) {
		this.#importer = importer;
	}

	/** The loaded module, or null until a load succeeds. */
	get value(): T | null {
		return this.#value;
	}

	load(): Promise<T> {
		if (this.#value !== null) return Promise.resolve(this.#value);
		this.#pending ??= this.#importer().then(
			mod => {
				this.#value = mod;
				this.#pending = null;
				this.#failures = 0;
				for (const fn of this.#listeners) fn();
				return mod;
			},
			(err: unknown) => {
				this.#pending = null;
				this.#scheduleRetry();
				throw err;
			},
		);
		return this.#pending;
	}

	/** Start loading without awaiting; failures are retried, not reported. */
	request(): void {
		if (this.#value !== null) return;
		this.load().catch(() => {});
	}

	subscribe = (fn: () => void): (() => void) => {
		this.#listeners.add(fn);
		return () => {
			this.#listeners.delete(fn);
		};
	};

	snapshot = (): T | null => this.#value;

	#scheduleRetry(): void {
		if (this.#retryQueued || this.#failures >= RETRY_LIMIT) return;
		const delay = Math.min(RETRY_BASE_MS * 2 ** this.#failures, RETRY_MAX_MS);
		this.#failures++;
		this.#retryQueued = true;
		// A retry that fires after a manual load succeeded is a no-op in request().
		setTimeout(() => {
			this.#retryQueued = false;
			this.request();
		}, delay);
	}
}
