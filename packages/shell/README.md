# @oh-my-pi/shell

Shell mode for omp: `?` sends a prompt from your normal shell to a running omp session host. No nested REPL; the terminal stays the computer.

## Usage

```sh
? why does the build fail          # prompt the session bound to this pane (steers it if busy)
? /f then commit                   # busy session: queue as a follow-up after the current turn
? /a                               # pick a live session (headless host or TUI) to attach this pane to
? /a --id 01jx4k                   # attach to the live session with that id (or unique id prefix)
? /r                               # pick a past session of this directory, resume it, attach
? /r --all                         # same, across every project
? /r --id 01jx4k                   # resume by session id (or unique prefix): a live one is attached, else a host is started
? /new                             # start a new host in this directory and attach (/n for short)
? /new explain this                # same, then send the prompt to the new session
? /last                            # print the last assistant reply again (/l for short)
? /a /l                            # attach, then print that session's last reply
? /u                               # short for /usage (provider usage and limits)
? /m [model]                       # short for /model: show the current model, or switch (fuzzy id, provider/id, :level)
? /clear                           # empty the context of the attached session, keeping the session (/c for short)
? /output [default|N|all]          # show or set how many result lines appear under each tool line
? /status                          # shell settings, pane binding, attached session state (/st for short)
? /plan [prompt]                   # toggle plan mode; with a prompt, enable it and send the prompt as the first plan turn
? /export [N]                       # the session's active branch (or its last N turns) as markdown on stdout, no turn
? /export --html [path]            # the host writes the HTML export; a relative path is resolved against this directory
? /diff [instruction]              # prompt with this directory's uncommitted diff (default: summarize this diff)
? /perms                           # pick the attached session's tool approval mode (this session only)
? --write fix the tests            # set the approval mode (--ask, --ask-cached, --write, --yolo), then prompt
? --yolo                           # only set the approval mode, no turn
? /l /m opus-5.5 fix the bug       # chain: print the last reply, switch model, then send the prompt
git diff | ? review this           # piped stdin is appended: prompt + "\n\n" + stdin
? summarize the log > notes.txt    # stdout carries only assistant replies
```

- stdout receives only assistant replies: the final text of each agent run, written as that run ends. A plain prompt is one run, so `?` composes with pipes and redirects. Spinner, tool lines and notices go to stderr.
- Rendering is context aware. When stdout is a terminal and `shell.render` is set in the global `~/.omp/agent/config.yml`, the output is piped through that command; pipes and redirects always get raw text, so `? /last | wl-copy` copies markdown. A failing renderer prints a notice and the raw text. Project configs cannot set it, because it runs on every `?`.

  ```yaml
  shell:
    render: glow   # or: bat -l md -p
  ```
