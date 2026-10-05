/**
 * RPC response helpers and output channel types.
 */
import type {
	RpcServerCommand,
	RpcExtensionUIRequest,
	RpcHostToolCallRequest,
	RpcHostToolCancelRequest,
	RpcHostUriCancelRequest,
	RpcHostUriRequest,
	RpcServerResponse,
	RpcServerSessionEventFrame,
} from "./rpc-types";

export type RpcOutputFrame =
	| RpcServerResponse
	| RpcServerSessionEventFrame
	| RpcExtensionUIRequest
	| RpcHostToolCallRequest
	| RpcHostToolCancelRequest
	| RpcHostUriRequest
	| RpcHostUriCancelRequest
	| object;

export type RpcOutput = (frame: RpcOutputFrame) => void;

export const success = <T extends RpcServerCommand["type"]>(
	id: string | undefined,
	command: T,
	data?: object | null,
): RpcServerResponse => {
	if (data === undefined) {
		return { id, type: "response", command, success: true } as RpcServerResponse;
	}
	return { id, type: "response", command, success: true, data } as RpcServerResponse;
};

export const errorResponse = (
	id: string | undefined,
	command: string,
	message: string,
	code?: string,
): RpcServerResponse => {
	return { id, type: "response", command, success: false, error: message, ...(code ? { code } : {}) };
};
