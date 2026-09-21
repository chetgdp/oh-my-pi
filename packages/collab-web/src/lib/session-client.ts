/**
 * Shared interface for session clients (collab GuestClient and direct RpcWebClient).
 * Components accept this instead of a concrete class so either transport works.
 */
import type { CollabUiResponseValue } from "@oh-my-pi/pi-wire";
import type { GuestSnapshot, TranscriptResult } from "./client";

export interface SessionClient {
	subscribe(listener: () => void): () => void;
	getSnapshot(): GuestSnapshot;
	sendPrompt(text: string, images?: unknown[]): void;
	sendAbort(): void;
	sendUiResponse(reqId: number, value?: CollabUiResponseValue): void;
	sendAgentCmd(cmd: "chat" | "kill" | "revive", agentId: string, text?: string): void;
	fetchTranscript(agentId: string, fromByte: number): Promise<TranscriptResult | null>;
	newSession?(): void;
	switchSession?(sessionPath: string): void;
}
