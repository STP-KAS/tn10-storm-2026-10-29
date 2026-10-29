# TN10 storm, 29 Oct 2026 · post-END logs (counts only)

Testnet-10 only. Main node and coordinator: mini. Files are labelled by source (`-mini`, `-desk`, `-box`).
`minute.csv` and `sec.csv` merge all four senders (mini, desk, muon, boson) the same way `tools/storm/aggregate.mjs` does; inclusions come from the mini coordinator's hop record. No txids, covenant ids, addresses, keys, hostnames, IPs or user paths are in these files (scanned before commit).

`covenant-id-sha256.csv`: SHA-256 of each family's covenant id, taken as the lowercase 64-char hex string (UTF-8, no newline).

## Files
minute.csv, sec.csv, phase-{mini,desk,box}.log, ntp-{mini,desk,box}.csv, post-end-mempool-{desk,box}.csv, hwlog-{desk,mini}.csv, node-watch-{desk,mini}.csv, node-recovery-desk.csv, covenant-id-sha256.csv.

Not included yet: `post-end-mempool-mini.csv` (not written on the mini), `node-recovery-mini.csv` is still absent. `node-recovery-desk.csv` starts at 20:20Z. Desk node-watch runs 18:45-20:20Z and desk hwlog runs 18:30-20:30Z, mini `ntp.csv` has only the 18:08Z row (18:55Z and 20:01Z not taken).

## Deviations (from phase.log)
- Genesis was in a block on time (18:59:36–38Z); START 19:00Z, END 20:00Z on the mini.
- Handoff copy from mini to box and desk failed (`handoff_copy no_route_to_desk_or_box`, 19:01Z); box and desk imported it late (~19:24Z), so box and desk lanes joined late (step 1 ran on the mini sender only).
- Box public lanes (muon, boson) had `node_dead` flaps (19:15Z, 19:35Z, 19:53Z, 19:54Z) and sent no attempts after 19:33:50Z; no box END line, possible box host pause near END.
- KNS background lane started late (~19:25Z), not counted.
- Covenant ids sent to PulseHawk late (~19:25Z, deadline 18:55Z).
- Mini-side items: main decision late, w32time unsynced (offset 50.2 ms), sec_from 18:59Z in config vs 18:55Z spec (sec.csv here covers 18:55–19:59:59Z).
