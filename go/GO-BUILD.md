> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-BUILD · desk PC · Thu 29 Oct 2026, 18:00–19:00 UTC (19:00–20:00 CET)

You are **Grok Build** on stp's Windows desk PC. Overview: [GO-MAP.md](GO-MAP.md). Other sides: [GO-BOT.md](GO-BOT.md), [GO-MINI.md](GO-MINI.md). Rules: [README.md](README.md). Design: [plan/PLAN.md](../plan/PLAN.md).

**Status: GO** (stp, Tue 27 Oct 2026). Locked; changes go in `phase.log` as a deviation. Time: **START 18:00 UTC (proposed 19:00 UTC, pending Pulse)**; END = START + 1 h. If Pulse agrees, only the clock line and `config.json` times move by +1 h.

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
- [ ] Funding coins for the `desk` lane: own key, not shared with any other lane; ~1,600 tKAS pre-split into ≥ 100 coins (PLAN.md, Funding per lane); genesis coins too if the desk is main.
- [ ] Windows Update active hours cover 16:00–20:00 UTC; no pending restart.
- [ ] T-2h: NTP check (`w32tm /stripchart` or similar), offset logged.
- [ ] T-2h: main-node decision read from GO-MAP; if fallback, coordinator armed on the desk node.
- [ ] T-5 min: `control/STOP` absent; START line ready with tag set and rate.

## Start / stop

Run directory: `<your-folder>\tn10-storm-2026-10-29`.

```powershell
cd <your-folder>\tn10-storm-kit          # tools/storm from this repo + SDK 2.1.0
$env:STORM_CONFIG = "<your-folder>\tn10-storm-2026-10-29\config.json"   # private, outside any repo
# one command: .\launch-desk.ps1 -Kit <your-folder>\tn10-storm-kit -Config <your-folder>\tn10-storm-2026-10-29\config.json [-Coordinator | -Takeover]
Start-Process node -ArgumentList "coordinator.mjs" -WindowStyle Hidden   # main node only
Start-Process node -ArgumentList "sender.mjs --label desk --node ws://127.0.0.1:17210" -WindowStyle Hidden
New-Item <your-folder>\tn10-storm-2026-10-29\control\STOP   # stop switch
node aggregate.mjs   # after END: minute.csv, sec.csv, private submit.jsonl
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

**After GENESIS (T-9 min): state handoff.** Remote senders run `--source self` and need `state/family-N.json` from the mini. Mini: `node handoff.mjs export > handoff.json` (STORM_CONFIG set). Copy it into the desk and box run folders, then there: `node handoff.mjs import handoff.json`. Senders wait (no attempts) until the files exist. Never hand-edit state files.
