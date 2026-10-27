# tools/storm — TN10 covenant-contention kit

Node 22+ (native WebSocket) or Node 20 + a `websocket` module, Kaspa WASM SDK 2.1.0, and the `kcc20 storm` builder (see [builder/](builder/)).

| File | Role |
|---|---|
| `lib.mjs` | config (`STORM_CONFIG`), phase log, schedule, reject tokens, state files |
| `covenant.mjs` | talks to the builder (via the broker), materializes wasm txs, funding pool, catch-up |
| `builder-broker.mjs` | one `kcc20 storm` process; clients on `127.0.0.1:17310` |
| `coordinator.mjs` | genesis + follow minter; `--takeover` resumes from state |
| `sender.mjs --label --node [--source coord\|self] [--key N]` | real hop; `source=self` discovers the outpoint from this sender's own node |
| `health.mjs` | abort watch: lag >10 DAA, RAM, disk <50 GB, rpc rejects |
| `aggregate.mjs` | `sec.csv` / `minute.csv` + checks |
| `fund-split.mjs` | pre-split a key into N coins of ~16 tKAS (never prints the key) |
| `kns-lane.mjs` | family=0 background lane (60/min, max 16 in flight, 1.5× fee capped 1 tKAS, pause not escalate). **Does not start live** without `--armed` after stp GO |
| `cycle.ps1` | repeated dry runs with coordinator failover |

## Dry runs (counts only)

**Stand-in hop (26 Oct):** 5 cycles, failover each time, 0 equality failures — see earlier note in git history.

**Real covenant hop (27 Oct, desk, rusty-kaspa 2.1.0):**
- One family genesis (`launch::storm-2026-10-29-f1b`) included; then 120 s at 1 att/s.
- sent 117, ok 69, already_spent 37, orphan 11, fee/mass/rpc 0.
- hops 68 with seen+header; include p50 1150 ms, p95 1691 ms; sec.csv 160/160; END clean.
- `source=self` check: 75 s, hops 43, same reject shape, source stamped `self`.
- Takeover / self tip-follow: `catchUp` walks live nextSpk UTXOs when possible; if intermediates are already spent it **tip-finds** (virtual nextSpk walk + batched `getUtxosByAddresses`) so a desk `--takeover` resumes from the chain tip, not a stale state pack.

Bug found: two `kcc20 storm` processes cannot open `build/public-mint` on Windows (Access denied). Fixed with `builder-broker.mjs`.

`private/` (txids, covenant ids) stays local. Only counts-only logs are shareable after a scan.

## Mini→desk failover (27 Oct, real hop)

- **failover-3:** mini main step 1 → pack state at seq=0 → kill mini storm at gap → desk `--takeover` tip-find **from_seq=0 to_seq=41** → desk-only step 2: sent 40, **ok 25**, orphan 2, already_spent 13; hops 24; final seq 65; STOP END. Kaspad left running on both PCs.
- Tip-follow: `catchUp` + tip-find (virtual nextSpk walk) so stale state packs resume from the live minter on the local node.
