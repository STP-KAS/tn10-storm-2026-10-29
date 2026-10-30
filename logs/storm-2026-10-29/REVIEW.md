# Review: TN10 storm, Thu 29 Oct 2026 (19:00–20:00 UTC)

Times in UTC. Counts from the files in this folder.

## What worked
The mini (main node and coordinator) ran the whole hour as planned: every genesis included at 18:59:36–38, every step on time, STOP reason=END at 20:00:00. Every attempt is accounted for (sent = ok + rejects in every minute row; sec.csv has no gaps).

Headline: total hop rate rises with parallel covenant families.

| Step | Families | Total hops/s | Per family |
|---|---|---|---|
| 1 | 1 | 0.81 | 0.81 |
| 2 | 2 | 1.95 | 0.975 |
| 3 | 4 | 3.24 | 0.81 |

About 4x with 4 chains; a single chain stays under 1 hop/s (20 Oct baseline ~0.7).

## What didn't
- The state handoff was not copied from the mini, so step 1 ran on the mini sender alone.
- Public lanes muon and boson sent only 19:24–19:33 and nothing in step 3, most likely because the box host paused.
- Every node_dead flap hit both public lanes at once, which points at the box, not the public nodes.
- boson: 55 inclusions from 5,314 attempts.
- Box clock was about 0.9 s off.
- 525 s had all four senders on (19:24:42–19:33:50 UTC, from sec.csv), in step 2 only (2 families). Step 3 (4 families) never had more than 2 senders on, so there was no full-load second.
- Hops come only from the mini coordinator's record; `coordinator.mjs` skips hops when it resyncs to the tip. That undercounts by about 1% against PulseHawk's independent on-chain count (+57 by our sum, 61 by theirs), visible only in multi-sender minutes. Fix planned: hop back-fill.

## What to test next
1. Copy the handoff automatically, and keep senders from starting without it.
2. Move the public-node senders to the desk.
3. Fix the clocks on the box and the mini.
4. Run 4 families at a higher rate, and try 8 families, with every sender confirmed live from the first second.

## Node load (added 29 Oct, 21:39 CET)

This was not a heavy load. Total throughput peaked at about 3.24 hops/s, the mempool peaked at 61 (desk) and 58 (mini), and RPC calls stayed under 17 ms inside the counted minutes. A clean result from both nodes is therefore the expected result at this load. It does not show where the nodes' limits are. Finding those needs the higher-load tests listed above (4 families at a higher rate, and 8 families).

## Overall score (added 29 Oct, 23:22 CET)

Operator's own score: 6/10. The result itself is clean: throughput scaled from 0.81 hops/s (1 family) to 1.95 (2) to 3.24 (4), counted independently, and both nodes stayed healthy. Points were lost on execution. The handoff copy failed, the covenant ids and the KNS lane were late, the box senders only ran 19:24–19:33 UTC, the boson lane landed 55 of 5,314 attempts, and the only 4/4-sender seconds (525 s, 19:24:42–19:33:50 UTC) were in step 2 with 2 families; step 3 (4 families) had at most 2 senders on, so no full-load second. The load was light, so the run does not show where the nodes' limits are. To score 8–9 next time: copy the handoff automatically and have senders refuse to start without it, run the public-node senders from the desk, fix the clocks, then run 4 families at a higher rate and try 8 families.

## Corrections (31 Oct 2026)

Corrected after PulseHawk's independent count of this run: step 2 is 1.95/s (0.975 per family), not 1.96; 525 s did have 4/4 senders (step 2 only), replacing "no second had all four senders"; added the ~1% hop undercount from coordinator resync skips. Thanks to PulseHawk for the count.
