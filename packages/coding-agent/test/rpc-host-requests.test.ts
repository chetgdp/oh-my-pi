import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";
import { type RpcConnectionIdentity, RpcHostDriver } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-host-driver";
import { RpcHostExtensionRequests } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-host-requests";
import { getRpcPlanCoordinator, type RpcPlanTuiDelegate } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-plan";
import type { RpcHostSnapshot } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { RpcExtensionUIContext, serveRpc } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-server";
import { type RpcSocketServer, startRpcSocketServer } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-socket";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";

type Frame = Record<string, unknown>;

function makeStubSession(): Record<string, unknown> {
	const listeners = new Set<(event: unknown) => void>();
	return {
		subscribe(fn: (event: unknown) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		subscribeCommandMetadataChanged: () => () => {},
		registerPersistenceFailureCallback: () => () => {},
		setSlashCommands() {},
		messages: [],
		extensions: [],
		skills: [],
		customCommands: [],
		mcpPromptCommands: [],
		sessionId: "stub-session",
		model: "test-model",
		settings: {
			get hostTools() {
				return [];
			},
			onEffectiveChange: () => () => {},
		},
		sessionManager: {
			onPersistenceError: () => () => {},
			onPersistenceNotice: () => () => {},
			getCwd: () => "/tmp",
		},
		hasPendingAsyncWork: () => false,
		async settleAsyncWork() {},
	};
}

const snapshot: RpcHostSnapshot = {
	sessionId: "s1",
	sessionName: "test",
	sessionFile: null,
	cwd: "/tmp",
	model: "test-model",
	startedAt: Date.now(),
};

/** One authenticated raw socket that records every frame it receives. */
class Client {
	readonly frames: Frame[] = [];
	readonly #waiters = new Set<() => void>();
	#buffer = "";

	constructor(readonly socket: net.Socket) {
		socket.on("data", chunk => {
			this.#buffer += chunk.toString();
			let newline = this.#buffer.indexOf("\n");
			while (newline >= 0) {
				const line = this.#buffer.slice(0, newline);
				this.#buffer = this.#buffer.slice(newline + 1);
				if (line) this.frames.push(JSON.parse(line) as Frame);
				newline = this.#buffer.indexOf("\n");
			}
			for (const wake of this.#waiters) wake();
		});
	}

	async waitFor(predicate: (frame: Frame) => boolean, timeoutMs = 3000): Promise<Frame> {
		const deadline = Date.now() + timeoutMs;
		while (true) {
			const found = this.frames.find(predicate);
			if (found) return found;
			const remaining = deadline - Date.now();
			if (remaining <= 0) throw new Error(`timed out; frames: ${JSON.stringify(this.frames)}`);
			const { promise, resolve } = Promise.withResolvers<void>();
			this.#waiters.add(resolve);
			const timer = setTimeout(resolve, remaining);
			await promise;
			clearTimeout(timer);
			this.#waiters.delete(resolve);
		}
	}

	send(frame: object): void {
		this.socket.write(`${JSON.stringify(frame)}\n`);
	}

	async request(command: Frame): Promise<Frame> {
		this.send(command);
		return this.waitFor(frame => frame.type === "response" && frame.id === command.id);
	}

	close(): Promise<void> {
		const { promise, resolve } = Promise.withResolvers<void>();
		this.socket.once("close", () => resolve());
		this.socket.destroy();
		return promise;
	}
}

const isRequest = (id: string) => (frame: Frame) => frame.type === "extension_ui_request" && frame.id === id;
const isCancel = (id: string) => (frame: Frame) =>
	frame.type === "extension_ui_request" && frame.method === "cancel" && frame.targetId === id;
const isDialog = (frame: Frame) =>
	frame.type === "extension_ui_request" && (frame.method === "select" || frame.method === "confirm");

let tmpDir: string;
let server: RpcSocketServer | undefined;
const clients: Client[] = [];

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-host-requests-"));
});

