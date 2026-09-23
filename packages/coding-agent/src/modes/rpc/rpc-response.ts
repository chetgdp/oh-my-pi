/**
 * RPC response helpers and output channel types.
 */
import type {
	RpcCommand,
	RpcExtensionUIRequest,
	RpcHostToolCallRequest,
	RpcHostToolCancelRequest,
	RpcHostUriCancelRequest,
	RpcHostUriRequest,
	RpcResponse,
	RpcSessionEventFrame,
} from "./rpc-types";

export type RpcOutputFrame =
	| RpcResponse
	| RpcSessionEventFrame
	| RpcExtensionUIRequest
	| RpcHostToolCallRequest
	| RpcHostToolCancelRequest
	| RpcHostUriRequest
	| RpcHostUriCancelRequest
	| object;

export type RpcOutput = (frame: RpcOutputFrame) => void;

export const success = <T extends RpcCommand["type"]>(
	id: string | undefined,
	command: T,
	data?: object | null,
): RpcResponse => {
	if (data === undefined) {
		return { id, type: "response", command, success: true } as RpcResponse;
	}
	return { id, type: "response", command, success: true, data } as RpcResponse;
};

export const errorResponse = (id: string | undefined, command: string, message: string, code?: string): RpcResponse => {
	return { id, type: "response", command, success: false, error: message, ...(code ? { code } : {}) };
};
