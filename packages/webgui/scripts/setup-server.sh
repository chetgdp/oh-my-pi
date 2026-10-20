#!/usr/bin/env bash
# One-shot, idempotent setup of a webgui daemon on this machine.
# Run from the repo root of a fresh clone: bash packages/webgui/scripts/setup-server.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

for cmd in bun tailscale; do
	if ! command -v "$cmd" >/dev/null 2>&1; then
		echo "error: '$cmd' not found on PATH. Install it and re-run." >&2
		exit 1
	fi
done

bun install
bun --cwd=packages/coding-agent link

# Never rewrite an existing config: it may hold hand-written comments.
# Only create it, or append an rpc block when no rpc key exists.
config_file="${HOME}/.omp/agent/config.yml"
mkdir -p "$(dirname "$config_file")"
CONFIG_FILE="$config_file" bun -e '
const path = process.env.CONFIG_FILE;
let text = "";
try {
	text = await Bun.file(path).text();
} catch (err) {
	if (err?.code !== "ENOENT") throw err;
}
const parsed = text.trim() ? Bun.YAML.parse(text) : {};
if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
	console.error(`error: ${path} is not a YAML map; set rpc.serve: true by hand`);
	process.exit(1);
}
if (parsed.rpc?.serve === true) process.exit(0);
if (parsed.rpc !== undefined) {
	console.error(`error: ${path} has an rpc key without serve: true; set rpc.serve: true by hand`);
	process.exit(1);
}
const sep = text === "" || text.endsWith("\n") ? "" : "\n";
await Bun.write(path, `${text}${sep}rpc:\n  serve: true\n`);
'

status_json="$(tailscale status --json)"
read_status() {
	STATUS_JSON="$status_json" bun -e "const s = JSON.parse(process.env.STATUS_JSON); process.stdout.write(String($1 ?? \"\"));"
}
tailnet="$(read_status 's.MagicDNSSuffix')"
dns_name="$(read_status 's.Self?.DNSName')"
dns_name="${dns_name%.}"
if [[ -z "$tailnet" || -z "$dns_name" ]]; then
	echo "error: tailscale status has no MagicDNSSuffix/DNSName. Is MagicDNS enabled and tailscale up?" >&2
	exit 1
fi

# `bun run webgui` runs with cwd packages/webgui, so Bun auto-loads packages/webgui/.env (gitignored).
env_file="packages/webgui/.env"
touch "$env_file"
if grep -q '^WEBGUI_TAILNET=' "$env_file"; then
	tmp="$(mktemp)"
	grep -v '^WEBGUI_TAILNET=' "$env_file" >"$tmp" || true
	cat "$tmp" >"$env_file"
	rm -f "$tmp"
fi
echo "WEBGUI_TAILNET=${tailnet}" >>"$env_file"

bun run webgui:build

# serve only (tailnet-private). Never funnel: it would make the UI public.
tailscale serve --bg 42049

echo
echo "webgui URL: https://${dns_name}"
echo "Start the daemon with: bun run webgui"