afterEach(async () => {
	await Promise.all(clients.splice(0).map(client => client.close()));
	await server?.stop();
	server = undefined;
	removeSyncWithRetries(tmpDir);
});

interface Harness {
	driver: RpcHostDriver;
	requests: RpcHostExtensionRequests;
	ui: RpcExtensionUIContext;
	session: AgentSession;
	/** Latest identity per clientId. */
	identities: Map<string, RpcConnectionIdentity>;
	connect(clientId: string): Promise<Client>;
	drive(clientId: string): void;
}

async function startHost(): Promise<Harness> {
	const session = makeStubSession() as unknown as AgentSession;
	const driver = new RpcHostDriver();
	const requests = new RpcHostExtensionRequests(driver);
	requests.bind(getRpcPlanCoordinator(session));
	const identities = new Map<string, RpcConnectionIdentity>();
	server = await startRpcSocketServer(session, {
		snapshot,
		onShutdown: () => {},
		registryDir: tmpDir,
		serve: serveRpc,
		kind: "host",
		openConnection: identity => {
			identities.set(identity.clientId, identity);
			return {
				// The stub session has no goal runtime; ownership is irrelevant to routing.
				ownsSession: false,
				sharedExtensionRequests: requests.viewFor(identity.connectionId),
				ready: output => requests.attach(identity, output),
				closed: () => requests.detach(identity.connectionId),
			};
		},
	});
	const entry = JSON.parse(
		fs.readFileSync(
			path.join(
				tmpDir,
				fs.readdirSync(tmpDir).find(f => f.endsWith(".json"))!,
			),
			"utf8",
		),
	) as { token: string };
	const endpoint = server.endpoint;
	return {
		driver,
		requests,
		ui: new RpcExtensionUIContext(requests, requests.broadcast),
		session,
		identities,
		async connect(clientId) {
			const socket = net.connect(endpoint);
			const client = new Client(socket);
			client.send({ type: "auth", token: entry.token, surface: "web", clientId });
			await client.waitFor(frame => frame.type === "ready");
			clients.push(client);
			return client;
		},
		drive(clientId) {
			const identity = identities.get(clientId);
			if (!identity) throw new Error(`unknown client ${clientId}`);
			driver.set(identity);
		},
	};
}

