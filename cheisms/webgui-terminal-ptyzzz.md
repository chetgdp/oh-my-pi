# webgui terminal via ptyZZZ

Status: parked (research done 2026-10-24, not adding yet). Design decisions below are unanswered.

## Why

Use a shell from the webgui (e.g. `sudo`) without leaving for the rootshell app. A pty answers sudo's password prompt; the agent bash tool has no tty for it.

## ptyZZZ

<https://github.com/cablehead/ptyZZZ>, MIT, cloned at `~/TPP/ptyZZZ` (head `d005f5a`, 2026-09-10). One Rust binary: shell in a pty, terminal emulated server-side with `wezterm-term` (git-pinned), JSONL in, JSONL HTML frames out. Wire format in `PROTOCOL.md`.

- In: `input` (raw bytes, IME text), `key` (`KeyboardEvent.key` + mods 1 shift, 2 alt, 4 ctrl, 8 meta; encoded against live modes), `paste` (bracketed when enabled), `resize`, `screen` (request keyframe).
- Out: `screen` keyframe (rows `grid-r-{stable}`, cursor overlay), `diff {base, patch, append, trim}` (apply only when `base` equals held seqno, else wait for the next keyframe, due within `--keyframe-interval`, default 5s), `exit`.
- Browser needs no xterm.js and holds no terminal state; reconnect gets the current screen; terminal queries are answered with no viewer attached.
- No kitty keyboard protocol (legacy fallback).

## Verified

- Build: `cargo build --release` with nix cargo, 3 min.
- Escaping (`src/main.rs` 1026-1141, plus live probe): cell text escapes `& < > "`; hrefs pass an http/https/mailto allowlist (`safe_href`) and are escaped; OSC 8 `javascript:` rendered as plain text; style attrs carry only numbers and hex colors; the id `target` comes from argv.
- `sudo true` shows `Password:` in the frame.
- Cost, one terminal with `fish --no-config` (fish not counted): 6 MB RSS idle, 9 MB after load, 0 CPU idle; `seq 1 300000` = 0.26 s CPU, 16 frames, 2.1 MB uncompressed, max frame 157 KB.
- Rendering in headless Chromium at 390px with IosevkaTerm and webgui tokens: attrs, 16/256/truecolor, reverse, CJK and emoji in 2-cell boxes, box drawing, links and cursor all correct.
- CSS: ~35 lines in `serve.nu`, bare global classes (`.row`, `.cursor`, `.wc`, `.c`, `.sb`/`.si`/`.su`/`.sx`/`.ss`, `.f0-15`, `.b0-15`); no webgui collisions today; scoping under `.term` works. `--c0` is invisible on the dark background.
- Alternative: Bun 1.4.2 has a native pty (`Bun.spawn({ terminal })`), bytes only; it still needs an emulator (xterm.js client-side, losing clean reconnect).

## Unknown

- iOS input: soft keyboard, dictation, Ctrl/Esc.
- WebSocket compression effect on frames.

## Design decisions (open)

1. Security: who may open a shell (Tailscale only / per-device token or passkey / daemon opt-in flag). Recommended: opt-in flag plus tailnet ACL now; real auth is the webgui-wide security task in `packages/webgui/TASK.md`. Shell runs as the user, never root.
2. Lifecycle: owner (daemon child, dies with daemon / inside the `ompgui` tmux session, survives restarts). Recommended: daemon child. End on exit, explicit close, or idle timeout with no viewer. One terminal per server to start.
3. UI: sheet on phone, side column on desktop, same component; start in the session cwd, server-wide default.
4. Input: phone key row (Esc, Tab, Ctrl, arrows, `|`, `~`; contents open); dictation and composed text as `input`, hardware keys as `key`, paste as `paste`; resize from panel size and font scale.
5. Transport: separate `/ws/term/:id` so terminal bursts never delay transcript frames; permessage-deflate, measure; fan out to all viewers, request a keyframe on join; any viewer may type.
6. Install: flake package (source or release binary) plus `WEBGUI_PTYZZZ_BIN`; no binary, no terminal button; version check at startup.
7. Theme: map the 16 palette vars to `tokens.css` (dark and light sets); CSS scoped under `.term`.
