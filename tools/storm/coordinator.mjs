// coordinator.mjs: creates genesis (real covenant via `kcc20 storm`), follows each family's minter on the main
// node's virtual chain, publishes the outpoint to state/family-N.json, stamps seen_utc and the accepting header
// time. Phase tokens: MINER, GENESIS, FAMILY_DROP, START, STEP, GAP_*, MAIN, STALL, STOP. TESTNET-10 ONLY.
import fs from "node:fs";
import { CFG, P, phase, iso, sleep, to, stepAt, END, T, STOPF, connect, writeState, readState, arg } from "./lib.mjs";
import { startBuilder, materialize, spkAddress, keyAddress, nextSpk, catchUp, ofCov } from "./covenant.mjs";

const TAKEOVER = process.argv.includes("--takeover");
const HOPS = fs.createWriteStream(P("private", "hops.jsonl"), { flags: "a" });
const GEN = P("private", "genesis.log");
// Auto failover (fixed 27 Oct, test branch): the coordinator watches its own node against a reference and, if the
// node stops advancing (DAA still 20 s while the reference moves), fails 3 probes, or a family would STALL, it
// reconnects to the next node in CFG.coord_fallback (list of {label,url}), re-finds every tip, and keeps going.
// STALL-stop only happens when no fallback is left. Phase: MAIN node=<label> reason=<why> auto=1.
const NODES = [{ label: arg("label", CFG.main_label || "main"), url: CFG.main_node_url }, ...(CFG.coord_fallback || [])];
let ni = 0;
let rpc = await connect(NODES[0].url);
const B = startBuilder(P("private", "builder.err"));
await B.ask("ping", 120000);

const fams = CFG.families.map((f) => ({ ...f, cur: null, lastHop: Date.now(), live: false, nextAddr: null }));
const norm = (s) => String(s).replace(/^0x/, "").toLowerCase();

async function publish(f, st, seen) {
  const nspk = await nextSpk(B, st); st.nextSpk = nspk;
  f.cur = st; writeState(f.family, st); f.nextAddr = spkAddress(nspk); f.lastHop = seen || Date.now();
}

// --- genesis (or takeover resume)
if (TAKEOVER) {
  phase(`MAIN node=${arg("label", "desk")} reason=${arg("reason", "main_dead")}`);
  for (const f of fams) {
    const st = readState(f.family); if (!st || !st.covenantId) { phase(`FAMILY_DROP family=${f.family} reason=no_state`); continue; }
    const fromSeq = st.seq || 0;
    const caught = await catchUp(rpc, B, st);
    phase(`TIP family=${f.family} from_seq=${fromSeq} to_seq=${caught.seq || 0}`);
    await publish(f, caught); f.live = true;
  }
} else {
  const famCheck = T(CFG.family_check_utc);
  while (Date.now() < famCheck - 5000 && !fs.existsSync(STOPF)) await sleep(250);
  const owners = new Map();   // families sharing a genesis key share the minter script; followers match on covenant id
  for (const f of fams) {
    try {
      const key = Number(f.key ?? 0);
      const addr = keyAddress(key);
      if (owners.has(addr)) console.error(`warn: family ${f.family} shares its genesis key with family ${owners.get(addr)} (same minter script; followers match on covenant id)`);
      owners.set(addr, f.family);
      const bag = await to(rpc.getUtxosByAddresses({ addresses: [addr] }), 8000);
      const entries = (bag.entries || []).filter((e) => !e.isCoinbase);
      entries.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
      const fund = entries.find((e) => BigInt(e.amount) >= 1_500_000_000n);   // ≥ ~15 tKAS (fits ~16 tKAS pre-split coins)
      if (!fund) { phase(`FAMILY_DROP family=${f.family} reason=no_funding`); continue; }
      const path = f.launch_path || `launch::storm-2026-10-29-f${f.family}`;
      const g = await B.ask(`genesis ${key} ${fund.outpoint.transactionId} ${fund.outpoint.index} ${fund.amount} ${path}`, 120000);
      const gtx = materialize(g.tx);
      if (norm(gtx.id) !== norm(g.txid)) throw new Error("genesis id mismatch");
      await to(rpc.submitTransaction({ transaction: gtx, allowOrphan: false }), 15000, "submit");
      // wait for the minter (output 0) to appear at its P2SH address
      const minterAddr = spkAddress(g.minterSpk);
      const end = Date.now() + 60000; let landed = null;
      while (Date.now() < end) {
        const u = await rpc.getUtxosByAddresses({ addresses: [minterAddr] });
        const hit = (u.entries || []).find((e) => norm(e.outpoint.transactionId) === norm(g.txid) && e.outpoint.index === 0);
        if (hit) { landed = hit; break; }
        await sleep(250);
      }
      if (!landed) { phase(`FAMILY_DROP family=${f.family} reason=no_genesis`); continue; }
      const st = { covenantId: g.covenantId, owner: g.owner, txid: norm(g.txid), index: 0, remaining: g.remaining, spk: g.minterSpk, seq: 0, amount: String(landed.amount) };
      await publish(f, st); f.live = true;
      fs.appendFileSync(GEN, `${iso()} family=${f.family} path=${path} start_outpoint=${st.txid}:0 covenant=${st.covenantId}\n`);
      phase(`GENESIS family=${f.family} included`);
    } catch (e) { phase(`FAMILY_DROP family=${f.family} reason=build`); console.error("genesis", f.family, e.message); }
  }
}
if (!fams.some((f) => f.live)) { phase("STOP reason=no_family"); process.exit(2); }

