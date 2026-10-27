> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-MINI · mini PC node · Thu 29 Oct 2026, 18:00–19:00 UTC (19:00–20:00 CET)

The Beelink SER5 Pro mini PC (Ryzen 5 5500U, 16 GB, 480 GB SSD, Windows 11 Pro), node from [tn10-run-kit](https://github.com/STP-KAS/tn10-run-kit) `node/`. Run by Grok Build on the mini itself (no Remote Desktop). stp talks to TN10 ops through the Grok Bot app on the mini; each message shows which machine it came from. Overview: [GO-MAP.md](GO-MAP.md).

**Status: GO** (stp, Tue 27 Oct 2026). Locked; changes go in `phase.log` as a deviation. Time: **START 18:00 UTC (proposed 19:00 UTC, pending Pulse)**; END = START + 1 h. If Pulse agrees, only the clock line and `config.json` times move by +1 h.

## Role

The mini is the **main node, chain reader and coordinator** (genesis for families 1–4, outpoint per family, `phase.log`, STALL / STOP / END), **plus sender `mini`** over **localhost Borsh 17210**, as in [GO-MAP.md](GO-MAP.md) and the [lane table](README.md#lanes-and-status). Start all three with `launch-mini.ps1`.

- **Fallback only:** if the mini is not synced at T-2h (16:00 UTC), or its node dies mid-phase, the desk coordinator takes over ([GO-BUILD.md](GO-BUILD.md)), logged as `MAIN node=desk reason=…`. In that case only, the mini runs no sender and no coordinator.

## Node settings (from tn10-run-kit)

- kaspad 2.1.0 at `<your-folder>\kaspa\2.1.0`, data `<your-folder>\kaspa\data-tn10`, logs `<your-folder>\kaspa\logs`, task `TN10 kaspad`.
- `--testnet --netsuffix=10 --utxoindex`. `--ram-scale=0.6` stays (the mini has about 12 GB of RAM).
- RPC on this PC only: gRPC 16210, Borsh 17210, JSON 18210. **RPC never public.** P2P 16211 outbound only.

**utxoindex (PulseHawk advice, 23 Oct):** `--utxoindex` on both private nodes (mini and desk), because senders and builders query their own UTXOs and balances; without it `getUtxosByAddresses` and UTXO-changed notifications do not work. Enable it before test day: the first start builds the index, then restart once and verify the index is complete. Same kaspad version and same flags on both nodes, so a difference between them points at the network, not a setting. After verification, both nodes stay untouched until after END. A node used only by a miner does not need the index.

**One operator for the mini:** only TN10 ops starts, stops or changes kaspad on the mini. Grok Build reads and logs only and does not relaunch kaspad. No miner runs on the mini (node only, stp 23 Oct).

## Pre-flight checklist

- [ ] `<your-folder>\tn10-run-kit\node\check-node.ps1` shows running yes, **Synced: True**, past median time seconds behind, peers > 0 (paste real output).
- [ ] Disk free **> 50 GB**.
- [ ] `--ram-scale=0.6` present in the running command line (expected, known difference).
- [ ] Windows Update active hours cover 16:00–20:00 UTC; no pending restart. Power never sleeps.
- [ ] Grok Build and the Grok Bot app work on the mini.
- [ ] `check-node.ps1` output starts with the HOST/UTC line.
- [ ] T-2h: NTP offset logged; coordinator can read the virtual chain over localhost.
- [ ] Funding coins for the `mini` lane, own key: ~1,600 tKAS pre-split into ≥ 100 coins, plus genesis coins for families 1–4 (coordinator).
- [ ] T-5 min: `control/STOP` absent.

## Start / stop

```powershell
cd <your-folder>\tn10-run-kit\node
.\check-node.ps1
# lanes, one command: <your-folder>\tn10-storm-kit\launch-mini.ps1 -Kit <your-folder>\tn10-storm-kit -Config <your-folder>\tn10-storm-2026-10-29\config.json
Start-ScheduledTask -TaskName 'TN10 kaspad'   # node start (if stopped)
New-Item <your-folder>\tn10-storm-2026-10-29\control\STOP   # stop switch
```

Do not run `stop-node.ps1` on the day unless the node is broken; it kills kaspad hard.

## Before the start (mini)

- Close Outlook and Edge; keep `--ram-scale=0.6` (only 11.9 GB visible, ~87% in use on 22 Oct).
- Build launches the logger and checks it is writing.
- Then close the Grok Bot app (frees ~400 MB). The mini doesn't need it during the test: kaspad and the logger run on their own and write to files.
- After the run, reopen Grok Bot and send the log files to TN10 ops. Mid-run issues go via the desk PC or iPhone.

## Logging

- **Optional:** passive hardware logger `tools/hwlog.ps1 -Label mini` from START−30 min to END+30 min. Read-only; does not touch kaspad; node stays untouched until END. Details and specs: [LOGGING.md](LOGGING.md#hwlog-labelcsv--hardware-logger-optional).
- Logging pre-check: NTP synced to UTC (`w32tm /query /status`, `w32tm /resync`, stripchart vs time.windows.com/pool.ntp.org), offset < ~100 ms; no hostnames/IPs in anything published.

The mini never touches GitHub (no Git, no GitHub login). It writes its logs to local files. After the run, stp attaches them from the Grok Bot app on the mini to TN10 ops, who checks them, removes IPs and commits them to this repo.


As [LOGGING.md](LOGGING.md): `submit.jsonl` (on disk), `minute.csv`, `phase.log` (coordinator), `post-end-mempool.csv` for the mini node 19:00–19:15.

## Abort rules

Node-dead rule (PulseHawk), STALL 30 s, shape mismatch, network id check, STOP file, hard END. If the mini node goes dead mid-phase, the desk coordinator takes over (`MAIN node=desk reason=mini_dead`); start commands as in [GO-BUILD.md](GO-BUILD.md#start--stop) with `--label mini`.
