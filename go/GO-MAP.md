> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-MAP · Thu 29 Oct 2026, 19:00–20:00 UTC (20:00–21:00 CET)

**Status: GO** (stp, Tue 27 Oct 2026). Locked; changes go in `phase.log` as a deviation. Time: **START 19:00 UTC, END 20:00 UTC (20:00–21:00 CET), confirmed with PulseHawk 27 Oct** (moved +1 h after the freeze; see the dated change in [GO-MAP](GO-MAP.md#dated-changes)). All lanes GO: see the [lane table](README.md#lanes-and-status).

One page: who does what, and when. Each side has its own run sheet: [GO-BUILD.md](GO-BUILD.md) (desk PC), [GO-BOT.md](GO-BOT.md) (box), [GO-MINI.md](GO-MINI.md) (mini PC), [GO-KNS.md](GO-KNS.md) (KNS lane). Shared rules: [README.md](README.md). Columns: [LOGGING.md](LOGGING.md). Design: [plan/PLAN.md](../plan/PLAN.md). Detailed build and rehearsal: [tn10-covenant-contention-2026-10-29](https://github.com/STP-KAS/tn10-covenant-contention-2026-10-29).

PulseHawk (pulsehawk.io) counts the storm independently from its own nodes. Design inputs from PulseHawk ([pulsehawk.io](https://pulsehawk.io)): 5 attempts/s, parallel families as the headline, sender-off gaps, minute-3 counting, per-lane senders, post-END mempool watch, orphan definition, node-dead rule.

## Who does what

| Side | Machine | Node | Role on Thursday |
|---|---|---|---|
| **Mini** | Beelink SER5 Pro (mini PC) | kaspad 2.1.0 from tn10-run-kit, `--utxoindex` | **Main node + coordinator + sender `mini`** over localhost Borsh 17210, once synced |
| **Build** | stp's desk PC | desk kaspad 2.1.0 `--utxoindex` | Sender `desk`. **Chain reader + coordinator only if mini is not synced** (fallback) |
| **Bot** | the box (Linux) | none; public TN10 resolver nodes | ≤ 2 public senders (`muon` + `boson`; `vector` alternate only if it passes T-1h), outpoint self-discovery, public-node checks, logging, control watch; KNS lane via kns tn10 |
| **stp** | desk | — | Sends GO, holds the STOP switch, only contact with PulseHawk |
| **PulseHawk** | its own nodes | — | Counts the storm independently from its own nodes (through stp only) |

## Main-node decision (T-2h, 17:00 UTC)

- **Mini synced** (`check-node.ps1` shows Synced: True, coordinator reads its virtual chain): mini = main node, chain reader, coordinator. Desk = sender target only.
- **Mini not synced:** **desk node is chain reader + coordinator; mini only monitors** (no `mini` sender, no submits from the mini). Logged in `phase.log` as `MAIN node=desk reason=mini_not_synced`.
- Phase runs as long as at least two nodes are connected (PLAN.md).

## Timeline (UTC; CET = UTC+1)

| When (UTC) | CET | What |
|---|---|---|
| Wed 28 Oct 19:00 (T-24h) | 20:00 | All sides: node versions 2.1.0, testnet-10, synced; funding coins per lane checked; Windows Update active hours set on desk + mini |
| Thu 17:00 (T-2h) | 18:00 | Main-node decision (above). NTP rows for desk, mini, box in `ntp.csv` (also 18:55 and 20:01) |
| Thu 18:00 (T-1h) | 19:00 | Public-node check (version 2.1.0, network id testnet-10, mempool < 90,000, drop mirrors). Tag set written |
| Thu 18:30 | 19:30 | Genesis submits per family (4 families, each own key + launch path) |
| Thu 18:45 | 19:45 | Read-only `node-watch` starts on desk and mini (every 5 s, until 20:20); reads only, no effect on lanes |
| Thu 20:20 | 21:20 | node-watch continues as the recovery watch (`node-recovery-<desk|mini>.csv`) until both nodes are back; no mining on the mini until Fri 30 Oct |
| Thu **18:50** | 19:50 | Every genesis included on the main node's virtual chain |
| Thu 18:51 | 19:51 | **State handoff:** on the mini `node handoff.mjs export > handoff.json` (chain-public: covenant id, owner pubkey, minter outpoint; no keys); copy to desk + box run folders; there `node handoff.mjs import handoff.json` → `state/family-N.json`. Remote `--source self` senders idle until it is there |
| Thu 18:55 | 19:55 | Missing genesis → family dropped, logged. `control/STOP` confirmed absent on every side |
| **19:00:00 T0** | **20:00** | **Step 1: 1 family, 5 att/s per sender** |
| 19:15:00 | 20:15 | Gap: main sender OFF 5 min (no attempts) |
| 19:20:00 | 20:20 | Step 2: 2 families, 5 att/s |
| 19:35:00 | 20:35 | Gap: OFF 5 min |
| 19:40:00 | 20:40 | Step 3a: 4 families, 5 att/s |
| 19:55:00 | 20:55 | Step 3b: 4 families (hold), 5 att/s |
| **20:00:00 END** | **21:00** | Hard stop. Nothing new is built |
| 20:00–20:15 | 21:00–21:15 | Post-END mempool watch, `post-end-mempool.csv` |
| after 20:15 | after 21:15 | Counts, scan for keys/addresses/IPs/txids, push counts-only files to `logs/` |

**Counting:** from minute 3 of each 15-minute ON step: 19:03:00–19:14:59, 19:23:00–19:34:59, 19:43:00–19:59:59 UTC (3a+3b together: 17 counted of 20 minutes at 4 families). Clean minutes only (`sec.csv`).

## Abort / stop rules (all sides)

1. **STOP file** `control/STOP` in each run directory, or **hard END** 20:00:00.000Z, whichever first. No self-restart.
2. **Node-dead rule:** RPC failing, not synced, lag > 60 s, or DAA still 30 s → that sender stops. Failed submit = reject.
3. **90,000-mempool guard:** public name at ≥ 90,000 entries skipped for the rest of the phase.
4. **Network id** not `testnet-10` → abort connection.
5. **STALL:** mempool ack with no inclusion in 60 s (tested 27 Oct, pre-freeze change from 30 s) → coordinator writes STALL and stops.
6. **Shape mismatch** on output 0 → stop, don't guess.
7. Compute mass > 100,000 → do not submit.

## Open (to settle before the frozen plan)

Settled 26 Oct (details in [plan/PLAN.md](../plan/PLAN.md#lanes-and-senders-decided-26-oct)):

- **Lanes:** one sender per node tag (`desk`, `mini` if main, ≤ 2 public tags: `muon` + `boson`, `vector` alternate only if it passes the T-1h check); every lane contends on every live family at 5 att/s; own funding key per lane. Box check 2026-10-27: `muon` and `boson` usable and funded on own keys (1, 2); `vector` failed TLS connect from the box, alternate only if it passes T-1h.
- **Genesis:** the coordinator on the main node creates families 1–4; covenant ids private only.
- **Outpoint:** coordinator → desk/mini senders privately; box senders self-discover from their own node (`seen_utc` source=self). Desk coordinator takes over if the mini dies.
- **KNS lane:** in, as a background lane (`family=0`, sender `kns`, own minute file, not counted), 60 names/min from 19:03, off in gaps, node `muon` (spare `boson`), capped fee exception.
- **Mini:** decided at T−2h (synced → main).

## Dated changes

- 28 Oct 2026, after the freeze, stp's call: after END both private nodes are left alone to recover, with no mining on the mini until Fri 30 Oct around 20:30 UTC. From 20:20 UTC the same read-only node-watch writes to `logs/node-recovery-<desk|mini>.csv` (same header), every 5 s until a node counts as back, then every 60 s until mining starts. A node counts as back when it is synced, its mempool is at or below its 18:45 level, its kaspad CPU and RAM are within 10% of the 18:45 values, and all of this has held for 10 min. The recovery time for desk and mini is recorded in the post-END notes. Logging only; nothing changes in the run.
- 28 Oct 2026, after the freeze, at PulseHawk's request: `node-watch-desk.csv` and `node-watch-mini.csv` (UTC timestamps) are added to the files sent after END (see LOGGING.md), so a private-node stall inside a counted minute is marked, not dropped. Logging only; nothing changes in the run.

- 27 Oct 2026, after the freeze: added a read-only `node-watch` on desk and mini, every 5 s, 18:45–20:20 UTC Thursday, logging RPC latency, isSynced, peers, mempool, DAA score, kaspad CPU and RAM, and reachability to `logs/node-watch-<desk|mini>.csv`. It reads only and does not change senders, coordinator, rates or kaspad. Reason: a 27 Oct test saw both private nodes marked dead in the same second.

- 27 Oct 2026, after the 18:00 UTC freeze: START moved 18:00 -> 19:00 UTC (END 19:00 -> 20:00 UTC) at stp's request (his bot usage resets that day), agreed by PulseHawk the same evening (about 19:15 UTC). Covenant ids to PulseHawk by 18:55 UTC. PulseHawk counts 19:03:00–19:14:59, 19:23:00–19:34:59 and 19:43:00–19:59:59 UTC. Only times moved; tools, rates, lanes and families are unchanged and stay exactly as rehearsal 1027f.
