import * as net from "node:net";

export type Frame = Record<string, unknown>;

export interface AuthLine {
	type: "auth";
	token: string;
	surface: "shell";
	clientId: string;
	attachment?: string;
}

export type OpenResult =
	| { ok: true; socket: HostSocket }
	| { ok: false; code: string; error: string; instanceId?: string };

/** Hard cap on one frame line; the host's v1 frame limit is 1 MiB, agent_end can approach it. */
const MAX_LINE_BYTES = 16 * 1024 * 1024;
const CONNECT_TIMEOUT_MS = 5_000;

/** One newline-delimited JSON connection to a host; frames are pulled with `next()`. */
export class HostSocket {
	readonly #socket: net.Socket;
	readonly #queue: Array<Frame | null> = [];
	#waiter: ((frame: Frame | null) => void) | null = null;
	#buffer = "";
	#closed = false;

	private constructor(socket: net.Socket) {
		this.#socket = socket;
		socket.setEncoding("utf8");
		socket.on("data", (chunk: string) => this.#onData(chunk));
		socket.on("error", () => this.#finish());
		socket.on("close", () => this.#finish());
	}

	/** Connects, authenticates, and waits for `ready`; host refusals come back as `ok: false`. */
	static async open(endpoint: string, auth: AuthLine): Promise<OpenResult> {
		const raw = net.connect(endpoint);
		const { promise, resolve } = Promise.withResolvers<string | null>();
		const timer = setTimeout(() => resolve("connect timed out"), CONNECT_TIMEOUT_MS);
		raw.once("connect", () => resolve(null));
		raw.once("error", error => resolve(error.message));
		const connected = await promise;
		clearTimeout(timer);
		if (connected !== null) {
			raw.destroy();
			return { ok: false, code: "unreachable", error: connected };
		}
		const socket = new HostSocket(raw);
		socket.send(auth);
		const first = await socket.next();
		if (first?.type === "ready") return { ok: true, socket };
		socket.close();
		if (first === null) return { ok: false, code: "unreachable", error: "host closed the connection" };
		return {
			ok: false,
			code: typeof first.code === "string" ? first.code : "error",
			error: typeof first.error === "string" ? first.error : JSON.stringify(first),
			...(typeof first.instanceId === "string" ? { instanceId: first.instanceId } : {}),
		};
	}

	send(frame: object): void {
		if (this.#closed) return;
		this.#socket.write(`${JSON.stringify(frame)}\n`);
	}

	/** Next frame, or null once the connection has closed and the queue is drained. */
	next(): Promise<Frame | null> {
		const queued = this.#queue.shift();
		if (queued !== undefined) return Promise.resolve(queued);
		if (this.#closed) return Promise.resolve(null);
		const { promise, resolve } = Promise.withResolvers<Frame | null>();
		this.#waiter = resolve;
		return promise;
	}

	close(): void {
		this.#socket.destroy();
		this.#finish();
	}

	#push(frame: Frame | null): void {
		const waiter = this.#waiter;
		if (waiter) {
			this.#waiter = null;
			waiter(frame);
		} else {
			this.#queue.push(frame);
		}
	}

	#onData(chunk: string): void {
		this.#buffer += chunk;
		let newline = this.#buffer.indexOf("\n");
		while (newline !== -1) {
			const line = this.#buffer.slice(0, newline);
			this.#buffer = this.#buffer.slice(newline + 1);
			newline = this.#buffer.indexOf("\n");
			if (line.trim().length === 0) continue;
			try {
				const parsed: unknown = JSON.parse(line);
				if (typeof parsed === "object" && parsed !== null) this.#push(parsed as Frame);
			} catch {
				// A malformed line is dropped; the host never sends one.
			}
		}
		if (this.#buffer.length > MAX_LINE_BYTES) {
			process.stderr.write("omp-shell: host frame exceeds size limit\n");
			this.close();
		}
	}

	#finish(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.#push(null);
	}
}
