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
? /n                               # start a new host in this directory and attach
? /last                            # print the last assistant reply again (/l for short)
? /a /l                            # attach, then print that session's last reply
? /u                               # short for /usage (provider usage and limits)
? /m [model]                       # short for /model: show the current model, or switch (fuzzy id, provider/id, :level)
? /output [default|N|all]          # show or set how many result lines appear under each tool line
git diff | ? review this           # piped stdin is appended: prompt + "\n\n" + stdin
? summarize the log > notes.txt    # stdout carries only assistant replies
```

- stdout receives only assistant replies: the final text of each agent run, written as that run ends. A plain prompt is one run, so `?` composes with pipes and redirects. Spinner, tool lines and notices go to stderr.
- Rendering is context aware. When stdout is a terminal and `shell.render` is set in the global `~/.omp/agent/config.yml`, the output is piped through that command; pipes and redirects always get raw text, so `? /last | wl-copy` copies markdown. A failing renderer prints a notice and the raw text. Project configs cannot set it, because it runs on every `?`.

  ```yaml
  shell:
    render: glow   # or: bat -l md -p
  ```
- Tool detail: each tool call prints one `· tool args` line on stderr, followed by part of its result. `shell.toolLines` sets how much: `default` uses the TUI's collapsed size per tool (edit diffs 40, bash/eval 10, read none, grep 3, others 8 or 12), a number applies to every tool (`0` shows tool lines only), `all` shows everything. A cut result shows its first lines, the hidden count and its last line. `? /output 12` writes the value to the global config, keeping its other keys; `? /output` shows it.
- Live sessions are headless hosts (`omp host start`) and TUIs serving RPC. The picker marks TUIs `[tui]`. A pane attached to a TUI drives it over its socket like the web GUI does: prompts and replies appear in the TUI too. TUIs have no shell attachments, so Ctrl-C detach recovery does not apply there, and `? /r` on a session a TUI holds attaches to that TUI.
- `--id` matches session ids exactly first, then by prefix. No match or several matches print the candidates (id, kind, name, cwd) and leave the pane as it was.
- Each pane (tmux pane, otherwise tty) remembers which host it is attached to. If that host is gone or no pane binding exists, `?` asks you to pick one on `/dev/tty`, which also works when stdin/stdout are piped.
- Busy session: like Enter in the TUI, `?` steers a running turn; `? /f` queues a follow-up instead (`/a /f …` works too). A `queued` notice appears on stderr and stdout gets the reply once the agent yields.
- `?` stays attached until the session settles: when background work such as subagents wakes the agent after it yielded, those runs stream too, and each run's reply prints when it ends.
- Detach: `?` is one process and one connection per prompt. Ctrl-C only detaches; it never aborts or withdraws anything, and the agent keeps running. To steer, Ctrl-C and send `? text`. Stop the agent from the TUI. On Ctrl-C the pane bookmarks the session's current entry (`get_state` `leafId`); the next `?` on that pane (prompt, `/last`, `/a`, `/r`, `/n`, host slash commands) first prints what it missed since then via `get_entries`, assistant text on stdout and tool lines on stderr, once. A second Ctrl-C exits without waiting for the bookmark. User prompts are not replayed.
- Questions the agent asks (select/confirm/input) are answered on `/dev/tty`; without a tty they are cancelled.
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
- `/a [--id]`, `/r [--all|--id]`, `/n`: attach (headless hosts and TUIs), resume, new host; per-pane binding with detach recovery; a prompt from an unattached pane opens the host picker
- `/last` (`/l`): last assistant reply via `get_last_assistant_text`, no turn started; `/a /l`, `/r /l`, `/n /l` attach first
- `/u` → `/usage`, `/m` → `/model`: shell-side aliases (`HOST_ALIASES` in `src/commands.ts`); other `/x` go to the host unchanged
- `shell.render`: terminal-only rendering through a user command (e.g. `glow`), global config only, raw fallback on failure
- OSC 7501 program status for each turn, honouring `terminal.programStatus`
- Edit results show their diff under the tool line, `+` green and `-` red on a terminal
- Spinner without a tty (nvim `:!`, `2>file`): the face once, then a dot every few seconds, no escapes
- `/output [default|N|all]`: `shell.toolLines` result lines under each tool line (default: the TUI's per-tool sizes, then the last line), saved in the global config
- `--setup`, `--uninstall`, `--dry-run` for fish, bash, zsh

### Not planned

- A model picker for `/m`: model selection has its own UX in the TUI, and shell mode stays minimal. `/m [model]` remains.

### Open questions

- Should unknown `/x` that are neither shell commands nor host commands be refused by the shell instead of reaching the agent as plain text?
- `shell.render` file names (`config.yml`, `config.yaml`) are duplicated from coding-agent `MAIN_CONFIG_FILENAMES` to avoid a ~200ms import on every `?`.

### Later
- A TUI with `rpc.serve` off takes no session lock, so `? /r` can open a second writer on a session the TUI holds

### Giverny commands not yet reviewed

Candidates only; each gets decided on its own.

- `/status`, `/context`, `/config`
- `/effort` and level shortcuts (`/low` … `/max`)
- `/perms`, `/ask`, `/auto`, `/plan`
- `/compact [focus]`, `/new` / `/clear`, `/export [file]`, `/diff [instruction]`, `/reset`
- Command chaining (`/m opus /high write a haiku`)
- `--local` per-directory settings
