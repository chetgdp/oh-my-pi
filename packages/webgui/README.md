# omp webgui

A browser and phone front end for running omp sessions. It lists the omp processes running on your machine, streams their transcripts, sends prompts, and starts new sessions. You reach it from your phone over Tailscale. Typically best to use as a PWA via "add to homescreen", tested only on iOS.

## Requirements
Extremely hacky and designed to fit my personal workflow at the moment. I am currently trying to find a better solution for cloud sessions, shell sessions, other use cases, etc. For now ask your agent to make it fit your needs if you don't use any of these, especially fish for example.

- [Bun](https://bun.sh)
- [Tailscale](https://tailscale.com) on the host machine and on each device you browse from. Turn on MagicDNS and HTTPS certificates for your tailnet (admin console → DNS).
- `tmux` and `fish` on the host. The "launch session" action opens omp in a hidden `ompgui` tmux session through fish.
- The `omp` from this fork on your `PATH`. Upstream omp does not have the `rpc.serve` endpoint that the gui attaches to.

## Setup

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

## Security

The webgui has **no login**. Anyone who can load the page can prompt your agents, and your agents can run shell commands as you.

- Tailscale is the only access control. The server accepts requests only for `localhost`, `127.0.0.1`, `*.ts.net` host names, and the names in `WEBGUI_ALLOWED_HOSTS`.
- **Never** use `tailscale funnel`. Funnel makes the site public on the internet.
- Do not share the host machine with other tailnets. Use tailnet ACLs to limit which devices can reach port 443 on the host.
- Do not set `HOST=0.0.0.0` unless you understand the result. That exposes the server to your whole LAN, and the host check is not authentication.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `42049` | Bind port. If you change it, change the `tailscale serve` port too. |
| `WEBGUI_ALLOWED_HOSTS` | (empty) | Extra trusted host names, comma-separated |

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
- **Launch does nothing:** the server cannot find `tmux`, `fish`, or `omp` on its `PATH`. This happens a lot under launchd or systemd.
