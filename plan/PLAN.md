> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Plan · Thu 29 Oct 2026, 18:00–19:00 UTC

Several senders spend one covenant state output at the same time. Only one spend can win each hop. The next hop spends the output that winner created.

**Headline (suggested by PulseHawk):** does total hop rate scale with the number of covenant families run in parallel? Thursday runs **1, then 2, then 4 families** at a fixed **5 attempts/s per sender**. That replaces the old rising-attempt step table (1 / 2 / 5 / 10).

Attempt rate and hop rate are different. Extra attempts lose. They do not create extra hops. The 20 Oct rehearsal measured that (label A): ~0.7 hops/s at every attempt rate. See [logs/REHEARSAL-2026-10-20.md](../logs/REHEARSAL-2026-10-20.md).

## Clock

All times UTC. Brussels is CET (UTC+1) on these dates.

| Moment | UTC | Brussels (CET) |
|---|---|---|
| Drop gate | Tue 27 Oct 2026 18:00 | 19:00 |
| Genesis included by | Thu 29 Oct 17:50 | 18:50 |
| Phase start (T0) | Thu 29 Oct 18:00 | 19:00 |
| END | Thu 29 Oct 19:00 | 20:00 |
| Post-END mempool watch | 19:00–19:15 | 20:00–20:15 |

Frozen plan due by the drop gate. Contact with PulseHawk goes through stp only. PulseHawk (pulsehawk.io) counts the storm independently from its own nodes.

## Drop gate: already met (label A)

"Tested" means a real Testnet-10 submit, read back from the desk node's virtual chain: one fresh genesis, one included mint of amount 1, and one conflicting second spend rejected as already spent. A VM run does not count.

The 20 Oct desk rehearsal met that trio: fresh genesis on a new launch path, 1,287 included hops, 68,644 already-spent conflict rejects. Thursday stays on the clock above. If anything later invalidates that evidence before the gate, add a one-line `DROPPED.md` and do not arm.

## Phase design (Thursday)

### Families and rate

Contention runs at **5 attempts per second per sender** only. Same winners as higher rates in the rehearsal, far fewer orphans.

| Step | UTC window | Covenant families in parallel | Attempts/s per sender | Sender |
|---|---|---|---|---|
| 1 | 18:00:00 – 18:14:59.999 | **1** | 5 | ON |
| gap | 18:15:00 – 18:19:59.999 | — | — | **OFF 5 min** |
| 2 | 18:20:00 – 18:34:59.999 | **2** | 5 | ON |
| gap | 18:35:00 – 18:39:59.999 | — | — | **OFF 5 min** |
| 3a | 18:40:00 – 18:54:59.999 | **4** | 5 | ON |
| 3b | 18:55:00 – 18:59:59.999 | **4** (hold) | 5 | ON |

- **Count from minute 3** of each 15-minute ON step, so ramp-up stays out of the numbers. Counted minutes, exact UTC: **18:03:00–18:14:59**, **18:23:00–18:34:59**, **18:43:00–18:59:59** (3a and 3b together). A counted minute is clean only when all planned senders were on for all 60 seconds (`logs/sec.csv`).
- **Hold the top step for two phases** (3a and 3b) to get clean peak minutes. 3b is the last 5 minutes before END; together with 3a that is 20 minutes at 4 families.
- **Main sender OFF for 5 minutes between steps**, so we see how fast the network clears, not only how it holds.
- Each family is its own genesis on its own launch path. Families do not share a minter outpoint. Total hop rate = sum of per-family hops.
- Genesis for every family that will run is included before 17:50 UTC. If any required genesis is missing at 17:55 UTC, that family is dropped and the phase log says so (`FAMILY_DROP family=N reason=no_genesis`). The public `GENESIS` line carries the family number only; covenant ids stay in the private log and go to PulseHawk privately from stp by 17:55 UTC. If no family is ready, the phase does not start.

### Lanes and senders (decided 26 Oct)

- **One sender per node tag:** `desk`; `mini` (only if the mini is the main node at T−2h); **at most 2 public tags** that pass the mirror check, proposed `vector` plus one of `muon`/`boson` (`boson`, `neutrino` and `electron` count as one backend).
- **Every lane contends on every live family** (1, then 1–2, then 1–4) at 5 attempts/s per family per lane.
- **Each lane has its own funding key**, pre-split from its own coins, never shared. A lane that shares a funding key with another lane is a stop. Lane tags and rates are written into the START line of `phase.log`.
- **Genesis owner:** the coordinator on the main node (mini by default, desk if the desk is main) creates the genesis for families 1–4. Covenant ids go only in the private log.
- **Minter outpoint:** the coordinator publishes `{family, outpoint, seen_utc}` privately to the `desk` and `mini` senders. Box senders (public nodes; the private nodes are loopback-only, no tunnel) find the outpoint themselves from their own node's virtual chain; their discovery time is logged as `seen_utc` with `source=self`. Their losses count as `rej_already_spent`.
- **Coordinator failover:** if the mini dies, the desk coordinator takes over (logged with `SENDER_OFF` / `NODE_*` and `MAIN node=desk reason=mini_dead`).