let sink = (await rpc.getBlockDagInfo()).sink; const acc = new Map(); const hdrT = new Map();
async function pullChain() {
  const r = await to(rpc.getVirtualChainFromBlock({ startHash: sink, includeAcceptedTransactionIds: true }), 5000);
  for (const a of r.acceptedTransactionIds || []) for (const t of a.acceptedTransactionIds) acc.set(t, a.acceptingBlockHash);
  const add = r.addedChainBlockHashes || []; if (add.length) sink = add[add.length - 1];
}
async function headerTime(h) {
  if (hdrT.has(h)) return hdrT.get(h);
  const b = await to(rpc.getBlock({ hash: h, includeTransactions: false }), 5000); const t = Number(b.block.header.timestamp); hdrT.set(h, t); return t;
}

const T0 = T(CFG.schedule[0].from); while (Date.now() < T0 && !fs.existsSync(STOPF)) await sleep(20);
if (!TAKEOVER) for (const m of CFG.miners || []) phase(`MINER state=${m.state} workers=${m.workers} miner=${m.label}`, T0);
if (!TAKEOVER) phase(`START senders=${CFG.senders.join(",")} families=${fams.filter((f) => f.live).length} rate=${CFG.schedule[0].rate}`);
let mDaa = 0n, mAt = Date.now(), rDaa = 0n, rAt = Date.now(), mBad = 0, lastHealth = 0, REFC = null;
const refNode = NODES.find((n, i) => i > 0) || null;
if (refNode) REFC = await connect(refNode.url).catch(() => null);
async function failover(why) {
  for (let k = ni + 1; k < NODES.length; k++) {
    try {
      const c = await connect(NODES[k].url); const old = rpc; rpc = c; ni = k; old.disconnect().catch(() => {});
      phase(`MAIN node=${NODES[k].label} reason=${why} auto=1`);
      for (const f of fams) if (f.live && f.cur) {
        const caught = await catchUp(rpc, B, { ...f.cur, nextSpk: undefined }).catch(() => null);
        if (caught) { phase(`TIP family=${f.family} from_seq=${f.cur.seq || 0} to_seq=${caught.seq || 0}`); await publish(f, caught); }
        f.lastHop = Date.now();
      }
      sink = (await rpc.getBlockDagInfo()).sink; mDaa = 0n; mAt = Date.now(); mBad = 0;
      return true;
    } catch (e) { console.error("failover", NODES[k].label, e.message); }
  }
  return false;
}
async function mainHealth() {
  if (Date.now() - lastHealth < 5000) return null; lastHealth = Date.now();
  if (REFC) { try { const d = BigInt((await to(REFC.getBlockDagInfo(), 5000)).virtualDaaScore); if (d !== rDaa) { rDaa = d; rAt = Date.now(); } } catch {} }
  try { const d = BigInt((await to(rpc.getBlockDagInfo(), 5000)).virtualDaaScore); mBad = 0; if (d !== mDaa) { mDaa = d; mAt = Date.now(); } }
  catch { if (++mBad >= 3) return "main_rpc"; return null; }
  if (Date.now() - mAt > 20000 && (!REFC || Date.now() - rAt < 20000)) return "main_daa_still";
  return null;
}
let prevStep = TAKEOVER ? (stepAt(Date.now())?.step ?? null) : null, stopWhy = null, gapOpen = TAKEOVER && prevStep === "gap";
for (const f of fams) f.lastHop = Date.now();
const pend = [];
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
  const hw = await mainHealth().catch(() => null);
  if (hw) { if (!(await failover(hw))) console.error("no fallback left for", hw); }
  try { await pullChain(); } catch {}
  for (const f of fams) {
    if (!f.live || !f.nextAddr) continue;
    try {
      const u = await to(rpc.getUtxosByAddresses({ addresses: [f.nextAddr] }), 5000);
      const es = ofCov(u.entries, f.cur.covenantId);
      if (es.length) {
        const e = es[0]; const seen = Date.now();
        if (!f.cur.nextSpk) continue;
        const st = { covenantId: f.cur.covenantId, owner: f.cur.owner, txid: norm(e.outpoint.transactionId), index: e.outpoint.index, remaining: f.cur.remaining - 1, spk: f.cur.nextSpk, seq: f.cur.seq + 1, amount: String(e.amount) };
        await publish(f, st, seen);
        pend.push({ family: f.family, txid: st.txid, seen_utc: iso(seen), tries: 0 });
      } else if (Date.now() - f.lastHop > 5000 && Date.now() - (f.lastResync || 0) > 5000) {
        // The exact next minter can be spent before we poll it (two hops between polls): the tip moved past nextAddr.
        // Re-find the tip from the last known state instead of declaring a false STALL.
        f.lastResync = Date.now();
        const tip = await catchUp(rpc, B, { ...f.cur, nextSpk: undefined }, 5000).catch(() => null);
        if (tip && (tip.seq || 0) > (f.cur.seq || 0)) {
          const seen = Date.now(); console.error(`resync family=${f.family} seq ${f.cur.seq} -> ${tip.seq}`);
          await publish(f, tip, seen);
        }
      }
    } catch {}
    const st = stepAt(Date.now());
    const on = st && st.step !== "gap" && f.family <= st.families;
    if (!on) f.lastHop = Date.now();
    else if (Date.now() - f.lastHop > (CFG.stall_s || 30) * 1000) {
      if (ni + 1 < NODES.length && await failover(`stall_f${f.family}`)) continue;
      phase(`STALL family=${f.family}`); stopWhy = "STALL";
    }
  }
  for (let i = pend.length - 1; i >= 0; i--) {
    const w = pend[i]; const h = acc.get(w.txid); w.tries++;
    if (h || w.tries > 40) {
      let ah = ""; if (h) { try { ah = iso(await headerTime(h)); } catch {} }
      HOPS.write(JSON.stringify({ family: w.family, txid: w.txid, accept_header_utc: ah, seen_utc: w.seen_utc, source: "coord" }) + "\n"); pend.splice(i, 1);
    }
  }
  await sleep(CFG.poll_ms || 200);
}
for (const w of pend) HOPS.write(JSON.stringify({ family: w.family, txid: w.txid, accept_header_utc: "", seen_utc: w.seen_utc, source: "coord" }) + "\n");
if (gapOpen) phase("GAP_END");
phase(`STOP reason=${stopWhy}`, stopWhy === "END" ? END : Date.now());
if (stopWhy !== "END") fs.writeFileSync(STOPF, "");
HOPS.end(); try { await B.ask("quit", 3000); } catch {} await rpc.disconnect().catch(() => {}); process.exit(0);
