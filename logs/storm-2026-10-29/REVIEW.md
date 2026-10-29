# Review: TN10 storm, Thu 29 Oct 2026 (19:00–20:00 UTC)

Times in UTC. Counts from the files in this folder.

## What worked
The mini (main node and coordinator) ran the whole hour as planned: every genesis included at 18:59:36–38, every step on time, STOP reason=END at 20:00:00. Every attempt is accounted for (sent = ok + rejects in every minute row; sec.csv has no gaps).

Headline: total hop rate rises with parallel covenant families.

| Step | Families | Total hops/s | Per family |
|---|---|---|---|
| 1 | 1 | 0.81 | 0.81 |
| 2 | 2 | 1.96 | 0.98 |
| 3 | 4 | 3.24 | 0.81 |

About 4x with 4 chains; a single chain stays under 1 hop/s (20 Oct baseline ~0.7).

## What didn't
- The state handoff was not copied from the mini, so step 1 ran on the mini sender alone.
- Public lanes muon and boson sent only 19:24–19:33 and nothing in step 3, most likely because the box host paused.
- Every node_dead flap hit both public lanes at once, which points at the box, not the public nodes.
- boson: 55 inclusions from 5,314 attempts.
- Box clock was about 0.9 s off.
- No second in the counted minutes had all four senders on at once.

## What to test next
1. Copy the handoff automatically, and keep senders from starting without it.
2. Move the public-node senders to the desk.
3. Fix the clocks on the box and the mini.
4. Run 4 families at a higher rate, and try 8 families, with every sender confirmed live from the first second.
