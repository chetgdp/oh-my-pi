/**
 * Pane key: the identity of one terminal pane, sent to the host as the auth
 * `attachment` and used as the key of the pane state file.
 *
 * Must match the host's identity token `^[A-Za-z0-9._:-]{1,128}$`
 * (rpc-host-driver.ts); the host refuses anything else with `invalid_attachment`.
 */

const PANE_KEY = /^[A-Za-z0-9._:-]{1,128}$/;

export interface PaneSource {
	/** `$TMUX_PANE`, e.g. `%3`. */
	tmuxPane: string | undefined;
	/** `$TMUX` socket path; panes ids are only unique per tmux server. */
	tmuxSocket: string | undefined;
	/** Path of the controlling tty, e.g. `/dev/ttys004`. */
	tty: string | undefined;
}

/** Returns null when the process has neither a tmux pane nor a tty. */
export function encodePaneKey(source: PaneSource): string | null {
	let key: string | null = null;
	if (source.tmuxPane) {
		const pane = /^%(\d{1,10})$/.exec(source.tmuxPane);
		if (!pane) throw new Error(`unexpected TMUX_PANE: ${source.tmuxPane}`);
		const server = source.tmuxSocket ? Bun.hash(source.tmuxSocket.split(",")[0]).toString(36) : "0";
		key = `tmux.${server}.${pane[1]}`;
	} else if (source.tty) {
		const tty = /^\/dev\/([A-Za-z0-9/]{1,64})$/.exec(source.tty);
		if (!tty) throw new Error(`unexpected tty path: ${source.tty}`);
		key = `tty.${tty[1].replaceAll("/", ".")}`;
	}
	if (key !== null && !PANE_KEY.test(key)) throw new Error(`pane key violates host token: ${key}`);
	return key;
}
