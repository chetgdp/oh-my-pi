# @oh-my-pi/shell

Shell mode for omp: `?` sends a prompt from your normal shell to a running omp session host. No nested REPL; the terminal stays the computer.

## Usage

```sh
? why does the build fail          # prompt the session bound to this pane
? /a                               # pick a live session host to attach this pane to
? /r                               # pick a past session of this directory, resume it, attach
? /r --all                         # same, across every project
? /n                               # start a new host in this directory and attach
? /last                            # print the last assistant reply again
? /u                               # short for /usage (provider usage and limits)
? /m [model]                       # short for /model: show the current model, or switch (fuzzy id, provider/id, :level)
git diff | ? review this           # piped stdin is appended: prompt + "\n\n" + stdin
? summarize the log > notes.txt    # stdout carries only the final assistant text
```

- stdout receives only the final assistant text of the turn, so `?` composes with pipes and redirects. Spinner, tool lines and notices go to stderr.
- Rendering is context aware. When stdout is a terminal and `shell.render` is set in the global `~/.omp/agent/config.yml`, the output is piped through that command; pipes and redirects always get raw text, so `? /last | wl-copy` copies markdown. A failing renderer prints a notice and the raw text. Project configs cannot set it, because it runs on every `?`.

  ```yaml
  shell:
    render: glow   # or: bat -l md -p
  ```
- Each pane (tmux pane, otherwise tty) remembers which host it is attached to. If that host is gone or no pane binding exists, `?` asks you to pick one on `/dev/tty`, which also works when stdin/stdout are piped.
- Detach: `?` is one process and one connection per prompt. Ctrl-C detaches the client; the turn keeps running on the host and remains visible in the other omp surfaces.
- Questions the agent asks (select/confirm/input) are answered on `/dev/tty`; without a tty they are cancelled.

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

- `?` prompt, piped stdin, stdout = final assistant text only
- `/a`, `/r [--all]`, `/n`: attach, resume, new host; per-pane binding with detach recovery
- `/last`: last assistant reply via `get_last_assistant_text`, no turn started
- `/u` → `/usage`, `/m` → `/model`: shell-side aliases (`HOST_ALIASES` in `src/commands.ts`); other `/x` go to the host unchanged
- `shell.render`: terminal-only rendering through a user command (e.g. `glow`), global config only, raw fallback on failure
- `--setup`, `--uninstall`, `--dry-run` for fish, bash, zsh

### Next

- `/m` with no argument opens a model picker on `/dev/tty`. Picking changes the config (default model), not only the session. Needs type-to-filter and a scrolling window in the `tty-ui.ts` list picker (the model list does not fit on screen); `/a` and `/r` gain both for free.
  - Unknown: whether the host's `/model` (`setModel`) already persists the default model, or the picker must write it.

### Open questions

- Should unknown `/x` that are neither shell commands nor host commands be refused by the shell instead of reaching the agent as plain text?
- `shell.render` file names (`config.yml`, `config.yaml`) are duplicated from coding-agent `MAIN_CONFIG_FILENAMES` to avoid a ~200ms import on every `?`.

### Later

- Red/green diff rendering for edit tool results
- Verify pickers and dialogs on a real terminal
- Spinner fallback without a tty (e.g. under nvim `:!`)
- A TUI with `rpc.serve` off takes no session lock, so `? /r` can open a second writer on a session the TUI holds

### Giverny commands not yet reviewed

Candidates only; each gets decided on its own.

- `/status`, `/context`, `/config`
- `/effort` and level shortcuts (`/low` … `/max`)
- `/perms`, `/ask`, `/auto`, `/plan`
- `/output` (`/quiet`, `/normal`, `/verbose`): tool line detail on stderr
- `/compact [focus]`, `/new` / `/clear`, `/export [file]`, `/diff [instruction]`, `/reset`
- Command chaining (`/m opus /high write a haiku`)
- `--local` per-directory settings
