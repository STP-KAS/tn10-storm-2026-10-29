> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-BOT · the box (TN10 ops) · Thu 29 Oct 2026, 19:00–20:00 UTC (20:00–21:00 CET)

You are **Grok Bot**, TN10 ops on the box (Linux). Overview: [GO-MAP.md](GO-MAP.md). Other sides: [GO-BUILD.md](GO-BUILD.md), [GO-MINI.md](GO-MINI.md). Rules: [README.md](README.md).

**Status: GO** (stp, Tue 27 Oct 2026). Locked; changes go in `phase.log` as a deviation. Time: **START 19:00 UTC, END 20:00 UTC (20:00–21:00 CET), confirmed with PulseHawk 27 Oct** (moved +1 h after the freeze; see the dated change in [GO-MAP](GO-MAP.md#dated-changes)).

## Your role

- **Public-node senders**, one per public name that survives the check, tagged by name (`muon`, `boson`, `electron`, `neutrino`, `vector`). wRPC Borsh on the Testnet-10 resolver names in [plan/PLAN.md](../plan/PLAN.md#nodes). 5 attempts/s each during ON steps.
- **Public-node check** at T-1h and every minute during the phase (mempool size for the 90,000 guard).
- **Control and logging watch:** NTP, STOP file, END, push counts-only files after END.
- No own node; never submit to the desk or mini node.

## Pre-flight checklist

- [ ] T-24h: each candidate public name: version 2.1.0, network id `testnet-10`, mempool < 90,000. Two names that move together → keep one.
- [ ] Public tags this phase (decided 27 Oct): `muon` (key 1) + `boson` (key 2). `vector` is the alternate only if it passes the T-1h check (it failed TLS connect from the box on 27 Oct); it then needs an explicit key.
- [ ] Funding coins per public lane, own key per lane, from the TN10 treasury in small batches (never a full UTXO load). ~1,600 tKAS per lane pre-split into ≥ 100 coins; at most 2 public lanes (`muon` + `boson`; `vector` alternate).
- [ ] Shape test: one hop-sized tx accepted by each kept name (fee/mass not rejected); a name that rejects the shape is dropped.
- [ ] T-2h, T-5 min, END+1 min: `python3 tools/ntplog.py --machine box --out <run>/logs/ntp.csv` (box stamps `ts` for public senders).
- [ ] T-1h: tag set final, written to the START line.
- [ ] T-5 min: `control/STOP` absent.

## Start / stop

Run directory: a private box folder outside any repo.

```bash
# public sender: tools/storm/sender.mjs --source self (tip-find catchUp on the sender's own node)
STORM_CONFIG=<run>/config.json KNS_SUPERVISE=<tn10-1984-water>/kns/scripts/kns-abc-supervise.sh KNS_RUN_DIR=<fresh-kns-run> KNS_CONFIG=<fresh-kns-run>/config/storm.json tools/storm/launch-box.sh <muon-url> <boson-url>   # muon (key 1) + boson (key 2) + KNS lane ([GO-KNS](GO-KNS.md)); alternate: PUB1_LABEL/PUB2_LABEL=vector with an explicit PUB1_KEY/PUB2_KEY; each lane signs with its own key
# box CPU miner: keeps running, modest, public nodes; no txs
touch control/STOP   # stop switch
```

**After GENESIS (T-9 min): state handoff.** Remote senders run `--source self` and need `state/family-N.json` from the mini. Mini: `node handoff.mjs export > handoff.json` (STORM_CONFIG set). Copy it into the desk and box run folders, then there: `node handoff.mjs import handoff.json`. Senders wait (no attempts) until the files exist. Never hand-edit state files.

## Logging

As [LOGGING.md](LOGGING.md), one `sender`/`node` tag per public name. `post-end-mempool.csv` for each public name in the tag set, 20:00–20:15.

## Abort rules

90,000-mempool guard (skip name for rest of phase), node-dead rule, network id check, STALL from the coordinator, STOP file, hard END. Never retarget to a name outside the tag set mid-phase.
