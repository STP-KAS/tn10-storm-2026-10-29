# 27 Oct post-freeze test finding: false node_dead + slow failover (TEST BRANCH ONLY)

Not part of Thursday. Pulse (27 Oct 20:15 CET): Thursday runs exactly what rehearsal 1027f ran; this fix is
tested separately on branch `fix/node-dead-2026-10-27` in separate test kits (`<your-folder>\tn10-storm-kit-test`).

## Found in dress rehearsal 1027g (18:08-18:38 UTC)
- 18:20:56Z: mini and desk senders both logged `SENDER_OFF reason=node_dead` in the same second. Neither kaspad restarted.
  Both nodes kept answering RPC (submits were still answered "already spent ... in the mempool"), so the trigger was
  the `daa_still` branch (virtual DAA unchanged for 30 s), not RPC failure. The public TN10 DAG had no block gap
  >3 s in 18:19:58-18:21:56 (public API), and the public-node lanes kept getting hops accepted, so the network was
  moving: both private nodes stopped advancing their virtual at about 18:20:26 at the same time (shared cause on
  their side: same LAN/uplink or both nodes' virtual processing under load). Cause of that is under watch (monitor.mjs).
- Old check: one failed probe = dead; DAA still 30 s = dead, with no comparison to any other node and no detail logged.
- 18:21:43Z mini coordinator STALL family=1 -> STOP: its own node was frozen, so it saw no hops; it had no fallback.
- 18:31:26Z desk MAIN: manual `launch-desk.ps1 -Takeover`; no automatic failover existed -> 10 min gap.
- Box lanes: "input 0 script failed: script ran, but verification failed" came from catchUp on a stale self-state
  (two box lanes share one state dir); error escaped attempt() unlogged. 5 lines in ~32k attempts, no effect on hops.

## Fix (test branch)
- sender.mjs: rpc dead only after 3 failed probes; daa_still only if a reference node (`ref_node_url`) advanced in
  the same 30 s; `NET_STILL`/`NET_MOVING` if both still; `detail=` and `lag=` on SENDER_OFF/ON; stale self-state
  logged as reason `stale_state`.
- coordinator.mjs: watches its node (DAA still 20 s while reference moves, or 3 failed probes, or a would-be STALL)
  and fails over automatically to `coord_fallback` [{label,url}], re-finds every tip, keeps going (`MAIN ... auto=1`).
- monitor.mjs: side log every 3 s (RPC latency, synced, DAA, ref DAA, lag, peers, mempool, CPU, free RAM).
