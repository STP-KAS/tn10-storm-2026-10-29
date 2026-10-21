> **DRAFT - basics only.** Locked after Kaspa Pulse reviews the repo and the mini PC node is live and synced; frozen plan due Tue 27 Oct 18:00 UTC.
>
> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-MAP · Thu 29 Oct 2026, 18:00–19:00 UTC (19:00–20:00 CET)

One page: who does what, and when. Each side has its own run sheet: [GO-BUILD.md](GO-BUILD.md) (desk PC), [GO-BOT.md](GO-BOT.md) (box), [GO-MINI.md](GO-MINI.md) (mini PC). Shared rules: [README.md](README.md). Columns: [LOGGING.md](LOGGING.md). Design: [plan/PLAN.md](../plan/PLAN.md). Detailed build and rehearsal: [tn10-covenant-contention-2026-10-29](https://github.com/STP-KAS/tn10-covenant-contention-2026-10-29).

Design inputs from Kaspa Pulse ([@gokugalax](https://x.com/gokugalax), [kaspapulse.com](https://kaspapulse.com)): 5 attempts/s, parallel families as the headline, sender-off gaps, minute-3 counting, per-lane senders, post-END mempool watch, orphan definition, node-dead rule.

## Who does what

| Side | Machine | Node | Role on Thursday |
|---|---|---|---|
| **Mini** | Beelink SER5 Pro (mini PC) | kaspad 2.1.0 from tn10-run-kit, `--utxoindex` | **Main node + coordinator + sender `mini`** over localhost Borsh 17210, once synced |
| **Build** | stp's desk PC | desk kaspad 2.1.0 `--utxoindex` | Sender `desk`. **Chain reader + coordinator only if mini is not synced** (fallback) |
| **Bot** | the box (Linux) | none; public TN10 resolver nodes | Senders tagged per public name (`muon`, `boson`, …), public-node checks, logging, control watch |
| **stp** | desk | — | Sends GO, holds the STOP switch, only contact with Kaspa Pulse |
| **Kaspa Pulse** | his own two nodes | — | Independent accepted-in-blocks count (through stp only) |

## Main-node decision (T-2h, 16:00 UTC)

- **Mini synced** (`check-node.ps1` shows Synced: True, coordinator reads its virtual chain): mini = main node, chain reader, coordinator. Desk = sender target only.
- **Mini not synced:** **desk node is chain reader + coordinator; mini only monitors** (no `mini` sender, no submits from the mini). Logged in `phase.log` as `MAIN node=desk reason=mini_not_synced`.
- Phase runs as long as at least two nodes are connected (PLAN.md).

## Timeline (UTC; CET = UTC+1)

| When (UTC) | CET | What |
|---|---|---|
| Wed 28 Oct 18:00 (T-24h) | 19:00 | All sides: node versions 2.1.0, testnet-10, synced; funding coins per lane checked; Windows Update active hours set on desk + mini |
| Thu 16:00 (T-2h) | 17:00 | Main-node decision (above). NTP check on all three machines (`ntp` line in phase.log) |
| Thu 17:00 (T-1h) | 18:00 | Public-node check (version 2.1.0, network id testnet-10, mempool < 90,000, drop mirrors). Tag set written |
| Thu 17:30 | 18:30 | Genesis submits per family (4 families, each own key + launch path) |
| Thu **17:50** | 18:50 | Every genesis included on the main node's virtual chain |
| Thu 17:55 | 18:55 | Missing genesis → family dropped, logged. `control/STOP` confirmed absent on every side |
| **18:00:00 T0** | **19:00** | **Step 1: 1 family, 5 att/s per sender** |
| 18:15:00 | 19:15 | Gap: main sender OFF 5 min (no attempts) |
| 18:20:00 | 19:20 | Step 2: 2 families, 5 att/s |
| 18:35:00 | 19:35 | Gap: OFF 5 min |
| 18:40:00 | 19:40 | Step 3a: 4 families, 5 att/s |
| 18:55:00 | 19:55 | Step 3b: 4 families (hold), 5 att/s |
| **19:00:00 END** | **20:00** | Hard stop. Nothing new is built |
| 19:00–19:15 | 20:00–20:15 | Post-END mempool watch, `post-end-mempool.csv` |
| after 19:15 | after 20:15 | Counts, scan for keys/addresses/IPs/txids, push counts-only files to `logs/` |

**Counting:** from minute 3 of each 15-minute ON step (18:03, 18:23, 18:43). 3a+3b give 20 minutes at 4 families.

## Abort / stop rules (all sides)

1. **STOP file** `control/STOP` in each run directory, or **hard END** 19:00:00.000Z, whichever first. No self-restart.
2. **Node-dead rule:** RPC failing, not synced, lag > 60 s, or DAA still 30 s → that sender stops. Failed submit = reject.
3. **90,000-mempool guard:** public name at ≥ 90,000 entries skipped for the rest of the phase.
4. **Network id** not `testnet-10` → abort connection.
5. **STALL:** mempool ack with no inclusion in 30 s → coordinator writes STALL and stops.
6. **Shape mismatch** on output 0 → stop, don't guess.
7. Compute mass > 100,000 → do not submit.

## Open (to settle before the frozen plan)

- TODO: which sender holds which lane/family (per-lane address + rate table).
- TODO: how the coordinator on the mini publishes the current outpoint to desk and box senders (no public RPC; transport not chosen yet).
- TODO: KNS lane: in or out on Thursday; if in, its own sender and rate.
- TODO: mini PC sync status (unknown until Build reports).
