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
