import { getOAuthProviders } from "@oh-my-pi/pi-ai/oauth";
import { Snowflake } from "@oh-my-pi/pi-utils";
import { formatLoginIdentity } from "../../cli/oauth-terminal";
import type { AgentSession } from "../../session/agent-session";
import { toLogoutAccounts } from "../../slash-commands/helpers/logout";
import { errorResponse, success, type RpcOutput } from "./rpc-response";
import type { RpcCommand, RpcLoginEvent, RpcLoginProviderStatus, RpcLoginStatusResult, RpcResponse } from "./rpc-types";

interface ActiveLogin {
	loginId: string;
	providerId: string;
	storeCredentialsAs?: string;
	abort: AbortController;
	pending: Map<string, PromiseWithResolvers<string>>;
}

export function buildLoginStatus(session: AgentSession): RpcLoginStatusResult {
	const authStorage = session.modelRegistry.authStorage;
	const providers: RpcLoginProviderStatus[] = getOAuthProviders().map(provider => {
		const targetProvider = provider.storeCredentialsAs ?? provider.id;
		const authenticated = authStorage.keys.source(targetProvider) !== undefined;
		const source = authenticated ? authStorage.keys.describe(targetProvider, session.sessionId) : undefined;
		const credentials = authStorage.credentials.list(targetProvider);
		const logoutAccounts = toLogoutAccounts(targetProvider, credentials, {
			activeIdentity: authStorage.oauth.identity(targetProvider, session.sessionId),
			activeApiKey: authStorage.keys.source(targetProvider)?.kind === "api_key",
		});
		const accounts = logoutAccounts.map(account => ({
			credentialId: account.credentialId,
			label: account.label,
		}));

		return {
			id: provider.id,
			name: provider.name,
			available: provider.available,
			...(provider.storeCredentialsAs ? { storeCredentialsAs: provider.storeCredentialsAs } : {}),
			authenticated,
			...(source ? { source } : {}),
			accounts,
		};
	});
	return { providers };
}

export class RpcLoginController {
	#active: ActiveLogin | undefined;
	readonly #output: RpcOutput;
	readonly #session: AgentSession;

	constructor(session: AgentSession, output: RpcOutput) {
		this.#session = session;
		this.#output = output;
	}

	start(command: Extract<RpcCommand, { type: "login_start" }>, id: string | undefined): RpcResponse {
		const provider = getOAuthProviders().find(p => p.id === command.providerId && p.available);
		if (!provider) {
			return errorResponse(id, "login_start", `Unknown or unavailable OAuth provider: ${command.providerId}`);
		}
		if (this.#active) {
			return errorResponse(id, "login_start", "Another login flow is already active");
		}
		const loginId = Snowflake.next();
		const abort = new AbortController();
		const pending = new Map<string, PromiseWithResolvers<string>>();
		const active: ActiveLogin = {
			loginId,
			providerId: command.providerId,
			storeCredentialsAs: provider.storeCredentialsAs,
			abort,
			pending,
		};
		this.#active = active;
		void this.#run(active);
		return success(id, "login_start", { loginId });
	}

	input(command: Extract<RpcCommand, { type: "login_input" }>, id: string | undefined): RpcResponse {
		if (!this.#active || this.#active.loginId !== command.loginId) {
			return errorResponse(id, "login_input", `Unknown login session: ${command.loginId}`);
		}
		const pending = this.#active.pending.get(command.requestId);
		if (!pending) {
			return errorResponse(id, "login_input", `Unknown login request: ${command.requestId}`);
		}
		this.#active.pending.delete(command.requestId);
		pending.resolve(command.value);
		return success(id, "login_input", {});
	}

	cancel(command: Extract<RpcCommand, { type: "login_cancel" }>, id: string | undefined): RpcResponse {
		if (!this.#active || this.#active.loginId !== command.loginId) {
			return errorResponse(id, "login_cancel", `Unknown login session: ${command.loginId}`);
		}
		this.#active.abort.abort("Login cancelled");
		return success(id, "login_cancel", {});
	}

