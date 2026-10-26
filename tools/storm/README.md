# tools/storm: coordinator, sender, aggregator (TN10 only)

Scripts for the 29 Oct covenant-contention storm. Node 22+ (native WebSocket) and the Kaspa WASM SDK (nodejs build, v2.1.0).
They never hold keys: the dry-run hop is a keyless anyone-can-spend stand-in (`P2SH(<lane id> OP_DROP OP_TRUE)`, 1-in-1-out).
The real covenant hop builder replaces `buildHop()` in `lib.mjs`.

| File | Role |
|---|---|
| `lib.mjs` | config (`STORM_CONFIG` or `./config.json`), phase log, schedule, hop builder, reject-reason tokens, state files |
| `coordinator.mjs` | GENESIS / FAMILY_DROP at the family check, MINER, START, STEP, GAP_START/GAP_END, STALL, STOP; detects hops and writes the current outpoint per family to `state/`. `--takeover --label <node> --reason <why>` resumes on a second machine from the chain (newest lane UTXO) and logs `MAIN` |
| `sender.mjs --label <name> --node <wrpc url>` | spends only the published outpoint at the step rate; SENDER_OFF/ON, NODE_SKIP, NODE_DROP |
| `health.mjs` | abort watch every 10 s: node lag > 10 DAA vs a reference node (3 reads), free RAM < 2 GB, free disk < 50 GB, > 20 rpc rejects → `control/STOP` + `control/ABORT` |
| `aggregate.mjs` | merges submits into `private/submit.jsonl`, writes `logs/sec.csv` and `logs/minute.csv`, prints checks |
| `cycle.ps1` | repeated dry runs: fresh family pair per cycle, coordinator kill + takeover in step 2, aggregate per cycle |

Setup: copy the scripts and the SDK to `<your-folder>\tn10-storm-kit`, copy `config.example.json` to the run folder as `config.json`, fill lane ids and times.
Run: `node coordinator.mjs`, then one `node sender.mjs` per sender; afterwards `node aggregate.mjs`.

`private/` holds txids and stays local. Only `logs/` (counts, times) is meant to be shared.

## Dry run 26 Oct (desk node, keyless stand-in hop, counts only)

5 cycles, each with a fresh family pair, a 90 s step 1, a 30 s gap, a 120 s step 2, and a coordinator kill + `--takeover` 40 s into step 2. Cycles 1–2 ran at 1 att/s per family and cycles 3–5 at 5 att/s.
In every cycle: 0 equality failures, sec.csv 270/270 rows, no STALL, MAIN and STOP logged after the takeover, and 0 fee/mass/rpc rejects.
Include p50 1.17–1.24 s and p95 1.83–1.95 s. Node lag vs the reference node was ≤ 4 DAA, and the abort rules never fired.
Bug found and fixed: on Windows, renaming the state file fails with EPERM while a sender is reading it, which crashed the takeover coordinator. `writeState` now retries.
