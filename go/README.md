> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# GO · shared rules

**NOT ARMED until stp sends GO.** The drop gate is already met (20 Oct rehearsal, label A). Frozen plan due Tue 27 Oct 2026, 18:00 UTC.

## Run sheets

| File | Side |
|---|---|
| [GO-MAP.md](GO-MAP.md) | Overview, timeline, main-node decision, abort rules |
| [GO-BUILD.md](GO-BUILD.md) | Build on the desk PC |
| [GO-BOT.md](GO-BOT.md) | Grok Bot on the box (public nodes) |
| [GO-MINI.md](GO-MINI.md) | Mini PC main node |

## Single clock

| | UTC | Brussels (CET) |
|---|---|---|
| T0 / START | Thu 29 Oct 2026, 18:00 | 19:00 |
| END | Thu 29 Oct 2026, 19:00 | 20:00 |
| Post-END watch | 19:00–19:15 | 20:00–20:15 |

No new attempt is built at or after END.

## Roles

| Role | Does |
|---|---|
| **Coordinator** | Watches the main node's virtual chain; publishes the current outpoint per family; writes `phase.log`; enforces STALL (30 s) and STOP / END |
| **Senders** | One process per node tag (`desk`, `mini`, public names). Each holds its own funding coins. Token bucket at 5 attempts/s during ON steps; nothing during gaps |
| **Chain reader** | Main node (mini PC when synced; desk until then). Source of winners and hops |
| **PulseHawk** | Counts the storm independently from its own nodes. Contact through stp only |

## Rules carried over (do not change without a logged deviation)

1. **Node-dead rule** (PulseHawk). A sender stops when its node is dead: RPC failing, not synced, lag over 60 s, or DAA score still for 30 s. A failed submit is a reject, never "sent".
2. **90,000-mempool public-node guard.** A public name at or above 90,000 mempool entries is skipped for the rest of the phase.
3. **Network id.** Every connection aborts unless the network id is `testnet-10`.
4. **Follow output 0.** Advance only after virtual-chain inclusion of a hop whose output 0 has a covenant binding and the same KAS value. Shape mismatch = stop.
5. **No child before parent.** Builder never submits a child before its parent is included. STALL at 30 s with no inclusion.
6. **STOP file + hard END.** `control/STOP` or END, whichever first. No self-restart.
7. **Fee.** One fee rate for every sender, from the main node's normal bucket, floored at 100 sompi/g. Relay fee = rate × max(compute mass, ceil(transient mass / 2)).
8. **Counts only in git.** No key, seed, address, IP or transaction id in this repo. `submit.jsonl` stays on disk.
9. **Per-lane sender.** Each app lane has its own sender address and target rate.
10. **Count from minute 3** of each 15-minute ON step. Hold the top step (4 families) across 3a and 3b.

## How GO works

Once stp sends a GO it is locked. Sending means: be ready at T0 with every required genesis included, the tag set written, NTP checked, and the STOP file absent. Logging columns: [LOGGING.md](LOGGING.md). Phase design: [plan/PLAN.md](../plan/PLAN.md).
