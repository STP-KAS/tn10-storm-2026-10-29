> **DRAFT - basics only.** Locked after Kaspa Pulse reviews the repo and the mini PC node is live and synced; frozen plan due Tue 27 Oct 18:00 UTC.
>
> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-MINI · mini PC node · Thu 29 Oct 2026, 18:00–19:00 UTC (19:00–20:00 CET)

The Beelink SER5 Pro mini PC (Ryzen 5 5500U, 16 GB, 480 GB SSD, Windows 11 Pro), node from [tn10-run-kit](https://github.com/STP-KAS/tn10-run-kit) `node/`. Run by Grok Build on the mini itself (no Remote Desktop). stp talks to TN10 ops through the Grok Bot app on the mini; each message shows which machine it came from. Overview: [GO-MAP.md](GO-MAP.md).

**Not armed until stp sends GO.**

## Role

- **If synced:** main node, chain reader and coordinator, plus sender `mini` over **localhost Borsh 17210**.
- **If not synced at T-2h (16:00 UTC):** monitor only. No sender, no coordinator; desk takes over ([GO-BUILD.md](GO-BUILD.md)).

## Node settings (from tn10-run-kit)

- kaspad 2.1.0 at `C:\kaspa\2.1.0`, data `C:\kaspa\data-tn10`, logs `C:\kaspa\logs`, task `TN10 kaspad`.
- `--testnet --netsuffix=10 --utxoindex`. `--ram-scale=0.6` stays (the mini has about 12 GB of RAM).
- RPC on this PC only: gRPC 16210, Borsh 17210, JSON 18210. **RPC never public.** P2P 16211 outbound only.

**utxoindex (Kaspa Pulse advice, 23 Oct):** `--utxoindex` on both private nodes (mini and desk), because senders and builders query their own UTXOs and balances; without it `getUtxosByAddresses` and UTXO-changed notifications do not work. Enable it before test day: the first start builds the index, then restart once and verify the index is complete. Same kaspad version and same flags on both nodes, so a difference between them points at the network, not a setting. After verification, both nodes stay untouched until after END. A node used only by a miner does not need the index.

**One operator for the mini:** only TN10 ops starts, stops or changes kaspad on the mini. Grok Build reads and logs only and does not relaunch kaspad. No miner runs on the mini (node only, stp 23 Oct).

## Pre-flight checklist

- [ ] `C:\Users\Fermi\tn10-run-kit\node\check-node.ps1` shows running yes, **Synced: True**, past median time seconds behind, peers > 0 (paste real output).
- [ ] Disk free **> 50 GB**.
- [ ] No `--ram-scale` in the running command line.
- [ ] Windows Update active hours cover 16:00–20:00 UTC; no pending restart. Power never sleeps.
- [ ] Grok Build and the Grok Bot app work on the mini.
- [ ] `check-node.ps1` output starts with the HOST/UTC line.
- [ ] T-2h: NTP offset logged; coordinator can read the virtual chain over localhost.
- [ ] Funding coins for the `mini` lane, own key. TODO: amount.
- [ ] T-5 min: `control/STOP` absent.

## Start / stop

```powershell
cd C:\Users\Fermi\tn10-run-kit\node
.\check-node.ps1
Start-ScheduledTask -TaskName 'TN10 kaspad'   # node start (if stopped)
# TODO: coordinator + sender start commands (scripts not written yet)
New-Item C:\Users\Fermi\tn10-storm-2026-10-29\control\STOP   # stop switch
```

Do not run `stop-node.ps1` on the day unless the node is broken; it kills kaspad hard.

## Before the start (mini)

- Close Outlook and Edge; keep `--ram-scale=0.6` (only 11.9 GB visible, ~87% in use on 22 Oct).
- Build launches the logger and checks it is writing.
- Then close the Grok Bot app (frees ~400 MB). The mini doesn't need it during the test: kaspad and the logger run on their own and write to files.
- After the run, reopen Grok Bot and send the log files to TN10 ops. Mid-run issues go via the desk PC or iPhone.

## Logging

The mini monitors only and never touches GitHub (no Git, no GitHub login). It writes its logs to local files. After the run, stp attaches them from the Grok Bot app on the mini to TN10 ops, who checks them, removes IPs and commits them to this repo.


As [LOGGING.md](LOGGING.md): `submit.jsonl` (on disk), `minute.csv`, `phase.log` (coordinator), `post-end-mempool.csv` for the mini node 19:00–19:15.

## Abort rules

Node-dead rule (Kaspa Pulse), STALL 30 s, shape mismatch, network id check, STOP file, hard END. If the mini node goes dead mid-phase: TODO decide whether desk takes over as coordinator or the phase stops.
