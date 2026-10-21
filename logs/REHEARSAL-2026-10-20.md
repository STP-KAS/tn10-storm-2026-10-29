> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Desk rehearsal, 20 Oct 2026 (label A)

Testnet-10 only. One desk node, rusty-kaspa 2.1.0, utxoindex on, default ram-scale. The node process was already running and was not restarted. All four senders used that node's Borsh socket. Public wRPC was not used. The mini PC was not in this run.

This is the gate for the Thursday 29 Oct phase. It is not that phase. The Thursday clock in [plan/PLAN.md](../plan/PLAN.md) is unchanged.

## What ran

A new covenant family on a new launch path. Mint amount 1, limit 1, starting remaining 100,000. Minter output a few KAS, copied forward. Fee rate 200 sompi per gram on every sender.

An earlier genesis the same hour was included, then left idle. Its token output was 0.05 KAS. The builder measured storage mass 803,963. The block storage limit is 500,000. The token script has plurality 2, so storage mass is dominated by that output. The measured run raised the token output to 0.2 KAS. Storage mass then fit, and every later hop used that value.

Genesis for the measured run was included at 2026-10-20T18:03:17.543Z, 1,301 ms after submit. The rate clock started at that second and stopped on END at 2026-10-20T18:33:33.338Z, including the 15 s grace. Steps were 5, 10, then 20 attempts per second per sender, 10 minutes each. Four senders. Same fee. Attempts in a second were shuffled. The follower advanced only when the virtual chain accepted a hop.

## Totals

| | |
|---|---|
| Sent | 83,306 |
| Mempool accepts | 1,287 |
| Winners | 1,287 |
| State hops | 1,287 |
| Already spent | 68,644 |
| Orphan | 13,375 |
| Fee, mass, mempool-full, route, rpc, other | 0 |
| Include p50 | 1,047 ms |
| Include p95 | 2,021 ms |
| Stop | END |

Every mempool accept in this window was included. Winners and hops are the same count.

Per-minute rows can disagree with that equality by one. Inclusion is counted in the minute the virtual chain reports it, and the grace window closed inside 18:33. The step-5 rows sum to 396 accepts and 395 winners. The step-20 rows, which include the grace minute, sum to 463 accepts and 464 winners. The run totals match.

## By step

| Step | Minute rows | Sent | Accepts | Winners | Already spent | Orphan |
|---|---|---|---|---|---|---|
| 5/s per sender | 10 | 11,566 | 396 | 395 | 9,650 | 1,520 |
| 10/s per sender | 10 | 23,460 | 428 | 428 | 19,292 | 3,740 |
| 20/s per sender | 11 | 48,280 | 463 | 464 | 39,702 | 8,115 |

The 20/s figure has 11 rows because the grace flush is a short 18:33 row still labeled 20. The rate itself ran for 10 minutes.

Full minutes landed on the attempt target: about 1,200, 2,400, and 4,800 submits. A few minutes are 20 to 80 submits short where the wall-clock second rolled over mid-batch.

Winners stayed near 40 to 46 per full minute at every step. The 20/s minutes reached 51 once. Include p50 stayed near 1.0 to 1.1 s. The 18:05 minute was the exception, at 2,007 ms. Include p95 stayed near 2.0 s in every minute.

**Raising the attempt rate raised already-spent and orphan rejects. It did not raise the hop rate.** One follower that waits for virtual-chain inclusion moves about as fast as that inclusion time. On this desk that was about **0.7 hops per second**, while Testnet-10 produces 10 blocks per second.

Orphans were 13% of step-5 submits, 16% of step-10 submits, and 17% of step-20 submits. The rest of the non-winners were already-spent. No minute recorded a fee, mass, mempool-full, route, rpc, or other reject.

The minute sheet is [rehearsal-2026-10-20.csv](rehearsal-2026-10-20.csv).

## Gate

A fresh genesis, included hops, and conflict rejects are on Testnet-10 before Tue 27 Oct 2026 18:00 UTC. The Thursday phase stays on the clock in [plan/PLAN.md](../plan/PLAN.md).

## Left out of this repo

Keys, seeds, addresses, IPs, and transaction ids. The submit log stayed on the desk. The builder change stayed off other repositories. No tags and no releases.
