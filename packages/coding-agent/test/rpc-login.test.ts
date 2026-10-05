import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { OAuthProviderInterface } from "@oh-my-pi/pi-ai";
import { registerOAuthProvider, unregisterOAuthProvider } from "@oh-my-pi/pi-ai/oauth";
import { isRecord } from "@oh-my-pi/pi-utils";
import { buildLoginStatus, RpcLoginController } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-login";
import type { RpcOutput, RpcOutputFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-response";
import { RpcInputDispatcher } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-server";
import type {
	RpcServerCommand,
	RpcLoginEventFrame,
	RpcServerResponse,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import type { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { createInMemoryAuthStorage } from "./helpers/agent-session-setup";

class FrameCollector {
	readonly frames: RpcOutputFrame[] = [];
	readonly #waiters: Array<{ count: number; resolve: () => void }> = [];

	readonly output: RpcOutput = frame => {
		this.frames.push(frame);
		for (let i = this.#waiters.length - 1; i >= 0; i--) {
			const waiter = this.#waiters[i];
			if (this.frames.length >= waiter.count) {
				this.#waiters.splice(i, 1);
				waiter.resolve();
			}
		}
	};

	async waitFor(count: number, timeoutMs = 2000): Promise<void> {
		if (this.frames.length >= count) return;
		const { promise, resolve, reject } = Promise.withResolvers<void>();
		const timer = setTimeout(() => {
			const idx = this.#waiters.findIndex(w => w.resolve === resolve);
			if (idx !== -1) this.#waiters.splice(idx, 1);
			reject(new Error(`Timed out waiting for ${count} frames (got ${this.frames.length})`));
		}, timeoutMs);
		this.#waiters.push({
			count,
			resolve: () => {
				clearTimeout(timer);
				resolve();
			},
		});
		return promise;
	}
}

function isLoginEventFrame(frame: unknown): frame is RpcLoginEventFrame {
	return isRecord(frame) && frame.type === "login_event";
}

function asSuccessResponse<T extends Record<string, unknown> = Record<string, unknown>>(
	resp: RpcServerResponse,
): Extract<RpcServerResponse, { success: true }> & { data: T } {
	if (!resp.success) {
		throw new Error(`Expected success response, got: ${JSON.stringify(resp)}`);
	}
	return resp as Extract<RpcServerResponse, { success: true }> & { data: T };
}

describe("RPC OAuth Login and Logout (contract O)", () => {
	let authStorage: AuthStorage;
	const refreshedProviders: Array<{ provider: string; strategy: string }> = [];
	let session: AgentSession;
	let registeredProviderIds: string[] = [];

	beforeEach(() => {
		authStorage = createInMemoryAuthStorage();
		refreshedProviders.length = 0;
		registeredProviderIds = [];

		const modelRegistry = {
			authStorage,
			refreshProvider: async (provider: string, strategy: string) => {
				refreshedProviders.push({ provider, strategy });
			},
		};

		session = {
			sessionId: "test-session-123",
			modelRegistry,
		} as unknown as AgentSession;
	});

	afterEach(() => {
		for (const id of registeredProviderIds) {
			unregisterOAuthProvider(id);
		}
		authStorage.close();
	});

	function registerTestProvider(provider: OAuthProviderInterface): void {
		registerOAuthProvider(provider);
		registeredProviderIds.push(provider.id);
	}

	it("(a) start returns {loginId} before done; auth/progress/manual_input frames arrive in order; answering login_input completes flow", async () => {
		let storedFlag = false;
		registerTestProvider({
			id: "fake-oauth",
			name: "Fake OAuth",
			storeCredentialsAs: "fake-stored",
			async login(callbacks) {
				callbacks.onAuth({ url: "https://example.test/auth", instructions: "Open URL in browser" });
				callbacks.onProgress?.("waiting");
				if (callbacks.onManualCodeInput) {
					const input = await callbacks.onManualCodeInput(callbacks.signal);
					if (input.includes("code=")) {
						storedFlag = true;
						return {
							access: "fake-access-token",
							refresh: "fake-refresh-token",
							expires: Date.now() + 3600_000,
							email: "user@example.test",
							accountId: "acc-123",
						};
					}
					throw new Error("Invalid manual code input");
				}
				throw new Error("No onManualCodeInput handler provided");
			},
		});

		const collector = new FrameCollector();
		const controller = new RpcLoginController(session, collector.output);

		const startResponse = controller.start({ type: "login_start", providerId: "fake-oauth" }, "cmd-start");

		const startSuccess = asSuccessResponse<{ loginId: string }>(startResponse);
		const loginId = startSuccess.data.loginId;
		expect(loginId).toBeDefined();

		// Wait for initial auth, progress, manual_input frames
		await collector.waitFor(3);

		expect(collector.frames.length).toBe(3);

		// Frame 0: auth
		expect(collector.frames[0]).toEqual({
			type: "login_event",
			loginId,
			providerId: "fake-oauth",
			event: {
				kind: "auth",
				url: "https://example.test/auth",
				instructions: "Open URL in browser",
			},
		});

		// Frame 1: progress
		expect(collector.frames[1]).toEqual({
			type: "login_event",
			loginId,
			providerId: "fake-oauth",
			event: {
				kind: "progress",
				message: "waiting",
			},
		});

		// Frame 2: manual_input
		const frame2 = collector.frames[2];
		if (!isLoginEventFrame(frame2) || frame2.event.kind !== "manual_input") {
			throw new Error("Expected manual_input frame at index 2");
		}
		const requestId = frame2.event.requestId;
		expect(requestId).toBeDefined();

		// Answer login_input with redirect URL containing code
		const inputResponse = controller.input(
			{
				type: "login_input",
				loginId,
				requestId,
				value: "https://localhost:1455/callback?code=abc&state=x",
			},
			"cmd-input",
		);
		expect(inputResponse.success).toBe(true);

		// Wait for config_update and done frames
		await collector.waitFor(5);

		// Frame 3: config_update { models: true }
		expect(collector.frames[3]).toEqual({
			type: "config_update",
			models: true,
		});

		// Frame 4: done
		expect(collector.frames[4]).toEqual({
			type: "login_event",
			loginId,
			providerId: "fake-oauth",
			event: {
				kind: "done",
				providerId: "fake-oauth",
				identity: "user@example.test",
			},
		});

		// refreshProvider called with storeCredentialsAs target and "online"
		expect(refreshedProviders).toContainEqual({
			provider: "fake-stored",
			strategy: "online",
		});
		expect(storedFlag).toBe(true);
	});

	it("(b) login_cancel -> failed {cancelled:true} and fake stored flag is false", async () => {
		let storedFlag = false;
		registerTestProvider({
			id: "fake-cancel-oauth",
			name: "Fake Cancel OAuth",
			async login(callbacks) {
				callbacks.onAuth({ url: "https://example.test/auth" });
				callbacks.onProgress?.("waiting");
				if (callbacks.onManualCodeInput) {
					const input = await callbacks.onManualCodeInput(callbacks.signal);
					if (input.includes("code=")) {
						storedFlag = true;
						return {
							access: "token",
							refresh: "token",
							expires: Date.now() + 3600_000,
						};
					}
				}
				throw new Error("Login failed");
			},
		});

		const collector = new FrameCollector();
		const controller = new RpcLoginController(session, collector.output);

		const startResponse = controller.start({ type: "login_start", providerId: "fake-cancel-oauth" }, "cmd-start");
		const startSuccess = asSuccessResponse<{ loginId: string }>(startResponse);
		const loginId = startSuccess.data.loginId;

		await collector.waitFor(3);

		const cancelResponse = controller.cancel({ type: "login_cancel", loginId }, "cmd-cancel");
		expect(cancelResponse.success).toBe(true);

		await collector.waitFor(4);

		const failedFrame = collector.frames.find(f => isLoginEventFrame(f) && f.event.kind === "failed");
		if (!failedFrame || !isLoginEventFrame(failedFrame) || failedFrame.event.kind !== "failed") {
			throw new Error("Expected failed frame");
		}
		expect(failedFrame.event.cancelled).toBe(true);
		expect(storedFlag).toBe(false);
	});

	it("(c) second login_start while active -> error", async () => {
		registerTestProvider({
			id: "fake-active-oauth",
			name: "Fake Active OAuth",
			async login(callbacks) {
				callbacks.onAuth({ url: "https://example.test/auth" });
				if (callbacks.onManualCodeInput) {
					await callbacks.onManualCodeInput(callbacks.signal);
				}
				return { access: "a", refresh: "r", expires: Date.now() + 1000 };
			},
		});

		const collector = new FrameCollector();
		const controller = new RpcLoginController(session, collector.output);

		const firstStart = controller.start({ type: "login_start", providerId: "fake-active-oauth" }, "cmd-start-1");
		expect(firstStart.success).toBe(true);

		const secondStart = controller.start({ type: "login_start", providerId: "fake-active-oauth" }, "cmd-start-2");
		expect(secondStart.success).toBe(false);
		if (secondStart.success) throw new Error("Expected failure");
		expect(secondStart.error).toContain("already active");

		controller.dispose();
	});

	it("(d) login_input with unknown loginId or requestId -> error", async () => {
		registerTestProvider({
			id: "fake-input-oauth",
			name: "Fake Input OAuth",
			async login(callbacks) {
				callbacks.onAuth({ url: "https://example.test/auth" });
				callbacks.onProgress?.("waiting");
				if (callbacks.onManualCodeInput) {
					await callbacks.onManualCodeInput(callbacks.signal);
				}
				return { access: "a", refresh: "r", expires: Date.now() + 1000 };
			},
		});

		const collector = new FrameCollector();
		const controller = new RpcLoginController(session, collector.output);

		// With no active session
		const unknownSession = controller.input(
			{ type: "login_input", loginId: "nonexistent", requestId: "req-1", value: "val" },
			"cmd-err-1",
		);
		expect(unknownSession.success).toBe(false);
		if (unknownSession.success) throw new Error("Expected failure");
		expect(unknownSession.error).toContain("Unknown login session");

		// Start a session
		const startRes = controller.start({ type: "login_start", providerId: "fake-input-oauth" }, "cmd-start");
		const startSuccess = asSuccessResponse<{ loginId: string }>(startRes);
		const loginId = startSuccess.data.loginId;

		await collector.waitFor(3);

		// With active session but wrong requestId
		const unknownRequest = controller.input(
			{ type: "login_input", loginId, requestId: "wrong-request-id", value: "val" },
			"cmd-err-2",
		);
		expect(unknownRequest.success).toBe(false);
		if (unknownRequest.success) throw new Error("Expected failure");
		expect(unknownRequest.error).toContain("Unknown login request");

		controller.dispose();
	});

	it("(e) dispose() aborts like cancel", async () => {
		registerTestProvider({
			id: "fake-dispose-oauth",
			name: "Fake Dispose OAuth",
			async login(callbacks) {
				callbacks.onAuth({ url: "https://example.test/auth" });
				callbacks.onProgress?.("waiting");
				if (callbacks.onManualCodeInput) {
					await callbacks.onManualCodeInput(callbacks.signal);
				}
				return { access: "a", refresh: "r", expires: Date.now() + 1000 };
			},
		});

		const collector = new FrameCollector();
		const controller = new RpcLoginController(session, collector.output);

		controller.start({ type: "login_start", providerId: "fake-dispose-oauth" }, "cmd-start");
		await collector.waitFor(3);

		controller.dispose("Client disconnected");
		await collector.waitFor(4);

		const failedFrame = collector.frames.find(f => isLoginEventFrame(f) && f.event.kind === "failed");
		if (!failedFrame || !isLoginEventFrame(failedFrame) || failedFrame.event.kind !== "failed") {
			throw new Error("Expected failed frame");
		}
		expect(failedFrame.event.cancelled).toBe(true);
	});

	it("(f) prompt with secret:true is forwarded, not rejected", async () => {
		registerTestProvider({
			id: "fake-secret-oauth",
			name: "Fake Secret OAuth",
			async login(callbacks) {
				const secretVal = await callbacks.onPrompt({
					message: "Enter private token",
					placeholder: "token",
					secret: true,
					allowEmpty: false,
				});
				return {
					access: secretVal,
					refresh: "refresh",
					expires: Date.now() + 3600_000,
					email: "secret@example.test",
				};
			},
		});

		const collector = new FrameCollector();
		const controller = new RpcLoginController(session, collector.output);

		const startRes = controller.start({ type: "login_start", providerId: "fake-secret-oauth" }, "cmd-start");
		const startSuccess = asSuccessResponse<{ loginId: string }>(startRes);
		const loginId = startSuccess.data.loginId;

		await collector.waitFor(1);

		const promptFrame = collector.frames.find(f => isLoginEventFrame(f) && f.event.kind === "prompt");
		if (!promptFrame || !isLoginEventFrame(promptFrame) || promptFrame.event.kind !== "prompt") {
			throw new Error("Expected prompt frame");
		}
		expect(promptFrame.event.secret).toBe(true);
		expect(promptFrame.event.message).toBe("Enter private token");
		expect(promptFrame.event.placeholder).toBe("token");

		const inputRes = controller.input(
			{
				type: "login_input",
				loginId,
				requestId: promptFrame.event.requestId,
				value: "super-secret-key-123",
			},
			"cmd-input",
		);
		expect(inputRes.success).toBe(true);

		await collector.waitFor(3);

		const doneFrame = collector.frames.find(f => isLoginEventFrame(f) && f.event.kind === "done");
		if (!doneFrame || !isLoginEventFrame(doneFrame) || doneFrame.event.kind !== "done") {
			throw new Error("Expected done frame");
		}
		expect(doneFrame.event.identity).toBe("secret@example.test");
	});

	it("buildLoginStatus returns providers with authenticated, storeCredentialsAs, and accounts", async () => {
		registerTestProvider({
			id: "fake-status-provider",
			name: "Fake Status Provider",
			storeCredentialsAs: "fake-status-target",
			async login() {
				return { access: "a", refresh: "r", expires: 0 };
			},
		});

		// Store credential under target provider using two-argument upsert
		await authStorage.credentials.upsert("fake-status-target", {
			type: "oauth",
			access: "acc",
			refresh: "ref",
			expires: Date.now() + 3600_000,
			email: "status-user@example.test",
		});

		const status = buildLoginStatus(session);
		const provider = status.providers.find(p => p.id === "fake-status-provider");
		expect(provider).toBeDefined();
		expect(provider?.storeCredentialsAs).toBe("fake-status-target");
		expect(provider?.authenticated).toBe(true);
		expect(provider?.accounts.length).toBe(1);
		expect(provider?.accounts[0].label).toBe("status-user@example.test");
	});

	it("RpcInputDispatcher dispatches login_start in background without blocking get_state", async () => {
		registerTestProvider({
			id: "fake-bg-provider",
			name: "Fake BG Provider",
			async login() {
				return { access: "a", refresh: "r", expires: 0 };
			},
		});

		const dispatched: string[] = [];
		const { promise: loginStartHang, resolve: unblockLoginStart } = Promise.withResolvers<RpcServerResponse>();

		const handleCommand = async (command: RpcServerCommand): Promise<RpcServerResponse> => {
			dispatched.push(command.type);
			if (command.type === "login_start") {
				return loginStartHang;
			}
			if (command.type === "get_state") {
				return { id: command.id, type: "response", command: "get_state", success: true, data: {} as never };
			}
			throw new Error(`Unexpected command: ${command.type}`);
		};

		const collector = new FrameCollector();
		const dispatcher = new RpcInputDispatcher({
			deps: {
				handleCommand,
				output: collector.output,
				errorResponse: (id, cmd, msg) => ({ id, type: "response", command: cmd, success: false, error: msg }),
				pendingExtensionRequests: new Map(),
				onHostToolResult: () => {},
				onHostToolUpdate: () => {},
				onHostUriResult: () => {},
			},
		});

		// Dispatch login_start (which will not resolve until unblocked)
		dispatcher.dispatch({ id: "cmd-login-1", type: "login_start", providerId: "fake-bg-provider" });

		// Dispatch get_state immediately after
		dispatcher.dispatch({ id: "cmd-get-state-2", type: "get_state" });

		// Wait for get_state response
		await collector.waitFor(1);

		// get_state was dispatched and responded to even though login_start is still unresolved
		expect(dispatched).toContain("login_start");
		expect(dispatched).toContain("get_state");
		const stateResponse = collector.frames.find(
			f => isRecord(f) && f.type === "response" && f.command === "get_state",
		);
		expect(stateResponse).toBeDefined();

		// Cleanup
		unblockLoginStart({
			id: "cmd-login-1",
			type: "response",
			command: "login_start",
			success: true,
			data: { loginId: "bg-done" },
		});
	});
});
