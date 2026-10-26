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

## `hwlog-<label>.csv` · hardware logger (OPTIONAL, approved by PulseHawk)

[`tools/hwlog.ps1`](../tools/hwlog.ps1) compares how a strong and a modest home node handle the same storm. **Passive and read-only:** it only reads Windows performance counters (`Get-Counter`) and `Get-Process`; it never starts, stops or reconfigures kaspad. The "nodes untouched until END" rule stays in force.

Approved by PulseHawk (pulsehawk.io), independent measurement.

**Pre-run (T-2h, both PCs):** in an admin prompt run `w32tm /query /status` and `w32tm /resync`, then `w32tm /stripchart /computer:time.windows.com /samples:5 /dataonly` (or `pool.ntp.org`). Target offset under ~100 ms; log it.

- `-Label` is required (`desk` or `mini`) and is written to the `label` column instead of the computer name. The script never records hostname, IP or username.
- Before publishing any log, scrub hostnames, IPs and private paths.
- Runs from **START−30 min to END+30 min** (17:30–19:30 UTC, 18:30–20:30 CET), one instance per PC.
- Every 5 s: UTC time, label, total CPU %, available RAM (MB), disk reads/s, writes/s, queue length, kaspad working set (MB), kaspad CPU % (of all cores).
- Example: `cd C:\Users\Fermi\tn10-storm` then `powershell -ExecutionPolicy Bypass -File .\tools\hwlog.ps1 -Label desk -DurationMinutes 120` (label `mini` on the mini).

| Node | CPU | RAM | Disk | kaspad |
|---|---|---|---|---|
| desk | Intel i7-13700K, 16 cores / 24 threads | 32 GB DDR5 | Samsung 990 Pro NVMe | default ram scale |
| mini | AMD Ryzen 5 5500U, 6 cores / 12 threads | 11.9 GB | 447 GB SSD | `--ram-scale=0.6` |
