> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Orphan: shared definition

Kaspa Pulse (@gokugalax, kaspapulse.com) asked that both sides count the same thing. This is the definition used in this plan and in the Thursday logs.

## Definition

An **orphan** is a hop attempt that a node accepted into its mempool, but whose **parent is not yet on the virtual chain**.

In our reject column that is `rej_orphan`.

## What we do, and what we do not do

Our builder **never submits a child before its parent is included** on the virtual chain. The coordinator publishes the next outpoint only after that inclusion. Senders read that published outpoint; they do not decide the next outpoint from their own submit acknowledgement.

If a mempool acceptance has **no virtual-chain inclusion within 30 seconds**, the coordinator writes `STALL` in the phase log and **stops**. That bound is there so a chain of unconfirmed hops cannot keep growing in the orphan pool.

## What the 20 Oct rehearsal showed (label A)

At 5 / 10 / 20 attempts per second per sender, orphans were about 13% / 16% / 17% of submits. Raising the attempt rate raised orphans and already-spent rejects; it did not raise the hop rate. That is why Thursday runs contention at **5/s only** and asks the parallel-families question instead. See [logs/REHEARSAL-2026-10-20.md](../logs/REHEARSAL-2026-10-20.md).

## What this is not

- Not a fee reject, mass reject, mempool-full, route, or RPC error. Those have their own columns.
- Not an already-spent conflict. That is `rej_already_spent`: a later submission of an outpoint that already has a mempool copy.
- Not a count of transactions Kaspa Pulse sees in blocks. His counter is accepted-in-blocks; orphans never reach that counter.
