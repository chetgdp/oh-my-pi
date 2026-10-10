# @oh-my-pi/shell

Shell mode for omp: `?` sends a prompt from your normal shell to a running omp session host. No nested REPL; the terminal stays the computer.

## Usage

```sh
? why does the build fail          # prompt the session bound to this pane
? /a                               # pick a live session host to attach this pane to
? /r                               # pick a past session of this directory, resume it, attach
? /r --all                         # same, across every project
? /n                               # start a new host in this directory and attach
git diff | ? review this           # piped stdin is appended: prompt + "\n\n" + stdin
? summarize the log > notes.txt    # stdout carries only the final assistant text
```

- stdout receives only the final assistant text of the turn, so `?` composes with pipes and redirects. Spinner, tool lines and notices go to stderr.
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
