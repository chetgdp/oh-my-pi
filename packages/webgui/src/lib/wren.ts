import { browserDocument, browserWindow } from "./dom";

export const WREN_BASE_URL = "https://pq9.time-phrygian.ts.net:8765";

const STORAGE_KEY_CHANNEL = "webgui.wrenChannel";

export interface BrowserAudioBufferSourceNode {
	buffer: BrowserAudioBuffer | null;
	connect(destination: BrowserAudioNode): void;
	start(when?: number, offset?: number): void;
	stop(when?: number): void;
	onended: (() => void) | null;
}

export interface BrowserGainNode {
	gain: {
		value: number;
		setValueAtTime(value: number, startTime: number): void;
		linearRampToValueAtTime(value: number, endTime: number): void;
	};
	connect(destination: BrowserAudioNode): void;
}

export type BrowserAudioNode = BrowserGainNode | BrowserAudioDestinationNode;

export interface BrowserAudioDestinationNode {}

export interface BrowserAudioBuffer {
	readonly duration: number;
	readonly numberOfChannels: number;
	readonly sampleRate: number;
}

export interface BrowserAudioContext {
	readonly state: "suspended" | "running" | "closed";
	readonly currentTime: number;
	readonly destination: BrowserAudioDestinationNode;
	resume(): Promise<void>;
	suspend(): Promise<void>;
	close(): Promise<void>;
	createGain(): BrowserGainNode;
	createBufferSource(): BrowserAudioBufferSourceNode;
	decodeAudioData(audioData: ArrayBuffer): Promise<BrowserAudioBuffer>;
}

export interface BrowserAudioContextConstructor {
	new (): BrowserAudioContext;
}

export interface WrenVoiceState {
	enabled: boolean;
	active: boolean;
	speaking: boolean;
	error: string | null;
}

export interface WrenTestHooks {
	setChannel(ch: string): void;
	getChannel(): string;
	getLastSeq(): number;
	getLastEpoch(): number;
	getPlayedSeq(): number;
	getScheduled(): readonly ScheduledEntry[];
	setAudioContext(ctx: BrowserAudioContext | null): void;
	triggerLoop(): Promise<void>;
	handleEpochChange(newEpoch: number): void;
	setActive(active: boolean): void;
	setEnabled(enabled: boolean): void;
}

interface ScheduledEntry {
	source: BrowserAudioBufferSourceNode;
	gain: BrowserGainNode;
	block: number[] | null;
	seq: number;
	start: number;
	end: number;
	stopped: boolean;
}

function delay(ms: number): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, ms);
	return promise;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
	if (payload && typeof payload === "object" && "error" in payload) {
		const err = payload.error;
		if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
			return err.message;
		}
	}
	return fallback;
}

export function generateChannelId(): string {
	const rand = Math.random().toString(36).slice(2, 10);
	return `webgui-${rand}`.slice(0, 32);
}

export function getOrCreateChannelId(): string {
	if (typeof globalThis.localStorage === "undefined") {
		return generateChannelId();
	}
	try {
		const raw = browserWindow.localStorage.getItem(STORAGE_KEY_CHANNEL);
		const existing = raw && /^[a-z0-9_-]{1,32}$/.test(raw.trim().toLowerCase()) ? raw.trim().toLowerCase() : null;
		if (existing) return existing;
		const generated = generateChannelId();
		browserWindow.localStorage.setItem(STORAGE_KEY_CHANNEL, generated);
		return generated;
	} catch {
		return generateChannelId();
	}
}

class WrenController {
	#enabled = false;
	#active = false;
	#speaking = false;
	#error: string | null = null;

	#ctx: BrowserAudioContext | null = null;
	#running = false;
	#pollAbort: AbortController | null = null;
	#loopGen = 0;
	#lastSeq = -1;
	#lastEpoch = -1;
	#playedSeq = -1;
	#nextTime = 0;
	#scheduled: ScheduledEntry[] = [];
	#reportTimer: Timer | null = null;
	#channel = "";
	#claimCheckAt = 0;
	#claimCheckInFlight = false;

