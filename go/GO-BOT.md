> **DRAFT - basics only.** Locked after PulseHawk reviews the repo and the mini PC node is live and synced; frozen plan due Tue 27 Oct 18:00 UTC.
>
> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md) · [GO rules](README.md) · Kaspa Testnet-10 only.

# GO-BOT · the box (TN10 ops) · Thu 29 Oct 2026, 18:00–19:00 UTC (19:00–20:00 CET)

You are **Grok Bot**, TN10 ops on the box (Linux). Overview: [GO-MAP.md](GO-MAP.md). Other sides: [GO-BUILD.md](GO-BUILD.md), [GO-MINI.md](GO-MINI.md). Rules: [README.md](README.md).

**Not armed until stp sends GO.**

## Your role

- **Public-node senders**, one per public name that survives the check, tagged by name (`muon`, `boson`, `electron`, `neutrino`, `vector`). wRPC Borsh on the Testnet-10 resolver names in [plan/PLAN.md](../plan/PLAN.md#nodes). 5 attempts/s each during ON steps.
- **Public-node check** at T-1h and every minute during the phase (mempool size for the 90,000 guard).
- **Control and logging watch:** NTP, STOP file, END, push counts-only files after END.
- No own node; never submit to the desk or mini node.

## Pre-flight checklist

- [ ] T-24h: each candidate public name: version 2.1.0, network id `testnet-10`, mempool < 90,000. Two names that move together → keep one.
- [ ] Funding coins per public lane, own key per lane, from the TN10 treasury in small batches (never a full UTXO load). TODO: amount per lane.
- [ ] Shape test: one hop-sized tx accepted by each kept name (fee/mass not rejected); a name that rejects the shape is dropped.
- [ ] T-2h, T-5 min, END+1 min: `python3 tools/ntplog.py --machine box --out <run>/logs/ntp.csv` (box stamps `ts` for public senders).
- [ ] T-1h: tag set final, written to the START line.
- [ ] T-5 min: `control/STOP` absent.

## Start / stop

Run directory: TODO (box path outside this repo).

```bash
# TODO: public sender start command (script not written yet)
touch control/STOP   # stop switch
```

## Logging

As [LOGGING.md](LOGGING.md), one `sender`/`node` tag per public name. `post-end-mempool.csv` for each public name in the tag set, 19:00–19:15.

## Abort rules

90,000-mempool guard (skip name for rest of phase), node-dead rule, network id check, STALL from the coordinator, STOP file, hard END. Never retarget to a name outside the tag set mid-phase.
