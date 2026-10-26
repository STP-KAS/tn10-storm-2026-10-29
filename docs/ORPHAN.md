> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Orphan: shared definition

PulseHawk (pulsehawk.io) counts the storm independently from its own nodes. It asked that both sides count the same thing. This is the definition used in this plan and in the Thursday logs.

## Definition

An **orphan** is a hop attempt whose **parent is not yet on the virtual chain**, so the node cannot resolve its minter input. Our senders submit with orphans not allowed, so the node answers with an orphan reject and the attempt is **not** counted as `ok`.

In `minute.csv` that attempt is counted once, under `rej_orphan`, and nowhere else. Every attempt lands in exactly one of `ok` or one `rej_*` column, so `sent = ok + sum(rej_*)` per row. (Earlier wording called it "mempool-accepted"; that was wrong for our counting. A node that keeps it in an orphan pool still returns the orphan answer to us, and we count the answer.)

## What we do, and what we do not do

Our builder **never submits a child before its parent is included** on the virtual chain. The coordinator publishes the next outpoint only after that inclusion. Senders read that published outpoint; they do not decide the next outpoint from their own submit acknowledgement.

If a mempool acceptance has **no virtual-chain inclusion within 30 seconds**, the coordinator writes `STALL` in the phase log and **stops**. That bound is there so a chain of unconfirmed hops cannot keep growing in the orphan pool.

## What the 20 Oct rehearsal showed (label A)

At 5 / 10 / 20 attempts per second per sender, orphans were about 13% / 16% / 17% of submits. Raising the attempt rate raised orphans and already-spent rejects; it did not raise the hop rate. That is why Thursday runs contention at **5/s only** and asks the parallel-families question instead. See [logs/REHEARSAL-2026-10-20.md](../logs/REHEARSAL-2026-10-20.md).

## What this is not

- Not a fee reject, mass reject, mempool-full, route, or RPC error. Those have their own columns.
- Not an already-spent conflict. That is `rej_already_spent`: a later submission of an outpoint that already has a mempool copy.
- Not a count of transactions PulseHawk sees in blocks. Its counter is accepted-in-blocks; orphans never reach that counter.
