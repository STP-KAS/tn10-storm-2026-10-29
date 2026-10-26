// coordinator.mjs: follows each family's minter outpoint on the main node's virtual chain, publishes it to the
// senders (state/family-N.json), stamps seen_utc and the accepting header time, and writes phase.log
// (MINER, GENESIS, FAMILY_DROP, START, STEP, GAP_START/GAP_END, STALL, STOP). TESTNET-10 ONLY.
import fs from "node:fs";
import { CFG, P, phase, iso, sleep, to, stepAt, END, T, STOPF, laneScript, connect, writeState, readState, arg } from "./lib.mjs";
const TAKEOVER = process.argv.includes("--takeover");   // failover: a second coordinator resumes from the chain

const HOPS = fs.createWriteStream(P("private", "hops.jsonl"), { flags: "a" });       // private: has txids
const GEN = P("private", "genesis.log");                                                // private: covenant ids / lane ids
const rpc = await connect(CFG.main_node_url);
const fams = CFG.families.map((f) => ({ ...f, L: laneScript(f.lane_id), cur: null, seenKeys: new Set(), lastHop: Date.now(), live: false }));
const key = (e) => e.outpoint.transactionId + ":" + e.outpoint.index;
async function utxos(f) { const r = await to(rpc.getUtxosByAddresses({ addresses: [f.L.address] }), 5000); return (r.entries || r).filter((e) => !e.isCoinbase); }

// --- genesis stand-in: the family's starting outpoint must be on the virtual chain by family_check_utc
if (TAKEOVER) {
  phase(`MAIN node=${arg("label", "desk")} reason=${arg("reason", "main_dead")}`);
  for (const f of fams) {
    const es = await utxos(f).catch(() => []); if (!es.length) continue;
    es.sort((a, b) => (BigInt(b.blockDaaScore) > BigInt(a.blockDaaScore) ? 1 : -1)); const e = es[0];   // newest = current minter
    f.cur = { txid: e.outpoint.transactionId, index: e.outpoint.index, amount: BigInt(e.amount), seq: 0 };
    for (const x of es) f.seenKeys.add(key(x)); writeState(f.family, f.cur); f.live = true;
  }
}
const famCheck = TAKEOVER ? 0 : T(CFG.family_check_utc);
while (Date.now() < famCheck - 1000 && !fs.existsSync(STOPF)) await sleep(250);
for (const f of (TAKEOVER ? [] : fams)) {
  const es = await utxos(f).catch(() => []);
  if (!es.length) { phase(`FAMILY_DROP family=${f.family} reason=no_genesis`); continue; }
  es.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1)); const e = es[0];
  f.cur = { txid: e.outpoint.transactionId, index: e.outpoint.index, amount: BigInt(e.amount), seq: 0 };
  for (const x of es) f.seenKeys.add(key(x));
  writeState(f.family, f.cur); f.live = true;
  fs.appendFileSync(GEN, `${iso()} family=${f.family} lane_id=${f.lane_id} start_outpoint=${f.cur.txid}:${f.cur.index}\n`);
  phase(`GENESIS family=${f.family} included`);
}
if (!fams.some((f) => f.live)) { phase("STOP reason=no_family"); process.exit(2); }

// --- accepting-block lookup via the virtual chain (txid -> accepting block hash), header time cached
let sink = (await rpc.getBlockDagInfo()).sink; const acc = new Map(); const hdrT = new Map();
async function pullChain() {
  const r = await to(rpc.getVirtualChainFromBlock({ startHash: sink, includeAcceptedTransactionIds: true }), 5000);
  for (const a of r.acceptedTransactionIds || []) for (const t of a.acceptedTransactionIds) acc.set(t, a.acceptingBlockHash);
  const add = r.addedChainBlockHashes || []; if (add.length) sink = add[add.length - 1];
  if (acc.size > 200000) { const n = acc.size - 100000; let i = 0; for (const k of acc.keys()) { if (i++ >= n) break; acc.delete(k); } }
}
async function headerTime(h) {
  if (hdrT.has(h)) return hdrT.get(h);
  const b = await to(rpc.getBlock({ hash: h, includeTransactions: false }), 5000); const t = Number(b.block.header.timestamp); hdrT.set(h, t); return t;
}

