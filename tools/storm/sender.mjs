// sender.mjs --label <tag> --node <wrpc-url> [--source self|coord]
// Real covenant hop via `kcc20 storm`. Token bucket per family at the step rate. Logs every attempt.
// source=coord (default): spends the outpoint the coordinator published in state/.
// source=self: discovers the next outpoint from this sender's own node (public-node senders on the box).
// TESTNET-10 ONLY. Never prints a key.
import fs from "node:fs";
import { CFG, P, phase, iso, sleep, to, stepAt, END, STOPF, reason, connect, readState, writeState, arg } from "./lib.mjs";
import { startBuilder, buildHop, catchUp, Pool, keyAddress } from "./covenant.mjs";

const LABEL = arg("label"), URL = arg("node"), SOURCE = arg("source", "coord");
if (!LABEL || !URL) { console.error("usage: --label <tag> --node <url> [--source self|coord]"); process.exit(5); }
const KEY = Number(arg("key", CFG.sender_key ?? 0));
const LOG = fs.createWriteStream(P("private", `submit-${LABEL}.jsonl`), { flags: "a" });
const rpc = await connect(URL);
const B = startBuilder(P("private", `builder-${LABEL}.err`));
await B.ask("ping", 120000);
const addr = keyAddress(KEY);
const pool = new Pool(rpc, addr); await pool.refresh();
const nFam = CFG.families.length;
let alive = true, skipped = false, dropped = false, daa = 0n, daaAt = Date.now(), nonce = 1, shapeRej = 0, shapeTry = 0;
const selfState = new Map();   // family -> state, for source=self

async function health() {
  let bad = "";
  try {
    const [si, dag, info] = await Promise.all([to(rpc.getServerInfo(), 5000), to(rpc.getBlockDagInfo(), 5000), to(rpc.getInfo(), 5000)]);
    const d = BigInt(dag.virtualDaaScore); if (d !== daa) { daa = d; daaAt = Date.now(); }
    if (!si.isSynced) bad = "not_synced"; else if (Date.now() - daaAt > 30000) bad = "daa_still";
    if (!skipped && Number(info.mempoolSize) >= 90000) { skipped = true; phase(`NODE_SKIP node=${LABEL} reason=mempool_90k`); }
  } catch { bad = "rpc"; }
  if (bad && alive) { alive = false; phase(`SENDER_OFF sender=${LABEL} reason=node_dead`); }
  else if (!bad && !alive && !fs.existsSync(P("control", `HOLD-${LABEL}`))) { alive = true; phase(`SENDER_ON sender=${LABEL}`); }
  if (Date.now() - pool.at > 5000) pool.refresh().catch(() => {});
}
setInterval(() => health().catch(() => {}), 5000);

async function current(fam) {
  if (SOURCE === "self") {
    let st = selfState.get(fam) || readState(fam);
    if (!st || !st.covenantId) return null;
    st = await catchUp(rpc, B, st);
    selfState.set(fam, st);
    // also refresh the shared state so aggregate can join; source noted in hops by the self path
    writeState(fam, { ...st, source: "self" });
    return st;
  }
  return readState(fam);
}

async function attempt(fam) {
  const st = await current(fam); if (!st || !st.covenantId) return;
  const coin = pool.pick(fam, nFam); if (!coin) return;
  let h; try { h = await buildHop(B, st, coin, KEY, nonce++); } catch (e) { LOG.write(JSON.stringify({ ts: iso(), sender: LABEL, node: LABEL, family: fam, txid: "", result: "rejected", reason: "other", err: String(e.message || e).slice(0, 120) }) + "\n"); return; }
  if (h.compute > 100000) return;
  const ts = iso(); let result = "ok", why = "", err = "";
  try { await to(rpc.submitTransaction({ transaction: h.tx, allowOrphan: false }), 8000, "submit"); }
  catch (e) { result = "rejected"; why = reason(e); err = String(e?.message || e).replace(/\s+/g, " ").slice(0, 160); }
  const row = { ts, sender: LABEL, node: LABEL, family: fam, txid: h.txid, result, reason: why, source: SOURCE }; if (err) row.err = err;
  LOG.write(JSON.stringify(row) + "\n");
  if (++shapeTry <= 20 && (why === "mass" || why === "fee")) { if (++shapeRej >= 5 && !dropped) { dropped = true; phase(`NODE_DROP node=${LABEL} reason=redeem_shape`); } }
  if (SOURCE === "self" && (why === "orphan" || why === "already_spent")) { selfState.delete(fam); B.forget(); } // tip moved; re-catchUp next attempt
  // spent funding coin: drop it from the pool until the next refresh (change will appear)
  pool.coins = pool.coins.filter((c) => !(c.txid === coin.txid && c.index === coin.index));
}

const bucket = new Map(); let last = Date.now();
while (true) {
  const now = Date.now();
  if (now >= END || fs.existsSync(STOPF)) break;
  const s = stepAt(now); const dt = (now - last) / 1000; last = now;
  const on = s && s.step !== "gap" && alive && !skipped && !dropped;
  for (const f of CFG.families) {
    const fam = f.family;
    if (!on || fam > s.families) { bucket.set(fam, 0); continue; }
    let b = Math.min((bucket.get(fam) || 0) + s.rate * dt, Math.max(1, s.rate * 0.2));
    while (b >= 1) { b -= 1; attempt(fam).catch((e) => console.error("attempt", e.message)); }
    bucket.set(fam, b);
  }
  await sleep(20);
}
await sleep(3000); LOG.end(); try { await B.ask("quit", 3000); } catch {} await rpc.disconnect().catch(() => {}); process.exit(0);