	#listeners = new Set<() => void>();
	#visibilityAttached = false;
	#cachedState: WrenVoiceState = {
		enabled: false,
		active: false,
		speaking: false,
		error: null,
	};

	// Voice starts off on every load: iOS only unlocks audio inside a tap, so a
	// restored "on" would claim the channel and poll with no way to play.
	constructor() {
		this.#channel = getOrCreateChannelId();
		this.#updateSnapshot();
	}

	/** Returns true when the snapshot changed; keeps the same object otherwise. */
	#updateSnapshot(): boolean {
		const prev = this.#cachedState;
		if (
			prev.enabled === this.#enabled &&
			prev.active === this.#active &&
			prev.speaking === this.#speaking &&
			prev.error === this.#error
		) {
			return false;
		}
		this.#cachedState = {
			enabled: this.#enabled,
			active: this.#active,
			speaking: this.#speaking,
			error: this.#error,
		};
		return true;
	}

	#notify(): void {
		if (!this.#updateSnapshot()) return;
		for (const listener of this.#listeners) {
			try {
				listener();
			} catch {
				// ignore listener errors
			}
		}
	}

	getState(): WrenVoiceState {
		return this.#cachedState;
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	#attachVisibility(): void {
		if (this.#visibilityAttached || typeof browserDocument === "undefined") return;
		this.#visibilityAttached = true;
		browserDocument.addEventListener("visibilitychange", () => {
			if (browserDocument.visibilityState === "visible" && this.#enabled) {
				void this.#handleVisibilityResume();
			}
		});
	}

	async #handleVisibilityResume(): Promise<void> {
		if (!this.#enabled) return;
		try {
			if (this.#ctx && this.#ctx.state !== "running" && this.#ctx.state !== "closed") {
				await this.#ctx.resume();
			}
		} catch {
			// ignore resume error
		}
		if (!this.#running) {
			this.#running = true;
			void this.#loop(++this.#loopGen);
		}
	}

	async enable(): Promise<void> {
		this.#enabled = true;
		this.#attachVisibility();
		this.#error = null;

		// iOS gives Web Audio the "ambient" session, which the silent switch mutes.
		const nav: unknown = globalThis.navigator;
		if (nav && typeof nav === "object" && "audioSession" in nav) {
			const session = nav.audioSession;
			if (session && typeof session === "object" && "type" in session) session.type = "playback";
		}
		const holder: Record<string, unknown> = globalThis;
		const ctor = holder.AudioContext;
		if (!this.#ctx && typeof ctor === "function") {
			const AudioContextCtor = ctor as unknown as BrowserAudioContextConstructor;
			this.#ctx = new AudioContextCtor();
		}
		// iOS reports "interrupted" after calls or lock; only "running" plays.
		if (this.#ctx && this.#ctx.state !== "running") {
			try {
				await this.#ctx.resume();
			} catch (err) {
				this.#error = err instanceof Error ? err.message : String(err);
			}
		}

		if (!this.#running) {
			this.#running = true;
			void this.#loop(++this.#loopGen);
		}

		this.#notify();

		// Claim active channel
		await this.claimActive();
	}

	disable(): void {
		this.#enabled = false;
		this.#active = false;
		this.#running = false;
		this.#error = null;

		if (this.#pollAbort) {
			this.#pollAbort.abort();
			this.#pollAbort = null;
		}

		this.flush();

		if (this.#reportTimer) {
			clearInterval(this.#reportTimer);
			this.#reportTimer = null;
		}

		this.#speaking = false;

		if (this.#ctx) {
			try {
				if (this.#ctx.state !== "closed") {
					void this.#ctx.suspend();
				}
			} catch {
				// ignore suspend error
			}
		}

		this.#notify();
	}

	// Shown in Wren's /state, the only place a phone's audio state is readable without a debugger.
	#label(): string {
		const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
		const device = /iPhone|iPad|Android|Macintosh|Windows|Linux/.exec(ua)?.[0] ?? "browser";
		return `webgui ${device} audio:${this.#ctx?.state ?? "none"}`;
	}

	async claimActive(): Promise<void> {
		const url = `${WREN_BASE_URL}/clients/active`;
		try {
			const res = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					channel: this.#channel,
					label: this.#label(),
				}),
			});

			if (!res.ok) {
				const body: unknown = await res.json().catch(() => null);
				this.#error = extractErrorMessage(body, `Claim failed with HTTP ${res.status}`);
				this.#active = false;
				this.#notify();
				return;
			}

			this.#active = true;
			this.#error = null;
			this.#notify();
		} catch (err) {
			this.#error = err instanceof Error ? err.message : String(err);
			this.#active = false;
			this.#notify();
		}
	}

	// Other clients (Wren.app on the Mac) take active without telling us, so a
	// cached flag goes stale; ask the server, throttled to one check per burst of input.
	claimOnInput(): Promise<void> {
		if (!this.#enabled || this.#claimCheckInFlight) return Promise.resolve();
		const now = Date.now();
		if (now - this.#claimCheckAt < 2000) return Promise.resolve();
		this.#claimCheckAt = now;
		this.#claimCheckInFlight = true;
		return this.#claimIfNotActive().finally(() => {
			this.#claimCheckInFlight = false;
		});
	}

	async #claimIfNotActive(): Promise<void> {
		try {
			const res = await fetch(`${WREN_BASE_URL}/health`);
			const body: unknown = await res.json();
			const client = body && typeof body === "object" && "active_client" in body ? body.active_client : null;
			const active = client && typeof client === "object" && "channel" in client ? client.channel : null;
			if (active === this.#channel) {
				if (!this.#active) {
					this.#active = true;
					this.#notify();
				}
				return;
			}
		} catch {
			// Health unreachable: fall through and let the claim surface the error.
		}
		await this.claimActive();
	}

	async speakText(text: string): Promise<void> {
		if (!this.#enabled) {
			await this.enable();
		}

		const url = `${WREN_BASE_URL}/speak`;
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				text,
				channel: this.#channel,
				append: false,
			}),
		});

		if (!res.ok) {
			const body: unknown = await res.json().catch(() => null);
			const msg = extractErrorMessage(body, `Speak failed with HTTP ${res.status}`);
			this.#error = msg;
			this.#notify();
			throw new Error(msg);
		}
	}

	async stopSpeaking(): Promise<void> {
		const url = `${WREN_BASE_URL}/stop`;
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				channel: this.#channel,
			}),
		});

		this.flush();

		if (!res.ok) {
			const body: unknown = await res.json().catch(() => null);
			const msg = extractErrorMessage(body, `Stop failed with HTTP ${res.status}`);
			this.#error = msg;
			this.#notify();
			throw new Error(msg);
		}
	}

	flush(): void {
		const now = this.#ctx?.currentTime ?? 0;
		for (const s of this.#scheduled) {
			if (!s.stopped) {
				this.#stopEntry(s, now);
			}
		}
		this.#scheduled = [];
		this.#nextTime = 0;
		if (this.#speaking) {
			this.#speaking = false;
			this.#notify();
		}
	}

	#stopEntry(s: ScheduledEntry, when: number): void {
		const t = when || (this.#ctx?.currentTime ?? 0);
		try {
			s.gain.gain.setValueAtTime(s.gain.gain.value, t);
			s.gain.gain.linearRampToValueAtTime(0, t + 0.005);
			s.source.stop(t + 0.005);
		} catch {
			// ignore node already stopped or closed
		}
		s.stopped = true;
	}

	#makeSource(
		buf: BrowserAudioBuffer,
		when: number,
		offset: number,
	): { source: BrowserAudioBufferSourceNode; gain: BrowserGainNode } {
		if (!this.#ctx) throw new Error("AudioContext missing");
		const gain = this.#ctx.createGain();
		gain.connect(this.#ctx.destination);
		const src = this.#ctx.createBufferSource();
		src.buffer = buf;
		src.connect(gain);
		src.start(when, offset);
		return { source: src, gain };
	}

	#schedule(buf: BrowserAudioBuffer, block: number[] | null, seq: number): ScheduledEntry {
		if (!this.#ctx) throw new Error("AudioContext missing");
		const now = this.#ctx.currentTime;
		const when = Math.max(now, this.#nextTime);
		const { source, gain } = this.#makeSource(buf, when, 0);
		const dur = buf.duration;
		const entry: ScheduledEntry = {
			source,
			gain,
			block,
			seq,
			start: when,
			end: when + dur,
			stopped: false,
		};
		source.onended = () => {
			entry.stopped = true;
		};
		this.#scheduled.push(entry);
		this.#nextTime = entry.end;
		this.#ensureReport();
		return entry;
	}

	#ensureReport(): void {
		if (this.#reportTimer) return;
		this.#reportTimer = setInterval(() => this.#report(), 250);
		this.#report();
	}

	#report(): void {
		const now = this.#ctx?.currentTime ?? 0;

		for (const s of this.#scheduled) {
			if (s.end <= now && s.seq > this.#playedSeq) {
				this.#playedSeq = s.seq;
			}
		}

		this.#scheduled = this.#scheduled.filter(s => !s.stopped && s.end > now);
		const wasSpeaking = this.#speaking;
		this.#speaking = this.#scheduled.length > 0;

		if (this.#speaking !== wasSpeaking) {
			this.#notify();
		}

		if (this.#scheduled.length === 0) {
			if (this.#reportTimer) {
				clearInterval(this.#reportTimer);
				this.#reportTimer = null;
			}
		}
	}

	/** Runs until disabled or superseded: disable()+enable() bumps `gen`, retiring a loop parked in an aborted fetch. */
	async #loop(gen: number): Promise<void> {
		const live = (): boolean => this.#running && gen === this.#loopGen;
		while (live()) {
			const ac = new AbortController();
			this.#pollAbort = ac;
			const url = `${WREN_BASE_URL}/segment?channel=${encodeURIComponent(this.#channel)}&after=${this.#lastSeq}&played=${this.#playedSeq}&timeout=20`;
			try {
				const res = await fetch(url, { signal: ac.signal });

				if (!live()) break;

				const epochHeader = res.headers.get("X-Epoch");
				const seqHeader = res.headers.get("X-Seq");
				const epoch = epochHeader != null ? parseInt(epochHeader, 10) : -1;
				const seq = seqHeader != null ? parseInt(seqHeader, 10) : -1;

				if (res.status === 204) {
					if (epoch >= 0 && this.#lastEpoch >= 0 && epoch !== this.#lastEpoch) {
						this.flush();
						this.#lastEpoch = epoch;
						this.#lastSeq = -1;
						this.#playedSeq = -1;
					} else if (epoch >= 0 && this.#lastEpoch < 0) {
						this.#lastEpoch = epoch;
					}
					if (this.#error) {
						this.#error = null;
						this.#notify();
					}
					continue;
				}

				if (!res.ok) {
					const body: unknown = await res.json().catch(() => null);
					const msg = extractErrorMessage(body, `Segment poll returned HTTP ${res.status}`);
					this.#error = msg;
					this.#notify();

					// Backoff before retrying
					const delayMs = res.status === 401 ? 5000 : res.status === 503 ? 2000 : 1000;
					await delay(delayMs);
					continue;
				}

				// res.ok
				if (this.#error) {
					this.#error = null;
					this.#notify();
				}

				const blockHeader = res.headers.get("X-Block");
				const blocks = blockHeader
					? blockHeader
							.split(",")
							.map(Number)
							.filter(n => !Number.isNaN(n))
					: [];
				const block = blocks.length > 0 ? blocks : null;

				if (this.#lastEpoch >= 0 && epoch !== this.#lastEpoch) {
					this.flush();
					this.#lastSeq = -1;
					this.#playedSeq = -1;
				}
				if (epoch >= 0) {
					this.#lastEpoch = epoch;
				}
				if (seq >= 0) {
					this.#lastSeq = seq;
				}

				const data = await res.arrayBuffer();
				if (!live()) break;

				if (this.#ctx) {
					const raw = await this.#ctx.decodeAudioData(data);
					this.#schedule(raw, block, seq);
				}
			} catch (err: unknown) {
				const errorName = err instanceof Error ? err.name : "";
				if (errorName === "AbortError") {
					continue;
				}
				if (!live()) break;

				this.#error = err instanceof Error ? err.message : String(err);
				this.#notify();
				await delay(1000);
			}
		}
		// A superseded loop must not clear the current loop's controller.
		if (gen === this.#loopGen) this.#pollAbort = null;
	}

	// Exposed for tests
	_testHooks(): WrenTestHooks {
		return {
			setChannel: (ch: string) => {
				this.#channel = ch;
			},
			getChannel: () => this.#channel,
			getLastSeq: () => this.#lastSeq,
			getLastEpoch: () => this.#lastEpoch,
			getPlayedSeq: () => this.#playedSeq,
			getScheduled: () => this.#scheduled,
			setAudioContext: (ctx: BrowserAudioContext | null) => {
				this.#ctx = ctx;
			},
			triggerLoop: () => this.#loop(++this.#loopGen),
			handleEpochChange: (newEpoch: number) => {
				if (this.#lastEpoch >= 0 && newEpoch !== this.#lastEpoch) {
					this.flush();
					this.#lastSeq = -1;
					this.#playedSeq = -1;
				}
				this.#lastEpoch = newEpoch;
			},
			setActive: (active: boolean) => {
				this.#active = active;
				this.#updateSnapshot();
			},
			setEnabled: (enabled: boolean) => {
				this.#enabled = enabled;
			},
		};
	}
}

let instance: WrenController | null = null;
function getController(): WrenController {
	if (!instance) {
		instance = new WrenController();
	}
	return instance;
}

export function getWrenState(): WrenVoiceState {
	return getController().getState();
}

export function subscribeWren(listener: () => void): () => void {
	return getController().subscribe(listener);
}

export async function enableVoice(): Promise<void> {
	await getController().enable();
}

export function disableVoice(): void {
	getController().disable();
}

export function claimOnInput(): Promise<void> {
	return getController().claimOnInput();
}

export async function speakText(text: string): Promise<void> {
	await getController().speakText(text);
}

export async function stopSpeaking(): Promise<void> {
	await getController().stopSpeaking();
}

// For unit testing only
export function _resetWrenForTesting(): WrenTestHooks {
	if (instance) {
		instance.disable();
		instance = null;
	}
	return getController()._testHooks();
}
