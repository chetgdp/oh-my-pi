# omp-install: compiled omp on PATH

Two `omp` commands exist on this machine:

| Command | Runs | Used by |
|---|---|---|
| fish function `omp` (`~/.config/fish/functions/omp.fish`) | source, `bun packages/coding-agent/src/cli.ts --allow-home` | the user in a terminal |
| `~/.bun/bin/omp` | compiled binary from `packages/coding-agent/dist/omp` | `omp-shell` (`? /n`, `? /r`) and the webgui daemon, which spawn `omp` from PATH and never see fish functions |

The compiled binary is what users run, so hosts started by `?` and the webgui test the shipped artifact (compiled-only bugs: #1011, #1027, embedded native addon stamps). The cost is drift: after host or protocol changes, PATH `omp` is stale until it is reinstalled. Symptom: `omp-shell: host <id> runs an omp build without attach_shell`, or any `Unknown command` from a host.

## `omp-install`

Fish function at `~/.config/fish/functions/omp-install.fish`. `omp-update` calls it after `bun install` and before the fingerprint test, so every update also installs a fresh binary.

1. Rebuilds `packages/natives` when native sources (`crates`, `Cargo.*`, `rust-toolchain.toml`) or `packages/natives/package.json` changed since the last install, or are dirty. The binary build refuses an addon without the version stamp of that package version, so a version bump alone forces a rebuild. `omp-update` has no natives step of its own; this one covers it.
2. Runs `bun --cwd=packages/coding-agent run build`.
3. Copies `dist/omp` to `~/.bun/bin/omp`; the previous binary is kept as `~/.bun/bin/omp.prev`.
4. Records the installed commit in `~/.omp/omp-install.rev`.
5. Lists running hosts (`omp host run`) that still use the old binary; they keep it until restarted.

Run it by hand after changes to `packages/coding-agent` (host, RPC, tools). Changes to `packages/shell` need no install: `omp-shell` is `bun link`ed and runs from source.

## Hazard: never overwrite the binary in place

`cp dist/omp ~/.bun/bin/omp` over an existing file keeps its inode, and macOS then kills the new binary at launch (exit 137, SIGKILL; `codesign -v` still passes). `omp-shell` reports this as `omp host start failed (137)`. `omp-install` moves the old binary to `omp.prev` and copies to a new inode. To fix by hand: `rm ~/.bun/bin/omp && cp packages/coding-agent/dist/omp ~/.bun/bin/omp`.
