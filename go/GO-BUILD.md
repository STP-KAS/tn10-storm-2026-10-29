> **DRAFT - basics only.** Locked after PulseHawk reviews the repo and the mini PC node is live and synced; frozen plan due Tue 27 Oct 18:00 UTC.
>
> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-BUILD · desk PC · Thu 29 Oct 2026, 18:00–19:00 UTC (19:00–20:00 CET)

You are **Grok Build** on stp's Windows desk PC. Overview: [GO-MAP.md](GO-MAP.md). Other sides: [GO-BOT.md](GO-BOT.md), [GO-MINI.md](GO-MINI.md). Rules: [README.md](README.md). Design: [plan/PLAN.md](../plan/PLAN.md).

**Not armed until stp sends GO.** Once sent it is locked; changes go in `phase.log` as a deviation.

## Your role

- **Sender `desk`**, 5 attempts/s during ON steps, nothing in the gaps.
- **Fallback chain reader + coordinator** if the mini PC is not synced at T-2h (16:00 UTC). Then you watch the desk node's virtual chain, publish the current outpoint per family, write `phase.log`, enforce STALL / STOP / END. The mini then only monitors.

## Desk node

- The running kaspad 2.1.0, testnet-10, `--utxoindex`, default ram scale. **Leave it up. No second kaspad on the desk. Do not wipe its app directory.**
- Peer listen, Borsh and (at next restart, after mini takes over) gRPC on loopback only. UPnP off. No public RPC.
- Keep at least 30 GB disk free and 4 GB RAM free.

**utxoindex (PulseHawk advice, 23 Oct):** `--utxoindex` on both private nodes (mini and desk), because senders and builders query their own UTXOs and balances; without it `getUtxosByAddresses` and UTXO-changed notifications do not work. Enable it before test day: the first start builds the index, then restart once and verify the index is complete. Same kaspad version and same flags on both nodes, so a difference between them points at the network, not a setting. After verification, both nodes stay untouched until after END. A node used only by a miner does not need the index.

## Pre-flight checklist

- [ ] T-24h: node synced, version 2.1.0, network id `testnet-10` (report real output).
- [ ] Funding coins for the `desk` lane: own key, not shared with any other lane; enough for 1 h at 5 att/s plus genesis for any family you own. TODO: amount from real fee × mass.
- [ ] Windows Update active hours cover 16:00–20:00 UTC; no pending restart.
- [ ] T-2h: NTP check (`w32tm /stripchart` or similar), offset logged.
- [ ] T-2h: main-node decision read from GO-MAP; if fallback, coordinator armed on the desk node.
- [ ] T-5 min: `control/STOP` absent; START line ready with tag set and rate.

## Start / stop

Run directory: `<your-folder>\tn10-storm-2026-10-29`.

```powershell
# TODO: sender start command (script not written yet)
# TODO: coordinator start command (fallback only)
New-Item <your-folder>\tn10-storm-2026-10-29\control\STOP   # stop switch
```

Senders stop by themselves at 19:00:00Z whatever time they were started.

## Logging

- **Optional:** passive hardware logger `tools/hwlog.ps1 -Label desk` from START−30 min to END+30 min. Read-only; does not touch kaspad; node stays untouched until END. Details and specs: [LOGGING.md](LOGGING.md#hwlog-labelcsv--hardware-logger-optional).
- Logging pre-check: NTP synced to UTC (`w32tm /query /status`, `w32tm /resync`, stripchart vs time.windows.com/pool.ntp.org), offset < ~100 ms; no hostnames/IPs in anything published.

As [LOGGING.md](LOGGING.md): `submit.jsonl` (stays on disk), `minute.csv`, `phase.log` (if coordinator), and `post-end-mempool.csv` for the desk node 19:00–19:15. Reason tokens only, never the raw node sentence.

## Abort rules

Node-dead rule (PulseHawk), network id check, STALL 30 s, shape mismatch, compute mass > 100,000, STOP file, hard END. No self-restart after STOP/END.

## After END

Desk mempool watch 15 min. Then scan `minute.csv` / `phase.log` for keys, seeds, addresses, IPs, txids; push counts only to `logs/`.
