# Durable agent compute on WASM QuickJS

Status: idea. Nothing built. No measurements taken; every number below is cited or marked `[estimate]`.

[references]

Engines
- dquickts (QuickJS fork with durable execution): https://github.com/stencil-hq/dquickts
- QuickJS (Fabrice Bellard): https://bellard.org/quickjs/
- quickjs-ng: https://github.com/quickjs-ng/quickjs
- rquickjs (Rust bindings): https://github.com/DelSkayn/rquickjs
- quickjs-emscripten (QuickJS as WASM): https://github.com/justjake/quickjs-emscripten
- Javy (JS to WASM through QuickJS): https://github.com/bytecodealliance/javy
- Pyodide (CPython as WASM): https://pyodide.org/

WASM platform
- Wasmtime: https://github.com/bytecodealliance/wasmtime
- Wizer (memory snapshot pre-initializer): https://github.com/bytecodealliance/wizer
- Component model and WIT: https://component-model.bytecodealliance.org/
- JSPI proposal: https://github.com/WebAssembly/js-promise-integration
- WASM feature support table (JSPI row): https://webassembly.org/features/
- Emscripten Asyncify: https://emscripten.org/docs/porting/asyncify.html

Durable harnesses
- Pi Durable announcement: https://earendil.com/posts/pi-durable/
- Pi Durable README: https://github.com/earendil-works/pi/blob/main/packages/durable/README.md
- Pi Durable on Cloudflare Agents: https://developers.cloudflare.com/agents/harnesses/pi/
- omp2 ADR 0035, Rust for the engine: `git show upstream/omp2:docs/adr/0035-rust-for-the-engine.md`

JS runtimes
- Node.js: https://nodejs.org/
- Node.js PIE proposal, 2026: https://github.com/nodejs/node/issues/66951
- Node.js PIE discussion, 2020: https://github.com/nodejs/node/issues/33425
- Bun: https://bun.sh/
- Deno joins Cloudflare: https://deno.com/blog/cloudflare

## The thread, in the author's words

The idea arrived as a chain. Each quote is the author's wording with dictation and typing errors corrected; the line under it is the step it adds.

1. Runtime trust.
   > I think Node and Bun are fundamentally unserious projects though. Bun also disables PIE on Linux and FreeBSD, actually appalling.

   > I'm thinking more about JS runtimes as fundamentally unserious. I mean, how many CVEs via npm? Let me install some shit-ass package with other deps I have no idea about with sudo global... oops, I'm hacked.

   > It's about my information that I sent to some website that's maintained by some dinghist, and my phone number's on the internet. [...] It's not me. It's just the fact that I have to interact with the rest of the internet.

   The trusted computing base under agent code is too large and too careless.
2. Eval is the primitive.
   > Eval itself is one of the best primitives that omp has that other harnesses don't.
3. Durability.
   > Yes, this is a big deal for large agent swarms doing stuff mid-turn of the orchestrator, etc.
4. The engine.
   > The bigger thing: a WASM runtime instead of JS. We make a WASM QuickJS sandbox.
5. Why JavaScript, not any language.
   > If you use literally any language, then you are beholden to the way that language turns into bytecode. And for C and Rust, you have to compile it. And when you have to compile something, you have to have a compiler in bytecode, and it has to run instructions, and you need to have that somewhere, and then it's large, it's too big, and it just doesn't work. But when you have JavaScript run as WASM, then, now hold on: it can run on basically any device.

## Thesis

Keep JavaScript as the language agents write and run. Stop trusting JavaScript runtimes. Agent code runs in a small QuickJS engine compiled to WASM. A durable task layer owns it. A kernel's whole state is one linear memory, so a snapshot is a byte copy that resumes on any device running the same `.wasm`.

## Evidence for each link

| Link | Fact | Source |
|---|---|---|
| Runtime trust | Official Node.js glibc Linux binaries are not PIE. A 2020 discussion rejected PIE over an expected 5-10% cost. | node#66951 |
| Runtime trust | That proposal says a recent Critical CVE would likely have been High with PIE. | node#66951 |
| Runtime trust | Bun disables PIE on Linux and FreeBSD. | Author's claim, not verified here. On darwin arm64 both `bun` and `~/.bun/bin/omp` carry the `PIE` flag (`otool -hv`). |
| Runtime trust | Supply chain is a package-manager risk, not only a JS risk: this repo has 622 npm packages and 1064 Cargo packages. Cargo runs `build.rs` and proc macros unconditionally; Bun runs dependency lifecycle scripts only for trusted packages. | `bun.lock`, `cargo metadata` |
| Eval | omp's JS eval runs in Bun workers (`packages/coding-agent/src/eval/js/`). Globals persist across calls within a live worker only. `snapshotVmContext` copies only the safe user globals, for speculation. It does not suspend or persist execution. | upstream/main source |
| Durability | Pi Durable checkpoints every model call, tool call and compaction as a task, reruns tools only when they declare `replay: "safe"`, and makes submissions exactly-once with `requestId`. | Pi Durable post |
| Durability | omp loses the in-flight turn on a crash: no task checkpoints, no rerun safety, subagents and background jobs die with the process. | fork review, 2026-10-26 |
| Engine | dquickts adds suspension at safepoints, whole-heap snapshots (including a suspended call stack), incremental delta snapshots, and type erasure while parsing for TypeScript. A snapshot loads only into the build that wrote it. | dquickts README |
| Engine | quickjs-emscripten ships QuickJS as WASM. Its Asyncify variant is 2x the size and runs at 40% of the speed of the sync variant. | quickjs-emscripten docs |
| Engine | JSPI (WASM suspending on a JS promise) shows full support in Chrome 137, Firefox 153 and Safari 26 per the WebAssembly feature table. | webassembly.org/features |
| Engine | Wizer instantiates a module, runs its init, and writes the initialized memory out as a new module: memory snapshot as a build step. | bytecodealliance/wizer |
| Any language | omp2 chose Rust for its engine for agent-steering reasons, not raw speed, and bans JS as an extension runtime. | omp2 ADR 0035 |

