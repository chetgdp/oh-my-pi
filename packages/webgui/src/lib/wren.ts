import { browserDocument, browserWindow } from "./dom";

export const WREN_BASE_URL = "https://pq9.time-phrygian.ts.net:8765";

const STORAGE_KEY_CHANNEL = "webgui.wrenChannel";
const STORAGE_PREFIX_VOICE = "webgui.voice.";

interface GestureTarget {
	addEventListener(type: string, listener: () => void, options: { capture: boolean }): void;
	removeEventListener(type: string, listener: () => void, options: { capture: boolean }): void;
}

interface PrefStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const GESTURE_EVENTS = ["pointerdown", "keydown"] as const;
const CAPTURE = { capture: true };

// Read lazily: tests and SSR install globals after module load.
function gestureTarget(): GestureTarget | null {
	const holder: Record<string, unknown> = globalThis;
	const doc = holder.document;
	if (doc && typeof doc === "object" && "addEventListener" in doc && typeof doc.addEventListener === "function") {
		return doc as GestureTarget;
	}
	return null;
}

function prefStorage(): PrefStorage | null {
	const holder: Record<string, unknown> = globalThis;
	const ls = holder.localStorage;
	if (ls && typeof ls === "object" && "getItem" in ls && "setItem" in ls) return ls as PrefStorage;
	return null;
}

export function readVoicePref(sessionKey: string): boolean {
	try {
		return prefStorage()?.getItem(STORAGE_PREFIX_VOICE + sessionKey) === "1";
	} catch {
		return false;
	}
}