### KNS lane (background, not counted)

A separate background lane: `family=0`, sender `kns`, own minute file (`logs/minute-kns.csv`), **not counted in hops**. 60 names/min, max 16 in flight, off during both 5-minute gaps, not before 18:03 UTC, hard END 19:00 UTC. Node: `vector`, with `muon` as spare, never a tag a covenant sender is using. **Fee: the one explicit exception to the one-fee rule:** capped auto fee at 1.5× priority, max 1 tKAS per name; it pauses instead of escalating. Starts on stp's GO in the kns tn10 chat plus a senders-stable signal from TN10 ops. Obeys STOP, the node-dead rule and the 90,000 guard.

### Funding per lane (amounts only)

From the 26 Oct desk dry run (P2W stand-in hop, 1 attempt/s per family, one lane): about **1 included hop/s per family**, include p50 1.2 s. Worst case one lane wins every hop: 15×1 + 15×2 + 20×4 = 125 family-minutes ≈ 7,500 hops × (≈0.009 tKAS fee at ~8,700 compute mass × 100 sompi/g + 0.2 tKAS token output) ≈ **1,600 tKAS per covenant lane**, pre-split into **≥ 100 coins of ~16 tKAS** (a coin is reusable once its change is included, ~1.2 s; ≤ 20 attempts/s per lane at 4 families). Genesis: a few tKAS minter per family plus fee, from the coordinator's own key. KNS lane: ≤ 2,820 names × ≤ 1 tKAS cap; fund ~300 tKAS and let it pause.

### Orphan definition

Written in full at [docs/ORPHAN.md](../docs/ORPHAN.md). Short form: an orphan = a hop attempt whose parent is not yet on the virtual chain; the node answers with an orphan reject and it is counted once, under `rej_orphan`. Our builder never submits a child before its parent is included, and stalls/stops if a mempool ack has no inclusion within 30 s.

### Post-END mempool watch

From END to END+15 minutes, no new attempts. Watch the main node's mempool size and the public nodes that were in the tag set. Record whether orphans clear, and how long that takes. One row per minute in `logs/post-end-mempool.csv` (counts only).

## Nodes

- **Desk:** one rusty-kaspa 2.1.0 node, Testnet-10, UTXO index on, default ram scale, `--rpcmaxclients=24`. Leave that process up. Do not start a second kaspad on the desk. Do not wipe its app directory. Since the 26 Oct restart every listener (gRPC/wRPC, peer, Borsh) is on loopback only. UPnP stays off.
- **Mini PC:** live since 22 Oct 2026 (rusty-kaspa 2.1.0, Testnet-10, UTXO index on, `--ram-scale=0.6 --async-threads=8`, all listeners on loopback). It becomes the main node when it is synced and the coordinator can read its virtual chain (checked at T−2h). Until then the desk node is the chain reader. After the handover the desk node stays up as one sender target.
- **Public submits:** wRPC Borsh on Testnet-10 hostnames. Candidate set: muon-10.kaspa.blue, boson-10.kaspa.red, electron-10.kaspa.blue, neutrino-10.kaspa.stream, vector-10.kaspa.green. Some of those names have returned the same figures and may be one backend. Before the phase, keep a public name only when its version is 2.1.0, its network id is testnet-10, and its mempool size is under 90,000. If two names move together, use one of them. A public node at or above 90,000 mempool entries is skipped for the rest of the phase (ram-scale 0.1 caps a pool at 100,000 and the next insert can panic the process).

Every connection aborts unless the network id is `testnet-10`. A skipped node logs `NODE_SKIP node=<tag> reason=mempool_90k`; a node dropped for the hop shape logs `NODE_DROP node=<tag> reason=redeem_shape`.

**Own miner:** our box runs one CPU miner (`stp bot`, 3 workers, mining through public TN10 nodes) and it keeps running through the window; no miner runs on the mini or the desk (desk checked 26 Oct). `phase.log` records `MINER state=on|off workers=N miner=<label>` at T0 and at every change, with the UTC second.

The Thursday target is desk, mini, and up to three public names. The phase still runs if mini is late, as long as the drop gate has passed and at least two nodes are connected. The phase log records the tag set and the rate in the start line.

## What is built