## Data transformation

```text
cell source (JS/TS text)
  -> parse + erase types           (inside the guest; QuickJS bytecode)
  -> execute against heap          (guest linear memory)
  -> host call? suspend            (guest -> import -> durable task)
  -> result or suspension
  -> snapshot linear memory        (bytes, at turn boundary or suspension)
  -> commit snapshot + transcript entry atomically
```

### Output first: the snapshot

- One contiguous byte range: WASM linear memory plus the module's mutable globals and table state.
- Keyed by `(module_hash, conversation_id, entry_id)`. `module_hash` is the hash of the exact `.wasm`. A snapshot never loads into a different module.
- Stored next to the transcript entry that produced it, in the same commit. Fork copies the snapshot at the fork entry. Rewind selects the snapshot at the target entry.
- Deltas: linear memory only grows and WASM has no dirty-page tracking. Options: fixed-size chunks (64 KiB, the WASM page size) hashed and stored content-addressed, or dquickts's own `JS_SNAPSHOT_DELTA` written inside the guest. Choose after measuring.

### Input: the cell

- UTF-8 source text, bounded size.
- Capability set for this cell: which imports exist (tool bridge, fetch, file view). Default is none.

### Middle: the host boundary

- Every import is a durable task with a declared replay policy. The guest suspends and the host commits the call intent. Hours or a crash may follow. The host supplies the result and the guest resumes.
- Suspension mechanism, in order of preference: dquickts `JS_SuspendCall`/`JS_ResumeWith` if it builds to WASM; JSPI where the host is a browser or V8/JSC; Asyncify last (2x size, 40% speed per quickjs-emscripten).

## Platform

| Item | Value | Status |
|---|---|---|
| QuickJS `.wasm` size, sync release | about 1 MB | `[estimate]`, measure |
| CPython for WASI | tens of MB | `[estimate]` |
| Cell parse latency | microseconds to milliseconds | `[estimate]`, measure |
| Speed against Bun JIT | several times slower for compute; tool-bound cells unaffected | `[estimate]`, measure |
| Snapshot of a small REPL session | about 400 bytes as a dquickts delta | dquickts README |
| Hosts | browser (phone), Bun, Workers, Wasmtime | WASM portability |

Why not compiled languages as the guest: each cell needs compile, link and instantiate, and the toolchain becomes part of the runtime. State does not accumulate across cells without dynamic linking, which is immature in WASM. Compiled modules remain useful as reusable tools imported into the JS kernel, not as the REPL.

## Invariants

- A snapshot loads only into the module whose hash it records. Mismatch is an error, not a fallback.
- The guest has no ambient authority. Every effect crosses an import, and every import is a recorded task.
- A host call with replay policy `unsafe` is never rerun after a crash. The guest receives an interrupted result.
- Snapshot and transcript entry commit together or not at all.
- Memory is bounded per kernel. Exceeding it is an operational error surfaced to the model, not a host crash.
- Fuel or an interrupt handler bounds every cell. No unbounded guest loop holds a host thread.

## Failure modes

- C bugs inside QuickJS: contained to guest memory, but a snapshot preserves corruption. Restore from the previous entry's snapshot.
- Module upgrade invalidates all snapshots. Recovery is replaying the cells from the transcript into a fresh instance; cells with unsafe host calls cannot be replayed blindly.
- Snapshot growth: linear memory never shrinks. Needs a compaction path (replay into a fresh instance).

## Open questions

1. Where it lives: omp's eval backend, the execution environment of a durable engine (Pi Durable or our own), or a swarm runtime using both.
2. Does dquickts build to WASM with its snapshot and suspension intact.
3. Snapshot unit: raw linear memory (engine-agnostic) or dquickts's own snapshot format (smaller, engine-specific).
4. Durable layer: adopt Pi Durable under the existing `omp host`/webgui, or build checkpointed tasks into omp's turn loop.
5. Swarm scheduling: moving a kernel snapshot between devices mid-run, and who owns a kernel during the move.

## First measurements, before any design commitment

1. Build QuickJS sync release to WASM; record `.wasm` size and instantiate time on Bun and in mobile Safari.
2. Snapshot linear memory after N representative eval cells taken from real omp sessions; record raw and chunk-deduplicated sizes.
3. Try dquickts under `wasm32-wasi`; record whether suspension and snapshot survive.
4. Time one tool-bridge round trip across the import boundary with JSPI and with Asyncify.
