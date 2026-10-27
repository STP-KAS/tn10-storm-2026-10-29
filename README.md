> **Experimental. We are just trying this.** [Disclaimer](DISCLAIMER.md) · Kaspa Testnet-10 only; tKAS has no value. Mainnet: **not tested (label B)**.
>
> **Part of [tn-master](https://github.com/STP-KAS/tn-master)**, the map of every TN10 storm. Named by the [11 Oct naming rule](https://github.com/STP-KAS/tn-master/blob/main/repos/INDEX.md): `tn10-storm-YYYY-MM-DD`.

# tn10-storm-2026-10-29 · Thu 29 Oct, 18:00-19:00 UTC (19:00-20:00 CET): covenant contention, 1 → 2 → 4 families

**History of every storm: [MASTER.md](https://github.com/STP-KAS/tn-master/blob/main/history/MASTER.md)** (in tn-master).

**Companion repo: [tn10-covenant-contention-2026-10-29](https://github.com/STP-KAS/tn10-covenant-contention-2026-10-29).** The detailed covenant-contention build, the 20 Oct desk rehearsal and the full plan procedure live there; this repo is the standardized storm record and public summary.

**Thank you first to PulseHawk ([pulsehawk.io](https://pulsehawk.io)), independent measurement.** He reviewed our 20 Oct rehearsal and proposed the Thursday design: contention at 5 attempts/s only, parallel covenant families as the headline, sender-off gaps, minute-3 counting, per-lane senders, a post-END mempool watch and a written orphan definition. Every input: [credits/KASPA-PULSE.md](credits/KASPA-PULSE.md).

## Start, end, gate

Times are UTC first. Brussels moved from CEST (UTC+2) to CET (UTC+1) on Sun 25 Oct 2026, so 27 Oct and 29 Oct are CET.

| | UTC | Brussels (CET) |
|---|---|---|
| **Drop gate** | Tue 27 Oct 2026, 18:00 | 19:00 |
| **START (T0)** | Thu 29 Oct 2026, 18:00 | 19:00 |
| **END** | Thu 29 Oct 2026, 19:00 | 20:00 |
| **Post-END mempool watch** | 19:00 to 19:15 | 20:00 to 20:15 |

**Drop gate: already met (label A).** The 20 Oct desk rehearsal put a fresh genesis, 1,287 included hops and 68,644 already-spent conflict rejects on Testnet-10, read back from the desk node's virtual chain. Thursday stays on the clock above. Detail: [logs/REHEARSAL-2026-10-20.md](logs/REHEARSAL-2026-10-20.md).

## What and why

**What.** Several senders race to spend one covenant state output at the same time. Only one spend can win each hop. The next hop spends the output that winner created. The phase measures winners included on the virtual chain, conflict rejects, time from submit to inclusion (winners only), and state hops. Attempt rate and hop rate are different: extra attempts lose; they do not create extra hops.

**Headline question (suggested by PulseHawk).** Does total hop rate scale with the number of covenant families run in parallel? Thursday runs **1, then 2, then 4 families** at a fixed **5 attempts/s per sender**, with the main sender off for 5 minutes between steps. That replaces the old rising-attempt step table (1/2/5/10).

**Why.** The 20 Oct rehearsal (label A) showed one covenant chain moves at about one hop per inclusion time, roughly **0.7 hops/s**, no matter how hard we hit it. Raising attempts from 5 to 20/s per sender raised already-spent and orphan rejects; it did not raise the hop rate. Parallel families are the next countable question.

Kaspa Testnet-10 only. KCC-20 is **Last Call, moving to Final** ([kaspanet/kccs#41](https://github.com/kaspanet/kccs/pull/41)). This is a measurement of covenant state, not a token launch. tKAS has no value.

## Map

| Folder or file | What is in it |
|---|---|
| [DISCLAIMER.md](DISCLAIMER.md) | Experimental; certainty labels A / B / C |
| [docs/BACKGROUND.md](docs/BACKGROUND.md) | What a covenant hop is, in plain words; follow-output-0; why #1152 is not needed |
| [docs/ORPHAN.md](docs/ORPHAN.md) | Exact shared definition of "orphan" so both sides count the same |
| [plan/PLAN.md](plan/PLAN.md) | Thursday phase design: families, rates, gaps, counting rules, nodes, stop |
| [plan/METRICS.md](plan/METRICS.md) | What to measure and how; compare with PulseHawk's block count |
| [go/README.md](go/README.md) | Shared rules, the single clock (T0), roles, how GO works |
| [go/LOGGING.md](go/LOGGING.md) | Every log file and column |
| [go/GO-MAP.md](go/GO-MAP.md) | GO overview: who does what, timeline, abort rules |
| [go/GO-BUILD.md](go/GO-BUILD.md) | GO run sheet: Build, desk PC |
| [go/GO-BOT.md](go/GO-BOT.md) | GO run sheet: Grok Bot, public nodes |
| [go/GO-MINI.md](go/GO-MINI.md) | GO run sheet: mini PC main node |
| [logs/](logs/README.md) | Rehearsal baseline now; Thursday results after END |
| [logs/REHEARSAL-2026-10-20.md](logs/REHEARSAL-2026-10-20.md) | Desk rehearsal report (gate evidence, label A) |
| [logs/rehearsal-2026-10-20.csv](logs/rehearsal-2026-10-20.csv) | Per-minute counts from the rehearsal (counts only) |
| [credits/KASPA-PULSE.md](credits/KASPA-PULSE.md) | Every input from PulseHawk (pulsehawk.io) |

## Results

**Rehearsal (20 Oct, desk, label A):** sent 83,306 · mempool accepts / winners / hops 1,287 · already-spent 68,644 · orphan 13,375 · include p50 1,047 ms / p95 2,021 ms · ~0.7 hops/s. Full write-up: [logs/REHEARSAL-2026-10-20.md](logs/REHEARSAL-2026-10-20.md).

**Thursday 29 Oct:** placeholder. After END the chain count, minute sheet and write-up land under [logs/](logs/README.md).

Counts only: no txid, key, seed, IP, host, port or wallet address in this repo.

---

Si vis pacem, para bellum.