function writeVoicePref(sessionKey: string, on: boolean): void {
	try {
		prefStorage()?.setItem(STORAGE_PREFIX_VOICE + sessionKey, on ? "1" : "0");
	} catch {
		// Private mode or quota: the preference just won't persist.
	}
}

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
	speaking: boolean;
	error: string | null;
	/** Saved pref is on but playback waits for a user gesture (iOS AudioContext unlock). */
	armed: boolean;
	/** Id of the control that requested the current speech; null for agent-initiated speech. */
	owner: string | null;
	/** Speak requested, no audio scheduled yet (synthesis takes seconds). */
	pending: boolean;
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
	setEnabled(enabled: boolean): void;
	getSessionKey(): string | null;
	hasGestureListener(): boolean;
	setPendingTimeoutMs(ms: number): void;
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
	#speaking = false;
	#error: string | null = null;
	#owner: string | null = null;
	#pending = false;
	#pendingTimer: Timer | null = null;
	#pendingTimeoutMs = 30_000;
	#requestTail: Promise<unknown> = Promise.resolve();
	#stopsInFlight = 0;

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
	#armed = false;
	#sessionKey: string | null = null;
	// Set once an AudioContext reached "running"; later resumes need no gesture.
	#unlocked = false;
	#gestureHandler: (() => void) | null = null;

	#listeners = new Set<() => void>();
	#visibilityAttached = false;
	#cachedState: WrenVoiceState = {
		enabled: false,
		speaking: false,
		error: null,
		armed: false,
		owner: null,
		pending: false,
	};

	// Voice starts off until setSession(): a saved "on" only arms, because iOS
	// unlocks audio inside a tap and polling without playback would steal active.
	constructor() {
		this.#channel = getOrCreateChannelId();
		this.#updateSnapshot();
	}

	/** Returns true when the snapshot changed; keeps the same object otherwise. */
	#updateSnapshot(): boolean {
		const prev = this.#cachedState;
		if (
			prev.enabled === this.#enabled &&
			prev.speaking === this.#speaking &&
			prev.error === this.#error &&
			prev.armed === this.#armed &&
			prev.owner === this.#owner &&
			prev.pending === this.#pending
		) {
			return false;
		}
		this.#cachedState = {
			enabled: this.#enabled,
			speaking: this.#speaking,
			error: this.#error,
			armed: this.#armed,
			owner: this.#owner,
			pending: this.#pending,
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

	#clearPendingTimer(): void {
		if (this.#pendingTimer) {
			clearTimeout(this.#pendingTimer);
			this.#pendingTimer = null;
		}
	}

	/** Caller notifies. */
	#clearOwner(): void {
		this.#clearPendingTimer();
		this.#owner = null;
		this.#pending = false;
	}

	getState(): WrenVoiceState {
		return this.#cachedState;
	}

	get channel(): string {
		return this.#channel;
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

	setSession(key: string | null): void {
		if (key === this.#sessionKey) return;
		this.#sessionKey = key;
		if (key === null || !readVoicePref(key)) {
			this.disable();
			return;
		}
		if (this.#enabled) return;
		if (this.#unlocked || this.#ctx?.state === "running") {
			void this.enable();
			return;
		}
		this.#arm();
	}

	/** Flips voice for the current session and persists the choice. */
	toggle(): void {
		const on = !(this.#enabled || this.#armed);
		if (this.#sessionKey !== null) writeVoicePref(this.#sessionKey, on);
		if (on) void this.enable();
		else this.disable();
	}

	#arm(): void {
		this.#armed = true;
		const target = gestureTarget();
		if (target && !this.#gestureHandler) {
			const handler = (): void => {
				this.#removeGestureListener();
				void this.enable();
			};
			this.#gestureHandler = handler;
			for (const type of GESTURE_EVENTS) target.addEventListener(type, handler, CAPTURE);
		}
		this.#notify();
	}

	#removeGestureListener(): void {
		const handler = this.#gestureHandler;
		if (!handler) return;
		this.#gestureHandler = null;
		const target = gestureTarget();
		if (target) for (const type of GESTURE_EVENTS) target.removeEventListener(type, handler, CAPTURE);
	}

	async enable(): Promise<void> {
		this.#removeGestureListener();
		this.#armed = false;
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
		if (this.#ctx?.state === "running") this.#unlocked = true;

		if (!this.#running) {
			this.#running = true;
			void this.#loop(++this.#loopGen);
		}

		this.#notify();
	}

	disable(): void {
		this.#removeGestureListener();
		this.#armed = false;
		this.#enabled = false;
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
		this.#clearOwner();

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

	async speakText(text: string, owner: string): Promise<void> {
		this.#clearPendingTimer();
		this.#owner = owner;
		this.#pending = true;
		// Synthesis can fail silently server-side; never leave a stop button stuck.
		const timer = setTimeout(() => {
			if (this.#pendingTimer !== timer) return;
			this.#pendingTimer = null;
			this.#clearOwner();
			this.#notify();
		}, this.#pendingTimeoutMs);
		this.#pendingTimer = timer;
		this.#notify();

		const url = `${WREN_BASE_URL}/speak`;
		// Queued before any await so a stop tapped right after still lands behind this speak.
		const request = this.#inOrder(async () => {
			if (!this.#enabled) await this.enable();
			return fetch(url, {
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
		});
		let res: Response;
		try {
			res = await request;
		} catch (err) {
			if (this.#owner === owner) this.#clearOwner();
			this.#error = err instanceof Error ? err.message : String(err);
			this.#notify();
			throw err;
		}

		if (!res.ok) {
			const body: unknown = await res.json().catch(() => null);
			const msg = extractErrorMessage(body, `Speak failed with HTTP ${res.status}`);
			if (this.#owner === owner) this.#clearOwner();
			this.#error = msg;
			this.#notify();
			throw new Error(msg);
		}
	}

	async stopSpeaking(): Promise<void> {
		this.flush();
		const url = `${WREN_BASE_URL}/stop`;
		this.#stopsInFlight++;
		let res: Response;
		try {
			res = await this.#inOrder(() =>
				fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						channel: this.#channel,
					}),
				}),
			);
		} finally {
			this.#stopsInFlight--;
		}

		if (!res.ok) {
			const body: unknown = await res.json().catch(() => null);
			const msg = extractErrorMessage(body, `Stop failed with HTTP ${res.status}`);
			this.#error = msg;
			this.#notify();
			throw new Error(msg);
		}
	}

	// Rapid taps fire speak and stop together; if /stop overtook an earlier /speak, that speech
	// would play after the local stop cleared its owner and surface as unowned agent speech.
	#inOrder(send: () => Promise<Response>): Promise<Response> {
		const next = this.#requestTail.then(send, send);
		this.#requestTail = next.catch(() => undefined);
		return next;
	}

	flush(): void {
		this.#flushAudio();
		this.#clearOwner();
		this.#notify();
	}

	// A pending speak's own append:false bumps the epoch, so that flush must keep its owner.
	#flushForEpoch(): void {
		this.#flushAudio();
		if (!this.#pending) this.#clearOwner();
		this.#notify();
	}

	#flushAudio(): void {
		const now = this.#ctx?.currentTime ?? 0;
		for (const s of this.#scheduled) {
			if (!s.stopped) {
				this.#stopEntry(s, now);
			}
		}
		this.#scheduled = [];
		this.#nextTime = 0;
		this.#speaking = false;
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
		if (this.#pending) {
			this.#clearPendingTimer();
			this.#pending = false;
		}
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
			if (!this.#speaking && !this.#pending) this.#owner = null;
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
						this.#flushForEpoch();
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
					this.#flushForEpoch();
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

				// Audio of speech already stopped locally can land before its queued /stop reaches the server.
				if (this.#ctx && this.#stopsInFlight === 0) {
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
					this.#flushForEpoch();
					this.#lastSeq = -1;
					this.#playedSeq = -1;
				}
				this.#lastEpoch = newEpoch;
			},
			setEnabled: (enabled: boolean) => {
				this.#enabled = enabled;
			},
			getSessionKey: () => this.#sessionKey,
			hasGestureListener: () => this.#gestureHandler !== null,
			setPendingTimeoutMs: (ms: number) => {
				this.#pendingTimeoutMs = ms;
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

/** This tab's playback channel id; the host routes the session's `wren` speech here while voice is enabled. */
export function getWrenChannel(): string {
	return getController().channel;
}

export async function enableVoice(): Promise<void> {
	await getController().enable();
}

export function disableVoice(): void {
	getController().disable();
}

export function setVoiceSession(key: string | null): void {
	getController().setSession(key);
}

export function toggleVoice(): void {
	getController().toggle();
}

export async function speakText(text: string, owner: string): Promise<void> {
	await getController().speakText(text, owner);
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
