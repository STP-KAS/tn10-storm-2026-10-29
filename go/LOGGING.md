> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Logging

The run directory is outside this repo. Three files during the phase, one after END.

## `logs/submit.jsonl`

One line per attempt, including losers. Fields, in this order:

- `ts` — UTC to the millisecond, e.g. `2026-10-29T18:00:01.234Z`
- `sender` — the tag
- `node` — the same tag
- `family` — which covenant family
- `txid`
- `result` — `ok` or `rejected`
- `reason` — empty on `ok`, otherwise one of `already_spent`, `orphan`, `fee`, `mass`, `mempool_full`, `route`, `rpc`, `other`

Flush every line. Store the reason token, not the raw node sentence (that sentence often contains transaction ids). This file stays on disk; it is never pushed.

## `logs/minute.csv`

Counts only. One row per UTC minute. Header:

```text
minute_utc,step,families,sent,ok,rej_already_spent,rej_orphan,rej_fee,rej_mass,rej_mempool_full,rej_route,rej_rpc,rej_other,winners,hops,include_p50_ms,include_p95_ms
```

`sent` = attempts. `ok` = mempool acceptances. `winners` = our hops whose accepting-block header falls in that minute. `hops` = state transitions from those accepting blocks. `include_p50_ms` / `include_p95_ms` = accepting header time minus `ts`, for winners whose `ts` falls in that minute. A minute with no winner leaves those two cells empty. Gap minutes may be omitted or logged with `sent=0`.

## `logs/phase.log`

One short line per event, with the actual UTC second:

```text
2026-10-29T17:49:12Z GENESIS family=1 included
2026-10-29T18:00:01Z START senders=desk,mini,muon families=1 rate=5
2026-10-29T18:15:00Z GAP reason=sender_off
2026-10-29T18:20:00Z STEP step=2 families=2 rate=5
2026-10-29T19:00:00Z STOP reason=END
```

START and STOP use the second the coordinator actually began and ended attempts. A stall or a shape mismatch is a STOP line with its own reason.

## `logs/post-end-mempool.csv`

After END, one row per UTC minute for 15 minutes. Counts only. Header:

```text
minute_utc,node,mempool_size
```

## What may land in this repo after END

`minute.csv`, `phase.log` and `post-end-mempool.csv` only after a scan finds no key, seed, address, IP or transaction id. `submit.jsonl` never.