describe("headless host interactive request routing", () => {
	test("without a driver every client gets the dialog; first answer wins, others get cancel", async () => {
		const host = await startHost();
		const a = await host.connect("client-a");
		const b = await host.connect("client-b");

		const answer = host.ui.select("Allow?", ["Approve", "Deny"]);
		const requestA = await a.waitFor(isDialog);
		const id = requestA.id as string;
		await b.waitFor(isRequest(id));

		b.send({ type: "extension_ui_response", id, value: "Deny" });
		expect(await answer).toBe("Deny");
		await a.waitFor(isCancel(id));

		// A late answer from A has nothing to resolve.
		a.send({ type: "extension_ui_response", id, value: "Approve" });
		expect(host.requests.has(id)).toBe(false);
	}, 15_000);

	test("with a driver only the driver gets the dialog and a non-driver answer is ignored", async () => {
		const host = await startHost();
		const a = await host.connect("client-a");
		const b = await host.connect("client-b");
		host.drive("client-a");

		const answer = host.ui.confirm("Run?", "rm -rf build");
		const request = await a.waitFor(isDialog);
		const id = request.id as string;

		b.send({ type: "extension_ui_response", id, confirmed: true });
		// Round-trip a command on B so its answer frame was processed.
		await b.request({ id: "sync", type: "negotiate_protocol", protocolVersion: 2 });
		expect(host.requests.has(id)).toBe(true);
		expect(b.frames.some(isRequest(id))).toBe(false);

		a.send({ type: "extension_ui_response", id, confirmed: false });
		expect(await answer).toBe(false);
	}, 15_000);

	test("non-dialog frames reach every client regardless of driver", async () => {
		const host = await startHost();
		const a = await host.connect("client-a");
		const b = await host.connect("client-b");
		host.drive("client-a");

		host.ui.notify("heads up", "info");
		const isNotify = (frame: Frame) => frame.type === "extension_ui_request" && frame.method === "notify";
		await a.waitFor(isNotify);
		await b.waitFor(isNotify);
	}, 15_000);

	test("a driver move cancels on the old driver and re-sends to the new one", async () => {
		const host = await startHost();
		const a = await host.connect("client-a");
		const b = await host.connect("client-b");
		host.drive("client-a");

		const answer = host.ui.select("Allow?", ["Approve", "Deny"]);
		const id = (await a.waitFor(isDialog)).id as string;

		host.drive("client-b");
		await a.waitFor(isCancel(id));
		await b.waitFor(isRequest(id));

		// The old driver can no longer answer.
		a.send({ type: "extension_ui_response", id, value: "Deny" });
		await a.request({ id: "sync", type: "negotiate_protocol", protocolVersion: 2 });
		expect(host.requests.has(id)).toBe(true);

		b.send({ type: "extension_ui_response", id, value: "Approve" });
		expect(await answer).toBe("Approve");
	}, 15_000);

	test("a dialog for a disconnected driver waits and replays when it reconnects", async () => {
		const host = await startHost();
		const a = await host.connect("client-a");
		const b = await host.connect("client-b");
		host.drive("client-a");
		clients.splice(clients.indexOf(a), 1);
		await a.close();

		const answer = host.ui.select("Allow?", ["Approve", "Deny"]);
		await b.request({ id: "sync", type: "negotiate_protocol", protocolVersion: 2 });
		expect(b.frames.some(isDialog)).toBe(false);

		const again = await host.connect("client-a");
		const id = (await again.waitFor(isDialog)).id as string;
		again.send({ type: "extension_ui_response", id, value: "Approve" });
		expect(await answer).toBe("Approve");
		expect(b.frames.some(isDialog)).toBe(false);
	}, 15_000);

	test("the plan review follows the driver", async () => {
		const host = await startHost();
		const plan = getRpcPlanCoordinator(host.session);
		const answered: string[] = [];
		const delegate: RpcPlanTuiDelegate = {
			isPlanModeEnabled: () => true,
			isPlanModePaused: () => false,
			getPlanFilePath: () => "local://PLAN.md",
			enterPlanMode: async () => {},
			exitPlanMode: async () => {},
			dismissPlanReview: () => {},
			answerPlanReview: action => {
				answered.push(action);
				return true;
			},
		};
		plan.setTuiDelegate(delegate);
		const a = await host.connect("client-a");
		const b = await host.connect("client-b");
		host.drive("client-a");

		const reviewId = plan.startTuiProposal({ title: "Plan", planFilePath: "local://PLAN.md", planContent: "# Plan" });
		const isReview = (frame: Frame) =>
			frame.type === "plan_review" && (frame.review as { reviewId?: string } | null)?.reviewId === reviewId;
		await a.waitFor(isReview);

		const stateB = await b.request({ id: "state-b", type: "get_plan_state" });
		expect((stateB.data as { review: unknown }).review).toBeNull();
		const refused = await b.request({ id: "approve-b", type: "approve_plan", reviewId, action: "execute" });
		expect(refused.success).toBe(false);
		expect(b.frames.some(isReview)).toBe(false);

		host.drive("client-b");
		await a.waitFor(frame => frame.type === "plan_review" && frame.review === null);
		await b.waitFor(isReview);
		const stateA = await a.request({ id: "state-a", type: "get_plan_state" });
		expect((stateA.data as { review: unknown }).review).toBeNull();

		const approved = await b.request({ id: "approve-b2", type: "approve_plan", reviewId, action: "execute" });
		expect(approved.success).toBe(true);
		expect(answered).toEqual(["execute"]);
	}, 15_000);
});
