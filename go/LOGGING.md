> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Logging

The run directory is outside this repo. Files during the phase: `submit.jsonl` (private), `minute.csv`, `sec.csv`, `phase.log`, `ntp.csv`; after END: `post-end-mempool.csv`. Every file uses labels (`desk`, `mini`, `box`, public tags), never hostnames or IPs.

## `logs/submit.jsonl`

One line per attempt, including losers. Fields, in this order:

- `ts` — UTC to the millisecond, e.g. `2026-10-29T19:00:01.234Z`
- `sender` — the tag
- `node` — the same tag
- `family` — family number (1–4)
- `txid`
- `result` — `ok` or `rejected`
- `reason` — empty on `ok`, otherwise one of `already_spent`, `orphan`, `fee`, `mass`, `mempool_full`, `route`, `rpc`, `other`
- `accept_header_utc` — for winners: the accepting block's header time (miner's clock); empty otherwise
- `seen_utc` — for winners: the coordinator's local UTC time when it first saw the accepting block; empty otherwise

`ts` is stamped by the machine that runs the sender process: the desk for `desk`, the mini for `mini`, and **the box for every public-node sender** (`muon`, `boson`, …). `seen_utc` is stamped by the coordinator's machine (mini, or desk in the fallback).

Flush every line. Store the reason token, not the raw node sentence (that sentence often contains transaction ids). This file stays on disk; it is never pushed.

## `logs/minute.csv`

Counts only. **One row per UTC minute and family** (family 1–4). Header:

```text
minute_utc,step,family,families,sent,ok,rej_already_spent,rej_orphan,rej_fee,rej_mass,rej_mempool_full,rej_route,rej_rpc,rej_other,winners,hops,include_p50_ms,include_p95_ms,seen_p50_ms,seen_p95_ms
```

`family` = family number for this row; `families` = how many families were live that minute. All other counts are for that family only. `sent` = attempts. `ok` = mempool acceptances. **Every attempt lands in exactly one of `ok` or one `rej_*` column**, so for every row `sent = ok + rej_already_spent + rej_orphan + rej_fee + rej_mass + rej_mempool_full + rej_route + rej_rpc + rej_other`; an attempt with no answer before END is `rej_rpc`. `winners` = our hops whose accepting-block header falls in that minute. `hops` = state transitions from those accepting blocks. `include_p50_ms` / `include_p95_ms` = accepting header time minus `ts`, for winners whose `ts` falls in that minute. A minute with no winner leaves those two cells empty. **Clock note:** the accepting header time comes from the miner's clock, so these values also carry that miner's clock offset. To separate the two, the coordinator also records `seen_utc`: its own local UTC time (NTP-synced) when it first sees the accepting block, logged next to `accept_header_utc` in `submit.jsonl`, and `seen_p50_ms` / `seen_p95_ms` (= `seen_utc` minus `ts`) as two extra columns at the end of `minute.csv`. Gap minutes are logged as one row per family that ran in the previous step, with `sent=0`.

## `logs/phase.log`

One short line per event, with the actual UTC second:

```text
2026-10-29T17:00:04Z NTP machine=mini offset_ms=125 source=pool.ntp.org
2026-10-29T18:49:12Z GENESIS family=1 included
2026-10-29T18:55:00Z FAMILY_DROP family=4 reason=no_genesis
2026-10-29T19:00:00Z MINER state=on workers=3 miner=box
2026-10-29T19:00:00Z START senders=desk,mini,muon families=1 rate=5
2026-10-29T19:00:00Z STEP step=1 families=1 rate=5
2026-10-29T19:07:31Z NODE_SKIP node=boson reason=mempool_90k
2026-10-29T19:09:12Z SENDER_OFF sender=desk reason=node_dead
2026-10-29T19:10:40Z SENDER_ON sender=desk
2026-10-29T19:15:00Z GAP_START
2026-10-29T19:20:00Z GAP_END
2026-10-29T19:20:00Z STEP step=2 families=2 rate=5
2026-10-29T19:35:00Z GAP_START
2026-10-29T19:40:00Z GAP_END
2026-10-29T19:40:00Z STEP step=3a families=3 rate=5
2026-10-29T19:55:00Z STEP step=3b families=3 rate=5
2026-10-29T20:00:00Z STOP reason=END
```

(Example values only. In this example family 4 was dropped, so step 3 runs 3 families.)

Fixed tokens, each with the actual UTC second:

| Token | When |
|---|---|
| `START` / `STOP reason=END\|STOP\|STALL\|shape_mismatch` | coordinator began / ended attempts |
| `STEP step=1\|2\|3a\|3b families=N rate=5` | every step boundary: 19:00, 19:20, 19:40, 19:55 |
| `GAP_START` / `GAP_END` | 19:15/19:20 and 19:35/19:40 |
| `SENDER_OFF sender=<label> reason=node_dead\|stop\|error` | a sender stops sending outside a planned gap |
| `SENDER_ON sender=<label>` | it starts again (never by self-restart) |
| `NODE_SKIP node=<tag> reason=mempool_90k` | public node at ≥ 90,000 mempool entries, skipped for the rest of the phase |
| `NODE_DROP node=<tag> reason=redeem_shape` | public node rejects the hop shape, dropped from the tag set |
| `FAMILY_DROP family=N reason=no_genesis` | genesis missing at 18:55 |
| `GENESIS family=N included` | genesis on the main node's virtual chain. **Family number only**: the covenant id goes in the private log only |
| `MINER state=on\|off workers=N miner=<label>` | own miner state at T0 and at every change |
| `NTP machine=<label> offset_ms=N source=<server>` | each `ntp.csv` row, mirrored |
| `MAIN node=<label> reason=...` | main-node decision at T−2h |

