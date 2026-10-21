> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Kaspa Pulse (@gokugalax, kaspapulse.com): inputs to this plan

He counts our storms from the outside on his own two nodes. Contact goes through stp only; the bots never ping him.

Carried-over method from earlier storms ([tn-master inputs](https://github.com/STP-KAS/tn-master/blob/main/credits/KASPA-PULSE.md)): plan first and publish it; 10-minute baseline; fixed steps; saturation defined before T0; node-dead rule; chain count right after END before pruning; accepted-in-blocks on two independent nodes per UTC minute by block time; ~56 tx/s TN10 base load; NTP at start and end; raw data next to the summary.

| # | Date | Input | What we did | Where |
|---|---|---|---|---|
| 1 | 20–21 Oct 2026 | Read the 20 Oct rehearsal: one covenant chain ≈ one hop per inclusion time (~0.7 hops/s); extra attempts only raise orphans and already-spent | Adopted as the measured baseline (label A); stopped raising the attempt rate as the headline | [logs/REHEARSAL-2026-10-20.md](../logs/REHEARSAL-2026-10-20.md), [plan/PLAN.md](../plan/PLAN.md) |
| 2 | 21 Oct 2026 | Run contention only at the **5 attempts/s per sender** step (same winners, far fewer orphans) | Thursday rate fixed at 5/s; old 1/2/5/10 rising-attempt table dropped | [plan/PLAN.md](../plan/PLAN.md) |
| 3 | 21 Oct 2026 | Instead of raising attempts, run **1, then 2, then 4 covenant families in parallel**; headline = does total hop rate scale with families (parallel state on Kaspa) | Headline question of this storm; step table is families, not attempts | [README.md](../README.md), [plan/PLAN.md](../plan/PLAN.md), [plan/METRICS.md](../plan/METRICS.md) |
| 4 | 21 Oct 2026 | Keep the main sender **OFF for 5 minutes between steps** (see how fast the network clears) | Gaps in the phase table | [plan/PLAN.md](../plan/PLAN.md) |
| 5 | 21 Oct 2026 | **Count from minute 3** of each 15-minute step; **hold the top step for two phases** for clean peak minutes | Written into the counting rules | [plan/PLAN.md](../plan/PLAN.md), [go/README.md](../go/README.md) |
| 6 | 21 Oct 2026 | Give each app lane its **own sender address and target rate** so lanes stay separable | Per-lane sender rule | [plan/PLAN.md](../plan/PLAN.md), [go/README.md](../go/README.md) |
| 7 | 21 Oct 2026 | Watch the **mempool for 15 minutes after END** to see whether orphans clear | Post-END watch window and `post-end-mempool.csv` | [plan/PLAN.md](../plan/PLAN.md), [go/LOGGING.md](../go/LOGGING.md) |
| 8 | 21 Oct 2026 | Put our exact definition of **"orphan"** in the plan so both sides count the same | [docs/ORPHAN.md](../docs/ORPHAN.md) | [docs/ORPHAN.md](../docs/ORPHAN.md) |

The frozen plan is due Tue 27 Oct 2026, 18:00 UTC. We ask him to review this public repo and send advice before that lock; we do not lock his changes unilaterally.
