# Node check, 22 Oct 2026 (TN10)

Read-only checks with `node/check-node.ps1` from [tn10-run-kit](https://github.com/STP-KAS/tn10-run-kit). Times in UTC. Local paths, machine names and IPs left out.

| | Mini PC | Desk PC |
|---|---|---|
| Read at (UTC) | 18:03:11 | 19:21:44 |
| kaspad | 2.1.0, testnet-10 | 2.1.0, testnet-10 |
| Synced | yes | yes |
| Peers | 8 | 8 |
| Virtual DAA score | 603,580,755 | 603,625,730 |
| Blocks (= headers) | 1,455,334 | 1,500,308 |
| utxoindex | off | on |
| RPC / P2P listen | 127.0.0.1 only | 127.0.0.1 only (JSON wRPC off, read over Borsh) |
| Flags of note | `--ram-scale=0.6` | |
| Sink hash | not printed (old script) | f68a679e11a918bdb9c07cec048973e9fe128dd5c690c8226f6617d748da4d93 (292 ms old) |

Between the two reads the DAA score rose by 44,975 and blocks by 44,974 over 4,713 s (about 9.5 per second, TN10's normal pace), so both are on the same chain. A same-minute sink-hash match is still to do (`check-node.ps1` prints the sink from commit 15825a5).

Roles: mini synced 18:03 UTC, reader/monitor for now. Desk keeps reading until the same-minute tip match; then the mini becomes main node and sender (utxoindex needed first).

## Same-minute tip check, 19:28 UTC

Read by TN10 ops directly on both machines, 14 s apart (read-only).

| | Desk | Mini |
|---|---|---|
| Read at (UTC) | 19:28:24.7 | 19:28:38.3 |
| Sink | b3337da49f471db39b8f4eb40f0b62bc9b48ea33e4c62c52d4cc11d7c669c28a | a0ceb749c814237e0e798987103e072486d52d2e0ed533a8fe467b15e783cad5 |
| Virtual DAA score | 603,631,513 | 603,631,729 |

The desk's sink block is present on the mini (DAA 603,631,510). The 216-point DAA gap matches the 14 s between reads. **Result: same tip.** From 19:28 UTC the mini is cleared to be main node; the sender role still needs utxoindex (decided after Pulse's advice).
