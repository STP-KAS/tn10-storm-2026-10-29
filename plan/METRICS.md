> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Metrics

## Headline

**Total hop rate vs number of covenant families.** Per ON step (count from minute 3):

- hops per second, sum across families
- hops per second, per family
- whether the sum grows with 1 → 2 → 4 families

If total hop rate scales with families, that is evidence of parallel state on Kaspa (hypothesis; Thursday measures it).

## Per UTC minute (every ON minute)

| Column | Meaning |
|---|---|
| `sent` | attempts handed to a node |
| `ok` | mempool acceptances |
| `rej_already_spent` | conflict rejects |
| `rej_orphan` | see [docs/ORPHAN.md](../docs/ORPHAN.md) |
| `rej_fee` / `rej_mass` / `rej_mempool_full` / `rej_route` / `rej_rpc` / `rej_other` | other rejects |
| `winners` | our hops whose accepting-block header falls in that minute |
| `hops` | state transitions observed from those accepting blocks |
| `include_p50_ms` / `include_p95_ms` | accepting header time minus submit ts, winners whose ts falls in that minute |
| `families` | how many families were live that minute |

Winners per minute should match hops per minute. Sent and ok will be larger.

## Cross-check with Kaspa Pulse

Kaspa Pulse (@gokugalax, kaspapulse.com) counts transactions accepted in blocks on two independent nodes, per UTC minute, by block time. Compare his count with our `winners`. His counter includes TN10 base load (~56 tx/s without us) and cannot tell covenant hops from other traffic; the hop split comes from our logs.

## Post-END (19:00–19:15 UTC)

Mempool size on the main node and on each public tag, once per minute. Question: do orphans clear, and how long does that take?

## Rehearsal baseline (label A)

20 Oct desk: sent 83,306 · accepts/winners/hops 1,287 · already-spent 68,644 · orphan 13,375 · include p50 1,047 ms / p95 2,021 ms · ~0.7 hops/s. Detail: [logs/REHEARSAL-2026-10-20.md](../logs/REHEARSAL-2026-10-20.md).
