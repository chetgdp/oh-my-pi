# omp webgui

A browser and phone front end for running omp sessions. It lists the omp processes running on your machine, streams their transcripts, sends prompts, and starts new sessions. You reach it from your phone over Tailscale. Typically best to use as a PWA via "add to homescreen", tested only on iOS.

## Requirements
Extremely hacky and designed to fit my personal workflow at the moment. I am currently trying to find a better solution for cloud sessions, shell sessions, other use cases, etc. For now ask your agent to make it fit your needs.

- [Bun](https://bun.sh)
- [Tailscale](https://tailscale.com) on the host machine and on each device you browse from. Turn on MagicDNS and HTTPS certificates for your tailnet (admin console → DNS).
- The `omp` from this fork on your `PATH` (or set `WEBGUI_OMP_BIN`). Upstream omp does not have the `rpc.serve` endpoint that the gui attaches to, nor `omp host start`, which the "launch session" and resume actions run to start a headless omp in the background.

## Setup

### Scripted setup

`bash packages/webgui/scripts/setup-server.sh` (from the repo root) performs steps 1 to 4 below idempotently: it checks for `bun` and `tailscale`, installs and links omp, sets `rpc.serve: true` in `~/.omp/agent/config.yml` (other keys kept), writes `WEBGUI_TAILNET=<your tailnet>` to `packages/webgui/.env` (gitignored, loaded by `bun run webgui`), builds the UI, runs `tailscale serve --bg 42049`, and prints the URL. It never uses funnel. Then start the daemon with `bun run webgui`.

### Manual setup

1. Clone and install, then link this fork's `omp`:

   ```sh
   git clone https://github.com/chetgdp/oh-my-pi.git
   cd oh-my-pi
   bun install
   bun --cwd=packages/coding-agent link
   ```

2. Let omp publish its sessions. Put this in `~/.omp/agent/config.yml`:

   ```yaml
   rpc:
     serve: true
   ```

   Only omp processes that start after this change publish. Restart any running sessions.

3. Build and start the server (it binds to `127.0.0.1:42049`):

   ```sh
   bun run webgui:build
   bun run webgui
   ```

4. Publish it on your tailnet:

   ```sh
   tailscale serve --bg 42049
   ```

   Open `https://<machine>.<tailnet>.ts.net` on your phone. `tailscale serve status` shows the URL. To remove it: `tailscale serve reset`.

5. Optional: check which omp hosts the gui can see:

   ```sh
   bun --cwd=packages/webgui run attach
   ```

## Multiple machines

Run the setup script on each machine that runs omp. In the client, open the servers button in the sessions header and add each machine's URL (`https://<machine>.<tailnet>.ts.net`). Sessions are grouped per server; launch and resume ask which server to use. The list is stored per browser in localStorage (`webgui.servers`). Set `WEBGUI_TAILNET` on every daemon (the script does) so only pages from your own tailnet can call it.

## Security

The webgui has **no login**. Anyone who can load the page can prompt your agents, and your agents can run shell commands as you.

- Tailscale is the only access control. The server accepts requests only for `localhost`, `127.0.0.1`, tailnet host names, and the names in `WEBGUI_ALLOWED_HOSTS`. With `WEBGUI_TAILNET` set, tailnet names must end in `.<WEBGUI_TAILNET>`; names from other tailnets get 403. Without it, any `*.ts.net` name is accepted. Set it.
- Cross-origin calls to `/api/*` and `/ws/*` are allowed only from trusted origins (same rule as the host check), so a client on one machine can talk to the daemons on your other machines. `/api/*` responses carry `Access-Control-Allow-Origin` for the caller's origin, without credentials. Untrusted origins get 403.
- **Never** use `tailscale funnel`. Funnel makes the site public on the internet.
- Do not share the host machine with other tailnets. Use tailnet ACLs to limit which devices can reach port 443 on the host.
- Do not set `HOST=0.0.0.0` unless you understand the result. That exposes the server to your whole LAN, and the host check is not authentication.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `42049` | Bind port. If you change it, change the `tailscale serve` port too. |
| `WEBGUI_ALLOWED_HOSTS` | (empty) | Extra trusted host names, comma-separated |
| `WEBGUI_TAILNET` | (empty) | Your tailnet DNS suffix without the leading dot, e.g. `tail1234.ts.net` (`tailscale status --json` shows it as `MagicDNSSuffix`). Restricts trust to that tailnet. Unset: any `*.ts.net` name is trusted. |
| `WEBGUI_OMP_BIN` | `omp` on `PATH` | omp executable used for launch and resume (`omp host start`) |

## Run it as a service

To keep the server running after logout, run `bun run webgui` from the repo root under launchd (macOS) or a systemd user unit (Linux). Do the `tailscale serve --bg` step once; Tailscale keeps that setting.

## Development

| Command (repo root) | Use |
|---|---|
| `bun run webgui:watch` | Rebuilds `dist/` on save and hot-reloads the server. Use this when you test on a phone. |
| `bun run webgui:dev` | In-memory bundling with HMR. On iOS the page reloads every time the app resumes, so use it on desktop only. |
| `bun --cwd=packages/webgui test` | Tests |
| `bun --cwd=packages/webgui run check` | Lint, format, and types |

`NOTES.md`, `PLAN.md`, and `HISTORY.md` are internal design notes.

## Troubleshooting

- **No sessions listed:** check that `rpc.serve` is `true` and that you restarted omp after you changed it. Confirm with `run attach`.
- **`403 forbidden host`:** you used an address that is not trusted. Use the `*.ts.net` URL, or add the name to `WEBGUI_ALLOWED_HOSTS`.
- **Certificate error on the `ts.net` URL:** HTTPS certificates are not turned on for your tailnet.
- **Launch or resume fails:** a 500 saying omp was not found means the server cannot find `omp` on its `PATH` (common under launchd or systemd); set `WEBGUI_OMP_BIN` to its absolute path. A 502 carries the stderr of `omp host start`; run `omp host start --cwd <dir>` in a terminal to see the same error.
