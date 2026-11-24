# Changelog

## [Unreleased]

### Added

- Shell command words match in any case (`? /SUB`, `? /A --id x`); model names, session ids and prompt text keep their case
- The spinner line names the agent it reports on: `10s · read · main`, or `sub <id>` while a `/sub` subagent streams; on a narrow terminal the agent name is dropped first, then the tool name
- Added `? /attach` and `? /resume` as long names of `? /a` and `? /r`
- Added `? /sub` and `? /main`: `/sub` binds the pane to a running subagent picked on `/dev/tty`, prints its transcript and streams its events until it ends, and plain prompts steer it while other commands stay on the main session; `/main` (or `/a`, `/r`, `/new`) clears the binding, `/status` shows a `subagent` row, and `/f` is refused while bound
- Added `? /tools`: the attached session's tools as aligned columns with family colors, on/off state and a short description
- Added `? /help` (`/h`): prints the command list without contacting a host
- `? /r` marks sessions started in omem memory mode `[omem]` (live pickers too) and resumes them in omem mode
- The omem session (MAIN) is listed first in the live-session pickers (`? /a`, the unattached `?` picker, `? /stop` after the pane's own session)
- Added `? /stop [--id <id>]`: aborts and shuts down a live session (host or TUI) picked on `/dev/tty`, with the pane's own session listed first and marked `[attached]`; stopping the pane's session clears its binding
- Added `? /new --omem`: starts the new host in omem memory mode; if another process holds the omem chat, its notice is printed and the command exits 1
- Added one spinner animation per tool while it runs (read, grep, glob/find, bash, eval, edit/write, task, web_search, todo, wait; other tools blink); the table flip still interrupts on schedule and returns to the tool's face
- Added command chaining: `? /l /m opus-5.5 fix the bug` prints the last reply, switches the model, then sends the prompt; `/l`, `/m <model>` and approval mode flags run in order on one connection and the first failure stops the chain
- Added `? /perms`: picks the attached session's tool approval mode (`always-ask`, `always-ask-cached`, `write`, `yolo`) on `/dev/tty` and applies it to that session only; `--ask`, `--ask-cached`, `--write` or `--yolo` as the first word sets the mode and sends any following text as a prompt. A host started with `--yolo`/`--auto-approve` refuses the change; `? /status` shows a `perms` row
- Added `? /export [N]`: prints the attached session's active branch (or its last N turns) as plain markdown on stdout without starting a turn; `? /export --html [path]` has the host write the HTML export, with a relative path resolved against the pane directory
- Added `? /plan [prompt]`: toggles plan mode on the attached session over RPC and prints the new state; with a prompt, plan mode turns on and the prompt is sent as the first plan-mode turn
- Added `? /diff [instruction]`: prompts with the pane directory's uncommitted diff after the instruction (default `summarize this diff`), followed by piped stdin; no repository or no changes exits 1 without a turn
- Added `? /status` (`/st`): prints the shell settings, the pane binding and the attached session's state (name, model, context, messages, todos, busy/settled) without starting a turn or opening the picker
- Added `? /new [prompt]` as the long name of `? /n`: starts a new host in this directory, attaches the pane, and sends the prompt when one is given
- Added `? /c` as a short name for the host's `/clear`, which empties the context of the attached session and keeps the session
- Added compaction spinner (two faces, picked at random, with `compacting` label) for `? /compact` and mid-turn auto-compaction; `? /compact` now stays attached until compaction finishes and prints its result

### Fixed

- `? /m <model>` with an unknown model exits 1, alone or in a chain, based on the host's `prompt_result` error rather than matching its output text.
- Fixed `? /context` and `? /usage` printing raw colour codes: host command output now skips `shell.render` and has escape sequences removed
- Fixed approval and other prompts with a multi-line title repeating the first line on every arrow key