	dispose(reason?: string): void {
		if (!this.#active) return;
		this.#active.abort.abort(reason ?? "RPC client disconnected");
		for (const pending of this.#active.pending.values()) {
			pending.reject(new Error(reason ?? "RPC client disconnected"));
		}
		this.#active.pending.clear();
	}

	async #run(active: ActiveLogin): Promise<void> {
		try {
			const identity = await this.#session.modelRegistry.authStorage.oauth.login(active.providerId, {
				signal: active.abort.signal,
				onAuth: info => {
					this.#emitEvent(active.loginId, active.providerId, {
						kind: "auth",
						url: info.url,
						...(info.instructions ? { instructions: info.instructions } : {}),
					});
				},
				onProgress: message => {
					this.#emitEvent(active.loginId, active.providerId, {
						kind: "progress",
						message,
					});
				},
				onPrompt: async prompt => {
					const requestId = Snowflake.next();
					const deferred = Promise.withResolvers<string>();
					active.pending.set(requestId, deferred);

					const onAbort = () => {
						active.pending.delete(requestId);
						deferred.reject(new Error(active.abort.signal.reason || "Login cancelled"));
					};

					if (active.abort.signal.aborted) {
						onAbort();
						return deferred.promise;
					}

					active.abort.signal.addEventListener("abort", onAbort, { once: true });
					this.#emitEvent(active.loginId, active.providerId, {
						kind: "prompt",
						requestId,
						message: prompt.message,
						...(prompt.placeholder !== undefined ? { placeholder: prompt.placeholder } : {}),
						...(prompt.secret !== undefined ? { secret: prompt.secret } : {}),
						...(prompt.allowEmpty !== undefined ? { allowEmpty: prompt.allowEmpty } : {}),
					});

					try {
						return await deferred.promise;
					} finally {
						active.abort.signal.removeEventListener("abort", onAbort);
						active.pending.delete(requestId);
					}
				},
				onManualCodeInput: async (signal?: AbortSignal) => {
					const requestId = Snowflake.next();
					const deferred = Promise.withResolvers<string>();
					active.pending.set(requestId, deferred);

					const abortSignal = signal ? AbortSignal.any([active.abort.signal, signal]) : active.abort.signal;

					const onAbort = () => {
						active.pending.delete(requestId);
						deferred.reject(new Error(abortSignal.reason || "Manual code input cancelled"));
					};

					if (abortSignal.aborted) {
						onAbort();
						return deferred.promise;
					}

					abortSignal.addEventListener("abort", onAbort, { once: true });
					this.#emitEvent(active.loginId, active.providerId, {
						kind: "manual_input",
						requestId,
					});

					try {
						return await deferred.promise;
					} finally {
						abortSignal.removeEventListener("abort", onAbort);
						active.pending.delete(requestId);
					}
				},
			});

			const targetProvider = active.storeCredentialsAs ?? active.providerId;
			await this.#session.modelRegistry.refreshProvider(targetProvider, "online");
			this.#output({ type: "config_update", models: true });
			const formattedIdentity = formatLoginIdentity(identity);
			this.#emitEvent(active.loginId, active.providerId, {
				kind: "done",
				providerId: active.providerId,
				...(formattedIdentity ? { identity: formattedIdentity } : {}),
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			this.#emitEvent(active.loginId, active.providerId, {
				kind: "failed",
				error: message,
				cancelled: active.abort.signal.aborted,
			});
		} finally {
			if (this.#active?.loginId === active.loginId) {
				this.#active = undefined;
			}
		}
	}

	#emitEvent(loginId: string, providerId: string, event: RpcLoginEvent): void {
		this.#output({
			type: "login_event",
			loginId,
			providerId,
			event,
		});
	}
}