- Tool detail: each tool call prints one `· tool args` line on stderr, followed by part of its result. `shell.toolLines` sets how much: `default` uses the TUI's collapsed size per tool (edit diffs 40, bash/eval 10, read none, grep 3, others 8 or 12), a number applies to every tool (`0` shows tool lines only), `all` shows everything. A cut result shows its first lines, the hidden count and its last line. The tool name is colored by family (inspection cyan, execution magenta, mutation yellow, others plain); everything is plain when stderr is not a terminal or `NO_COLOR` is set. `? /output 12` writes the value to the global config, keeping its other keys; `? /output` shows it.
- Live sessions are headless hosts (`omp host start`) and TUIs serving RPC. The picker marks TUIs `[tui]`. A pane attached to a TUI drives it over its socket like the web GUI does: prompts and replies appear in the TUI too. TUIs have no shell attachments, so Ctrl-C detach recovery does not apply there, and `? /r` on a session a TUI holds attaches to that TUI. A TUI always holds its session's lock, so `? /r` never starts a second writer: with `rpc.serve` off in that TUI it fails with `session is open in an omp TUI without rpc.serve; enable rpc.serve there or close it`. Opening a host's session in the TUI waits for the host's turn to end, stops the host and takes the session over.
- `--id` matches session ids exactly first, then by prefix. No match or several matches print the candidates (id, kind, name, cwd) and leave the pane as it was.
- Each pane (tmux pane, otherwise tty) remembers which host it is attached to and that host's session id. If that host is gone (e.g. a TUI took the session over and shut the host down) and exactly one live process (a TUI serving RPC or another host) now serves the same session id, `?` re-attaches to it, prints `re-attached to <session>`, and keeps the Ctrl-C bookmark, since it is an entry of that same session. Otherwise, or when the binding predates session ids or no binding exists, `?` prints `no session attached`, asks you to pick one on `/dev/tty`, which also works when stdin/stdout are piped, and prints `attached to <session>` before sending the prompt.
- Busy session: like Enter in the TUI, `?` steers a running turn; `? /f` queues a follow-up instead (`/a /f …` works too). A `queued` notice appears on stderr and stdout gets the reply once the agent yields.
- `?` stays attached until the session settles: when background work such as subagents wakes the agent after it yielded, those runs stream too, and each run's reply prints when it ends.
- Detach: `?` is one process and one connection per prompt. Ctrl-C only detaches; it never aborts or withdraws anything, and the agent keeps running. To steer, Ctrl-C and send `? text`. Stop the agent from the TUI. On Ctrl-C the pane bookmarks the session's current entry (`get_state` `leafId`); the next `?` on that pane (prompt, `/last`, `/a`, `/r`, `/n`, host slash commands) first prints what it missed since then via `get_entries`, assistant text on stdout and tool lines on stderr, once. A second Ctrl-C exits without waiting for the bookmark. User prompts are not replayed.
- Questions the agent asks (select/confirm/input) are answered on `/dev/tty`; without a tty they are cancelled. List rows (picker, select, confirm) are cut to the terminal width with `…`; the input title and typed text wrap. After a resize the frame is corrected on the next key.
- Turn status is reported to the terminal over [OSC 7501](https://mitchellh.com/writing/program-status-osc7501), written to `/dev/tty`: `working` once the agent starts, `blocked` while a question waits on you (`permission` for confirm, `question` otherwise), then `done`, `error` (with the message) or `idle` after Ctrl-C. Host-only slash commands report nothing. `terminal.programStatus: false` in the global config turns it off.

## Setup

```sh
omp-shell --setup              # install ? for fish, bash and zsh
omp-shell --setup --dry-run    # show which files would change
omp-shell --uninstall          # remove the binding
```

Only shells whose config exists are touched:

- fish: `~/.config/fish/functions/?.fish` calling `omp-shell $argv`. fish 4 does not glob `?`; on fish 3 quote prompts containing `?` or `*`.
- bash: a marked block in `~/.bashrc` using the `set -f` alias pattern (no globbing of the prompt) plus `set +H` (no `!` history expansion).
- zsh: a marked block in `~/.zshrc` aliasing `?` to `noglob omp-shell`.

Setup is idempotent and replaces an existing giverny install (its rc blocks and a `?.fish` that calls `giverny`). Uninstall removes both omp-shell and giverny bindings and leaves other rc content untouched.

## Status

Working notes. Commands are added one at a time; giverny (`~/Code/giverny`) is the reference, but Claude Code specific features are not carried over.

### Done

- `?` prompt, piped stdin, stdout = assistant replies only, one per run
- Busy sessions: steer by default, `/f` follow-up; `?` waits for `session_settled`; Ctrl-C detaches only, and the next `?` replays what the pane missed
- `/a [--id]`, `/r [--all|--id]`, `/new` (`/n`): attach (headless hosts and TUIs), resume, new host; per-pane binding with detach recovery; a prompt from an unattached pane opens the host picker
- `/last` (`/l`): last assistant reply via `get_last_assistant_text`, no turn started; `/a /l`, `/r /l`, `/n /l` attach first
- `/u` → `/usage`, `/m` → `/model`, `/c` → `/clear`: shell-side aliases (`HOST_ALIASES` in `src/commands.ts`); other `/x` go to the host unchanged
- `shell.render`: terminal-only rendering through a user command (e.g. `glow`), global config only, raw fallback on failure
- OSC 7501 program status for each turn, honouring `terminal.programStatus`
- Edit results show their diff under the tool line, `+` green and `-` red on a terminal
- Spinner without a tty (nvim `:!`, `2>file`): the face once, then a dot every few seconds, no escapes
- `/perms` and `--ask`/`--ask-cached`/`--write`/`--yolo` as the first word: session-only approval mode over `get_approval_mode`/`set_approval_mode`, never written to config; a host started with `--yolo`/`--auto-approve` refuses; `/status` shows a `perms` row
- `/output [default|N|all]`: `shell.toolLines` result lines under each tool line (default: the TUI's per-tool sizes, then the last line), saved in the global config
- `/status` (`/st`): settings, pane binding and one `get_state` of the attached session on stderr, colorised when stderr is a terminal and plain otherwise; no turn, no picker
- `/plan [prompt]`: toggles plan mode through `get_plan_state` / `set_plan_mode` (the host's `/plan` is TUI-only), printing `plan mode: on|off` on stderr; like the TUI, a prompt is sent as the first plan-mode turn when plan mode turns on and dropped (exit 1) when it turns off, and a paused plan mode without a prompt is cleared
- `/export [N]`: one `get_entries` on a connection that negotiates RPC protocol v2, so a long session arrives in chunks (up to 64 MiB; larger prints `transcript too large to export`), walked from `leafId` so dead branches are left out; each turn is the prompt quoted with `> `, assistant text and one plain `· tool args` line per tool call, with no thinking or tool results and a `_[earlier context compacted]_` line per compaction; printed unrendered. `--html [path]` sends the host's `/export` (the host resolves relative paths against its own cwd, so the shell sends an absolute path; without a path the file lands in the host's cwd) and prints the path it returns. Bad N, or `--html` with N, is a usage error (exit 1) with no host contact
- `/diff [instruction]`: the pane cwd's uncommitted diff (`@oh-my-pi/pi-natives/vcs`, git or jj) sent as instruction, diff, then piped stdin, each after a blank line; no repository or no changes prints a notice and exits 1 without a turn
- Command chaining: leading `/l` (`/last`), `/m <model>` (exactly one word) and `--ask`/`--ask-cached`/`--write`/`--yolo` run left to right on one connection, in any order and repeated, then the rest (with piped stdin, `/f` allowed first) is the prompt; works after `/a`, `/r`, `/new` (picker once). The first failing step (host error, `Unknown model`/`Failed to set model` reply, approval error) stops the chain with exit 1 and no prompt. In a chain `/model` output goes to stderr. `/m` without a model after a step is a usage error; a lone step keeps its single form (`? /m opus`, `? --write text`, `? /a /l`), and `? /l text` is now `/l` then the prompt
- `--setup`, `--uninstall`, `--dry-run` for fish, bash, zsh
- `/context` (and every other host command output): printed as the host sent it, never through `shell.render`, with escape sequences removed
- `/compact`: stays attached while background compaction runs, pins one of two compaction spinner faces at random (`compacting` label), and prints the result line; mid-turn auto-compaction uses the same spinner

### Not planned

- A model picker for `/m`: model selection has its own UX in the TUI, and shell mode stays minimal. `/m [model]` remains.
- Refusing unknown `/x`: the TUI sends them to the agent as text, and refusing would also block prompts that start with a path (`? /etc/hosts is broken`).
- `/effort` and level shortcuts (`/low` … `/max`): the thinking level is set in the TUI. `/m model:level` remains.
- `/config`: `/status` already prints every shell setting.
- `/reset` (giverny: reset the config to defaults): the shell has two settings, both set with one command each. `? /usage reset` still reaches the host's rate-limit reset.
- `--local` per-directory settings: model and thinking level belong to the host session, and `shell.render` must stay global because it runs a command on every `?`.
