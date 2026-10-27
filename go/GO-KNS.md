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
| Node | `vector` (spare `muon`) |
| Fee | 1.5× priority, capped at 1 tKAS/name; **pause, never escalate** |
| Funding | KNS lane wallet (topped up 26 Oct); own key, not shared with any storm lane |

## Pre-flight

- [ ] T−24h: kns tn10 confirms the create runner path and that the lane wallet balance covers ≥ 60 min × 60 names at cap.
- [ ] T−1h: `vector` passes the public-node check (2.1.0, `testnet-10`, mempool < 90,000); else `muon`.
- [ ] T−10 min: dry print (no `--armed`) shows correct from/end/gaps/node.
- [ ] T−5 min: `control/STOP` absent; arm.

## Arm

```bash
cd <your-folder>/tn10-storm-kit
export STORM_CONFIG=<your-folder>/tn10-storm-run/config.json   # private, outside any repo
node kns-lane.mjs --runner <kns-tn10-folder>/scripts/kns-smoke-create.mjs            # dry print, check it
nohup node kns-lane.mjs --runner <kns-tn10-folder>/scripts/kns-smoke-create.mjs --armed > kns.out 2>&1 &
```

The lane sleeps until START+3 min and exits at END by itself. Also started by `launch-box.sh` when `KNS_RUNNER` is set.

## Stop / abort

- `touch control/STOP` (shared with all box lanes), or hard END.
- Lane pauses itself on fee above cap; it does not retry at a higher fee.
- Abort and log if: network id not `testnet-10`, `vector` and `muon` both dead (node-dead rule), reject rate > 50 % for 2 minutes, or kns tn10 asks to stop.
- No self-restart after STOP/END.

## Logged

- `logs/minute-kns.csv`: `minute_utc,sent,ok,rej,inflight,paused`.
- `logs/phase.log` tokens (shared file). Counts only in git; names and txids stay private.
