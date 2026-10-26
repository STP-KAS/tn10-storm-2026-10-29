> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Metrics

## Headline

**Total hop rate vs number of covenant families.** Per ON step, counted minutes only (exact ranges in [go/LOGGING.md](../go/LOGGING.md#counted-minutes-exact-utc): 18:03–18:14, 18:23–18:34, 18:43–18:59 UTC), clean minutes only (`sec.csv`):

- hops per second, sum across families
- hops per second, per family
- whether the sum grows with 1 → 2 → 4 families

If total hop rate scales with families, that is evidence of parallel state on Kaspa (hypothesis; Thursday measures it).

## Per UTC minute and family (`minute.csv`, one row per minute and family)

Every count below is **per family**; totals per minute are the sum over that minute's family rows.

| Column | Meaning |
|---|---|
| `sent` | attempts handed to a node |
| `ok` | mempool acceptances |
| `rej_already_spent` | conflict rejects |
| `rej_orphan` | see [docs/ORPHAN.md](../docs/ORPHAN.md) |
| `rej_fee` / `rej_mass` / `rej_mempool_full` / `rej_route` / `rej_rpc` / `rej_other` | other rejects |
| `winners` | our hops whose accepting-block header falls in that minute |
| `hops` | state transitions observed from those accepting blocks |
| `include_p50_ms` / `include_p95_ms` | accepting header time minus submit ts, winners whose ts falls in that minute. Header time is the miner's clock, so it carries that miner's offset |
| `seen_p50_ms` / `seen_p95_ms` | coordinator's local UTC time when it first sees the accepting block (`seen_utc`, logged next to the header time) minus submit ts; separates inclusion delay from miner clock offset |
| `family` | family number of this row |
| `families` | how many families were live that minute |

Winners per family-minute should match hops per family-minute. Sent and ok will be larger. **Every attempt lands in exactly one of `ok` or one `rej_*` column**, so `sent = ok + sum(rej_*)` holds for every row.

## Per UTC second (`sec.csv`)

`senders_target`, `senders_on`, `sent`, `ok` per second, 17:55–19:00 UTC. A minute is clean only when all planned senders were on for all 60 seconds.

## Cross-check with PulseHawk

PulseHawk (pulsehawk.io) counts the storm independently from its own nodes. It counts transactions accepted in blocks per UTC minute, by block time. Compare its count with our `winners`. Its counter includes TN10 base load (~56 tx/s without us); with the covenant id of each family (sent privately by stp, see [LOGGING.md](../go/LOGGING.md#private-log-never-pushed)) it can count each family on its own nodes. `MINER` lines in `phase.log` mark changes in our own hashrate.

## Post-END (19:00–19:15 UTC)

Mempool size on the main node and on each public tag, once per minute. Question: do orphans clear, and how long does that take?

## Rehearsal baseline (label A)

20 Oct desk: sent 83,306 · accepts/winners/hops 1,287 · already-spent 68,644 · orphan 13,375 · include p50 1,047 ms / p95 2,021 ms · ~0.7 hops/s. Detail: [logs/REHEARSAL-2026-10-20.md](../logs/REHEARSAL-2026-10-20.md).
