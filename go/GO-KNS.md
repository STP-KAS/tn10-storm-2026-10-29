> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-KNS · KNS background lane · Thu 29 Oct 2026

**Status: GO** (stp, Tue 27 Oct 2026). Armed at START. Time: **START 18:00 UTC (proposed 19:00 UTC, pending Pulse)**; END = START + 1 h. If Pulse agrees, only `kns_from_utc`, `end_utc` and the gaps in `config.json` move by +1 h.

Overview: [GO-MAP.md](GO-MAP.md). Box sheet: [GO-BOT.md](GO-BOT.md). Rules: [README.md](README.md).

## Who

- **Runs on:** the box (Grok Bot, TN10 ops), `tools/storm/kns-lane.mjs`.
- **KNS tooling and names:** kns tn10 bot. Coordination line: the kns tn10 chat. stp's GO there is now given; TN10 ops confirms "armed" there at T−5 min and "stopped" after END.
- Lane = `family=0`, sender `kns`, own minute file, **not counted** in the storm figures.

## Spec

| Item | Value |
|---|---|
| Rate | 60 names/min |
| In flight | max 16 |
| Window | START+3 min → END; off in both 5-minute gaps |
| Node | `muon` (spare `boson`) |
| Fee | 1.5× priority, capped at 1 tKAS/name; **pause, never escalate** |
| Funding | KNS lane wallet (topped up 26 Oct); own key, not shared with any storm lane |

## Pre-flight

- [x] **Confirmed (kns tn10, 27 Oct):** runner is `kns/scripts/kns-abc-runner.mjs` in STP-KAS/tn10-1984-water-2026-10-17, started via `kns/scripts/kns-abc-supervise.sh`, from a fresh run folder, lane config 60/min, max 16 in flight, 1.5× priority fee capped at 1 tKAS/name.
- [x] **Confirmed (kns tn10, 27 Oct):** budget 3,600 names/h ≈ 130k tKAS (35 tKAS name price + up to 1 tKAS fee each); funded, KNS wallets hold 663,375 tKAS total.
- [ ] T−1h: `muon` passes the public-node check (2.1.0, `testnet-10`, mempool < 90,000); else `boson`.
- [ ] T−10 min: dry run (`--dry-run`) from the fresh run folder shows correct window (START+3 min → END, off in gaps), node and rate.
- [ ] T−5 min: no `STOP` in the KNS run folder, no `control/STOP` in the storm run folder; arm.

## Arm

The supervisor restarts the runner on crash/stall (backoff 5/15/45/120 s) and exits on normal stop, refusal (rc 3) or `STOP` in the run folder. Arming needs `--armed 1`, `KNS_ABC_ARMED=1` and `KNS_SHARED_STOP=<storm run_dir>/control/STOP`.

**Window (set by kns tn10, 27 Oct, matches GO-MAP):** for START 18:00Z it sends 18:03–19:00Z, off 18:15–18:20Z and 18:35–18:40Z, hard END 19:00Z. One value, `schedule.start_utc` in `config/storm.json`, shifts it by +1 h if Pulse agrees.

```bash
cd <your-folder>/tn10-1984-water-2026-10-17/kns/scripts
export RUN_DIR=<your-folder>/kns-storm-run       # fresh folder, private (private.json stays here)
export KNS_CONFIG=$RUN_DIR/config/storm.json      # lane config (kns tn10): 60/min, 16 in flight, 1.5x fee capped 1 tKAS; window from schedule.start_utc
export KNS_SHARED_STOP=<storm run_dir>/control/STOP   # required in armed mode: storm STOP also stops KNS
./kns-abc-supervise.sh --dry-run 3               # dry, check window/rate
KNS_ABC_ARMED=1 nohup ./kns-abc-supervise.sh --armed 1 > "$RUN_DIR/supervise.out" 2>&1 &
```

Also started by `launch-box.sh` when `KNS_SUPERVISE`, `KNS_RUN_DIR` and `KNS_CONFIG` are set; it passes `KNS_SHARED_STOP=<storm run_dir>/control/STOP` itself. `tools/storm/kns-lane.mjs` (no `--armed`) stays only as a schedule print / cross-check.

## Stop / abort

- `touch <kns-run-dir>/STOP` (KNS supervisor stop) and `touch control/STOP` (storm lanes), or hard END.
- Lane pauses itself on fee above cap; it does not retry at a higher fee.
- Abort and log if: network id not `testnet-10`, `muon` and `boson` both dead (node-dead rule), reject rate > 50 % for 2 minutes, or kns tn10 asks to stop.
- No self-restart after STOP/END.

## Logged

- KNS run folder: `runner.out`, `live/heartbeat` and the runner's own logs (private); counts per minute copied to `logs/minute-kns.csv`: `minute_utc,sent,ok,rej,inflight,paused`.
- `logs/phase.log` tokens (shared file). Counts only in git; names and txids stay private.
