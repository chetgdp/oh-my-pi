Start a new omp session in `cwd` and return its session id once it has registered.

- With tmux available (the `tmuxSession` argument, the `omem.tmuxSession` setting, or the tmux session this omp runs in), the session opens as a TUI in a new background window of that tmux session, so the user can watch or take it over.
- Otherwise it starts as a headless host.
- `prompt`, when given, is sent as the session's first message.