// --- main loop
const T0 = T(CFG.schedule[0].from); while (Date.now() < T0 && !fs.existsSync(STOPF)) await sleep(20);
if (!TAKEOVER) for (const m of CFG.miners || []) phase(`MINER state=${m.state} workers=${m.workers} miner=${m.label}`, T0);
if (!TAKEOVER) phase(`START senders=${CFG.senders.join(",")} families=${fams.filter((f) => f.live).length} rate=${CFG.schedule[0].rate}`);
let prevStep = TAKEOVER ? (stepAt(Date.now())?.step ?? null) : null, stopWhy = null, gapOpen = TAKEOVER && prevStep === "gap";
for (const f of fams) f.lastHop = Date.now();
const pend = [];   // winners waiting for their accepting block hash
while (!stopWhy) {
  const now = Date.now();
  if (now >= END) { stopWhy = "END"; break; }
  if (fs.existsSync(STOPF)) { stopWhy = "STOP"; break; }
  const s = stepAt(now); const sid = s ? s.step : null;
  if (sid !== prevStep) {
    const t = s ? T(s.from) : now;
    if (sid === "gap") { phase("GAP_START", t); gapOpen = true; }
    else { if (gapOpen) { phase("GAP_END", t); gapOpen = false; } if (s) phase(`STEP step=${s.step} families=${Math.min(s.families, fams.filter((f) => f.live).length)} rate=${s.rate}`, t); }
    prevStep = sid; for (const f of fams) f.lastHop = Date.now();
  }
  try { await pullChain(); } catch {}
  for (const f of fams) {
    if (!f.live) continue;
    let es; try { es = await utxos(f); } catch { continue; }
    const keys = new Set(es.map(key));
    if (f.cur && !keys.has(f.cur.txid + ":" + f.cur.index)) {
      const fresh = es.filter((e) => !f.seenKeys.has(key(e)));
      if (fresh.length) {
        const e = fresh[0]; const seen = Date.now();
        f.cur = { txid: e.outpoint.transactionId, index: e.outpoint.index, amount: BigInt(e.amount), seq: f.cur.seq + 1 };
        writeState(f.family, f.cur); f.lastHop = seen;
        pend.push({ family: f.family, txid: f.cur.txid, seen_utc: iso(seen), tries: 0 });
      }
    }
    for (const e of es) f.seenKeys.add(key(e));
    const st = stepAt(Date.now());
    const on = st && st.step !== "gap" && f.family <= st.families;
    if (!on) f.lastHop = Date.now();
    else if (Date.now() - f.lastHop > (CFG.stall_s || 30) * 1000) { phase(`STALL family=${f.family}`); stopWhy = "STALL"; }
  }
  for (let i = pend.length - 1; i >= 0; i--) {
    const w = pend[i]; const h = acc.get(w.txid); w.tries++;
    if (h || w.tries > 40) {
      let ah = ""; if (h) { try { ah = iso(await headerTime(h)); } catch {} }
      HOPS.write(JSON.stringify({ family: w.family, txid: w.txid, accept_header_utc: ah, seen_utc: w.seen_utc }) + "\n"); pend.splice(i, 1);
    }
  }
  await sleep(CFG.poll_ms || 200);
}
for (const w of pend) HOPS.write(JSON.stringify({ family: w.family, txid: w.txid, accept_header_utc: "", seen_utc: w.seen_utc }) + "\n");
if (gapOpen) phase("GAP_END");
phase(`STOP reason=${stopWhy}`, stopWhy === "END" ? END : Date.now());
if (stopWhy !== "END") fs.writeFileSync(STOPF, "");   // STALL or STOP stops every sender
HOPS.end(); await rpc.disconnect().catch(() => {}); process.exit(0);