### Counted minutes (exact UTC)

"Count from minute 3" means minutes 0–2 of each 15-minute ON step are ramp-up and are not counted:

| Step | ON window | Counted minutes |
|---|---|---|
| 1 | 19:00:00–19:14:59 | **19:03:00–19:14:59** (12 min) |
| 2 | 19:20:00–19:34:59 | **19:23:00–19:34:59** (12 min) |
| 3a + 3b | 19:40:00–19:59:59 | **19:43:00–19:59:59** (17 min; 3b is not a new ramp) |

A counted minute is **clean** only when `sec.csv` shows `senders_on = senders_target` for all 60 seconds.

## `logs/sec.csv`

Counts only. **One row per UTC second from 18:55:00 to 19:59:59 UTC** (3,900 rows), all senders and families summed. Header:

```text
utc_second,step,families,senders_target,senders_on,sent,ok
```

`step` is `pre`, `1`, `gap`, `2`, `3a`, `3b`. Gap and pre-T0 seconds stay in, with `senders_target=0`. `senders_target` = planned senders for that second (after any NODE_SKIP/NODE_DROP, which lower the target from that second on). `senders_on` = senders that handed at least one attempt to their node in that second. No txid, no address.

## `logs/ntp.csv`

Header:

```text
utc,machine,offset_ms,source
```

One row per machine that stamps `ts` or `seen_utc` (`desk`, `mini`, `box`), at **T0−2h (17:00 UTC)**, **T0−5 min (18:55 UTC)** and **END+1 min (20:01 UTC)**. Labels only, never hostnames. `offset_ms` uses the NTP / `w32tm` sign as printed (median of 3 samples, in ms), logged as measured: an offset over the 100 ms target is logged as is, not hidden (a known offset can be corrected for). Tools: [`tools/ntplog.ps1`](../tools/ntplog.ps1) (Windows, `w32tm /stripchart`) and [`tools/ntplog.py`](../tools/ntplog.py) (box, SNTP query).

## Private log (never pushed)

`private/genesis.log` in the run directory: one line per family with the family number, the covenant id and the genesis inclusion time. **Process:** once each family's genesis is included, and **by 18:55 UTC at the latest**, stp sends PulseHawk the covenant id of each family privately (not through any repo, X post or public channel). PulseHawk keeps only a hash. Covenant ids never appear in this repo.

## `logs/post-end-mempool.csv`

After END, one row per UTC minute for 15 minutes. Counts only. Header:

```text
minute_utc,node,mempool_size
```

## What may land in this repo after END

`minute.csv`, `sec.csv`, `ntp.csv`, `phase.log`, `post-end-mempool.csv`, `hwlog-desk.csv` and `hwlog-mini.csv` only after a scan finds no key, seed, address, IP, transaction id, hostname or user path. `submit.jsonl` and `private/genesis.log` never.

## `hwlog-<label>.csv` · hardware logger (OPTIONAL)

[`tools/hwlog.ps1`](../tools/hwlog.ps1) compares how a strong and a modest home node handle the same storm. **Passive and read-only:** it only reads Windows performance counters (`Get-Counter`) and `Get-Process`; it never starts, stops or reconfigures kaspad. The "nodes untouched until END" rule stays in force.

PulseHawk (pulsehawk.io) counts the storm independently from its own nodes.

**Pre-run (T-2h, both PCs):** in an admin prompt run `w32tm /query /status` and `w32tm /resync`, then `tools/ntplog.ps1 -Machine desk|mini` (stripchart vs `pool.ntp.org`), which appends the row to `ntp.csv`. Target offset under ~100 ms; if it is still over, log it as it is.

- `-Label` is required (`desk` or `mini`) and is written to the `label` column instead of the computer name. The script never records hostname, IP or username.
- Before publishing any log, scrub hostnames, IPs and private paths.
- Runs from **START−30 min to END+30 min** (18:30–20:30 UTC, 19:30–21:30 CET), one instance per PC.
- Every 5 s: UTC time, label, total CPU %, available RAM (MB), disk reads/s, writes/s, queue length, kaspad working set (MB), kaspad CPU % (of all cores).
- Example: `cd <your-folder>\tn10-storm` then `powershell -ExecutionPolicy Bypass -File .\tools\hwlog.ps1 -Label desk -DurationMinutes 120` (label `mini` on the mini).

| Node | CPU | RAM | Disk | kaspad |
|---|---|---|---|---|
| desk | Intel i7-13700K, 16 cores / 24 threads | 32 GB DDR5 | Samsung 990 Pro NVMe | default ram scale, `--rpcmaxclients=24` |
| mini | AMD Ryzen 5 5500U, 6 cores / 12 threads | 11.9 GB | 447 GB SSD | `--ram-scale=0.6 --async-threads=8` |

Note: the config differences between the nodes are `--ram-scale=0.6` and `--async-threads=8` on the mini and `--rpcmaxclients=24` on the desk, so a gap between them reads as hardware plus config, not hardware alone. Both nodes listen on localhost only for wRPC (desk switched on 26 Oct 2026).
