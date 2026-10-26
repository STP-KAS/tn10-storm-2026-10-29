// sender.mjs --label <tag> --node <wrpc-url>: token bucket per family at the step rate, aligned to the UTC second.
// Spends only the outpoint the coordinator published. Logs every attempt to private/submit-<label>.jsonl.
// Node-dead rule, 90,000-mempool skip, shape drop, STOP file, hard END. Never restarts itself. TESTNET-10 ONLY.
import fs from "node:fs";
import { CFG, P, phase, iso, sleep, to, stepAt, END, STOPF, laneScript, buildHop, reason, connect, readState, arg } from "./lib.mjs";
const LABEL = arg("label"), URL = arg("node"); if (!LABEL || !URL) { console.error("usage: --label <tag> --node <url>"); process.exit(5); }
const FEE = BigInt(CFG.fee_sompi_per_gram || 100);
const LOG = fs.createWriteStream(P("private", `submit-${LABEL}.jsonl`), { flags: "a" });
const fams = new Map(CFG.families.map((f) => [f.family, laneScript(f.lane_id)]));
let rpc = await connect(URL);
let alive = true, skipped = false, dropped = false, daa = 0n, daaAt = Date.now(), salt = 0, shapeRej = 0, shapeTry = 0;
async function health() {
  let bad = "";
  try {
    const [si, dag, info] = await Promise.all([to(rpc.getServerInfo(), 5000), to(rpc.getBlockDagInfo(), 5000), to(rpc.getInfo(), 5000)]);
    const d = BigInt(dag.virtualDaaScore); if (d !== daa) { daa = d; daaAt = Date.now(); }
    if (!si.isSynced) bad = "not_synced"; else if (Date.now() - daaAt > 30000) bad = "daa_still";
    if (!skipped && Number(info.mempoolSize) >= 90000) { skipped = true; phase(`NODE_SKIP node=${LABEL} reason=mempool_90k`); }
  } catch { bad = "rpc"; try { await rpc.disconnect(); } catch {} try { rpc = await connect(URL); } catch {} }
  if (bad && alive) { alive = false; phase(`SENDER_OFF sender=${LABEL} reason=node_dead`); }
  else if (!bad && !alive && !fs.existsSync(P("control", `HOLD-${LABEL}`))) { alive = true; phase(`SENDER_ON sender=${LABEL}`); }
}
setInterval(() => health().catch(() => {}), 5000);
const inflight = new Map();   // family -> count
async function attempt(fam) {
  const st = readState(fam); if (!st) return;
  const h = buildHop(fams.get(fam), st, FEE, (salt = (salt + 1) % 5000)); if (!h) return;
  const ts = iso(); let result = "ok", why = "";
  inflight.set(fam, (inflight.get(fam) || 0) + 1);
  try { await to(rpc.submitTransaction({ transaction: h.tx, allowOrphan: false }), 8000, "submit"); }
  catch (e) { result = "rejected"; why = reason(e); }
  inflight.set(fam, inflight.get(fam) - 1);
  LOG.write(JSON.stringify({ ts, sender: LABEL, node: LABEL, family: fam, txid: h.txid, result, reason: why }) + "\n");
  if (++shapeTry <= 20 && (why === "mass" || why === "fee")) { if (++shapeRej >= 5 && !dropped) { dropped = true; phase(`NODE_DROP node=${LABEL} reason=redeem_shape`); } }
}
const bucket = new Map(); let last = Date.now();
while (true) {
  const now = Date.now();
  if (now >= END || fs.existsSync(STOPF)) break;
  const s = stepAt(now); const dt = (now - last) / 1000; last = now;
  const on = s && s.step !== "gap" && alive && !skipped && !dropped;
  for (const fam of fams.keys()) {
    if (!on || fam > s.families || !readState(fam)) { bucket.set(fam, 0); continue; }
    let b = Math.min((bucket.get(fam) || 0) + s.rate * dt, Math.max(1, s.rate * 0.2));
    while (b >= 1) { b -= 1; attempt(fam); }
    bucket.set(fam, b);
  }
  await sleep(20);
}
await sleep(3000); LOG.end(); await rpc.disconnect().catch(() => {}); process.exit(0);