The contract is `contracts/public_mint.ag` in argent-lang/kcc20-reference at `c8a08711`. Kaspa wasm 2.1.0 can attach a covenant id to an output. It does not compile this contract or build the redeem script. The reference build produces the genesis group, the redeem, and the next state script. Wasm signs the funding input and submits. rusty-kaspa 2.1.0 has no `GetUtxosByCovenantIds` ([kaspanet/rusty-kaspa#1152](https://github.com/kaspanet/rusty-kaspa/pull/1152), still open). We follow output 0 instead. Do not rebuild kaspad. Do not comment on either upstream repo.

This phase uses a new key and a new launch path per family, so each covenant id is new. Fixed parameters (same for every family, only the launch-path name changes):

- version 1 transactions
- mint amount 1, per-mint limit 1
- starting remaining 100,000
- owner scheme `0x00`, borrow scheme `0x00`, 32 zero bytes of borrow guard
- one fee rate for every sender, chosen at the start from the main node's normal bucket and floored at 100 sompi per gram

The relay fee is that rate times `max(compute mass, ceil(transient mass / 2))`. Storage mass is committed and is not the fee base. Expect a redeem of about 6,000 bytes and a compute mass of about 8,700. If compute mass is above 100,000, do not submit.

Genesis spends one fresh funding coin. Output 0 is the minter and carries the covenant. Output 1 is plain change. The minter value is a few KAS and is copied unchanged onto every later minter output.

A hop is this shape, and every sender uses it:

- input 0 spends the current minter outpoint
- input 1 spends that sender's own funding coin
- output 0 is the next minter, same value, remaining reduced by 1
- output 1 is the token output (use a value whose committed storage mass is under the 500,000 block storage limit; the 20 Oct rehearsal needed 0.2 KAS because 0.05 KAS measured storage mass 803,963)
- output 2 is change back to that sender

Do not submit the child before the parent is on the virtual chain. If a mempool acceptance has no virtual-chain inclusion within 30 seconds, write `STALL` and stop.

## Senders

One process per node tag (see Lanes and senders above): `desk`, `mini` (only if main at T−2h), at most 2 public tags.

The public-node senders run on the box, so the box stamps `ts` for them; `desk` and `mini` stamp their own. Each sender is a token bucket at 5 attempts/s per live family, aligned to the UTC second. Scripts: [tools/storm/](../tools/storm/README.md). One attempt is one fully built transaction handed to that sender's node. During the 5-minute gaps every sender builds nothing.

## Logging

The run directory is outside this repo. Columns and files: [go/LOGGING.md](../go/LOGGING.md). After END, the counts-only files listed in LOGGING.md (`minute.csv`, `sec.csv`, `ntp.csv`, `phase.log`, `post-end-mempool.csv`, hwlog CSVs) may be added here only after a scan finds no key, seed, address, IP, transaction id, hostname or user path. `submit.jsonl` and the private genesis log stay on disk. Clocks: `logs/ntp.csv` for desk, mini and box at 16:00, 17:55 and 19:01 UTC; an offset over 100 ms is logged as is.

PulseHawk's count is transactions it sees in blocks. Compare that count with `winners`. `sent` and `ok` are local submit results; every attempt lands in exactly one of `ok` or one `rej_*` column, so `sent = ok + sum(rej_*)` per minute. This plan does not message PulseHawk.

## Stop

Two switches, both checked before every attempt.

1. **Stop switch:** a file `control/STOP` in the run directory. Creating it stops every sender. Phase log: `reason=STOP`.
2. **Hard stop:** END, 2026-10-29T19:00:00.000Z, even if STOP was never created. Phase log: `reason=END`.

Whichever fires first is the one recorded. No sender restarts itself. An attempt already on the wire is logged, and nothing new is built. Node-dead rule: a sender stops when its node is dead (RPC failing, not synced, lag over 60 s, or DAA score still for 30 s), logged as `SENDER_OFF sender=<label> reason=node_dead`; a manual restart logs `SENDER_ON sender=<label>`. A failed submit is a reject, never "sent".

## Risks

- A builder pointed at an old launch path would move a covenant this test does not own. The path allow-list is the family set for this phase, and each key is new.
- Counting a mempool ack as a hop repeats an old mix-up with PulseHawk's block count. Hops move on the virtual chain only.
- Submitting the next hop before the parent is included produces orphan rejects and can stall the chain of state. The 30 second stall stop is the bound.
- Public nodes may reject the large redeem on fee or mass, or may be an older server. A node that rejects the shape is dropped from the tag set. If no public node accepts it, Thursday is desk and mini only, and the phase log says so.
- One copied transaction can sit in each mempool until a block. That is one entry per node per hop, not one entry per attempt. The 90,000 pause is still on.
- Remaining cannot run out inside the hour at mint amount 1 and a start of 100,000 per family.
- Output order other than "output 0 is the next minter" makes the follower pick the token output. That is a shape mismatch and a stop, not a guess.
- A second kaspad on the desk collides with the running node. The mini PC is the other machine.

## Out of scope

No mainnet. No spend of an existing covenant. No kaspad upgrade. No tag, release, or upstream comment. No sender or coordinator code in this repo (only the passive loggers in `tools/`).
