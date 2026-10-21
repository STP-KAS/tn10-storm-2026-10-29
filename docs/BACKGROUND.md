> **Experimental. We are just trying this.** [Disclaimer](../DISCLAIMER.md) · [Home](../README.md)

# Background: one covenant hop on Testnet-10

## What a covenant hop is

A **covenant** is a script a Kaspa output carries that says how that output may be spent. **KCC-20** is a convention for tokens whose mint and transfer rules live in such a script. As of this writing KCC-20 is **Last Call, moving to Final** ([kaspanet/kccs#41](https://github.com/kaspanet/kccs/pull/41)).

A **hop** in this plan is one spend of the current minter output that creates the next minter output. Only one spend can win each hop. The next hop spends the output that winner created. That is **contention**: many attempts, one winner per hop.

## Follow output 0

rusty-kaspa 2.1.0 has no `GetUtxosByCovenantIds`. That call is [kaspanet/rusty-kaspa#1152](https://github.com/kaspanet/rusty-kaspa/pull/1152), still open, and it needs a covenant index this release does not have. We do not rebuild kaspad for it. We do not comment on that PR.

This plan does not need that call. The coordinator watches the main node's **virtual chain**. The winner of the current outpoint is the transaction on that chain which spends it. The next state output is that transaction's **output 0**. Advance only after checking that output 0 has a covenant binding and the same KAS value as the old minter. A shape mismatch stops the phase.

Both the minter and the token output can carry the same covenant id, so an id lookup would not by itself select the minter. The script-hash address also changes when `remaining` changes. Following output 0 bypasses both problems.

## Contract and builder

The contract is `contracts/public_mint.ag` in [argent-lang/kcc20-reference](https://github.com/argent-lang/kcc20-reference) at `c8a08711`. Kaspa wasm 2.1.0 can attach a covenant id to an output. It does not compile this contract or build the redeem script. The reference build produces the genesis group, the redeem, and the next state script. Wasm signs the funding input and submits the finished transaction. No code from that build is in this repo.

## What this is not

Not a token launch. Not a mainnet result. Not a fee to copy. Keys, seeds, addresses, IPs and transaction ids stay out of this repo.
