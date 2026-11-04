/**
 * OSC 7501 Program Status Protocol reports for one `?` turn
 * (https://mitchellh.com/writing/program-status-osc7501). Written to
 * /dev/tty so stdout stays the assistant text for pipes and redirects.
 */
import { closeSync, openSync, writeSync } from "node:fs";

export type ProgramStatus =
	| { state: "idle" | "working" | "done" }
	| { state: "blocked"; kind: "permission" | "question"; msg?: string }
	| { state: "error"; msg?: string };

/** The protocol's decoded `msg` limit. */
const MSG_MAX_BYTES = 2048;
/** C0, DEL and C1: a terminal discards the whole report when decoded text holds one. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]+/g;

function encodeMsg(text: string | undefined): string | undefined {
	if (!text) return undefined;
	const line = text.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
	if (!line) return undefined;
	let bytes = new TextEncoder().encode(line);
	if (bytes.length > MSG_MAX_BYTES) {
		let end = MSG_MAX_BYTES;
		// Back off continuation bytes so the cut never splits a UTF-8 sequence.
		while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
		bytes = bytes.subarray(0, end);
	}
	return Buffer.from(bytes).toString("base64");
}

export function formatReport(status: ProgramStatus): string {
	let body = `state=${status.state}`;
	if (status.state === "blocked") body += `:kind=${status.kind}`;
	body += ":app=omp";
	const msg = encodeMsg(status.state === "blocked" || status.state === "error" ? status.msg : undefined);
	if (msg) body += `:msg=${msg}`;
	return `\x1b]7501;${body}\x1b\\`;
}

/** Writes each report to /dev/tty; without a tty every report is dropped. */
export function ttyStatusReporter(): (status: ProgramStatus) => void {
	let last: string | undefined;
	return status => {
		const report = formatReport(status);
		if (report === last) return;
		last = report;
		let fd: number;
		try {
			fd = openSync("/dev/tty", "w");
		} catch {
			return;
		}
		try {
			writeSync(fd, report);
		} finally {
			closeSync(fd);
		}
	};
}
