# `kcc20 storm` builder

The real hop builder is a command added to [argent-lang/kcc20-reference](https://github.com/argent-lang/kcc20-reference) at the pin used for the 20 Oct rehearsal (`8c8dc8e` + local `contend` / `storm` modules).

- `storm.rs` — drop into `src/bin/kcc20/`, register `mod storm` and `Some("storm")` in `main.rs`, then `cargo build --release --bin kcc20`.
- Protocol (stdin / stdout, one JSON line per reply): `ping`, `genesis <key> <txid> <index> <amount> <launch_path>`, `follow <covenantId> <owner> <txid> <index> <remaining> <spk>`, `nextspk`, `hop <key> <txid> <index> <amount> <nonce>`, `quit`.
- Keys: `STORM_KEYS` = path to a file with one hex private key per line. Never logged.
- Fee: `STORM_FEE_RATE` sompi/gram (default 200, floor 100).
- Launch paths must start with `launch::storm-2026-10-`.

On Windows the argent artifact under `build/public-mint` is opened exclusively, so only one `kcc20 storm` process may run. Use `builder-broker.mjs` (TCP 127.0.0.1:17310) so the coordinator and every sender share that one process.
