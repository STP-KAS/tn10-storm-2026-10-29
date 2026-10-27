// covenant.mjs: the real hop (kcc20 public_mint, reference build `kcc20 storm`). TESTNET-10 ONLY.
// The Rust builder holds the contract logic and signs with keys from CFG.keys_file (one hex key per line, private,
// never logged). This module talks to it over stdin/stdout, turns its JSON into wasm Transactions, follows the minter
// on a node (utxoindex: the next minter's P2SH address is known before the hop lands) and keeps a funding-coin pool.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { createRequire } from "node:module";
import { CFG, kaspa, NET, to, sleep } from "./lib.mjs";
const require = createRequire(import.meta.url);

export function startBuilder(errFile) {
  // Prefer the shared broker (one rust process). Falls back to a direct spawn only when STORM_BUILDER_DIRECT=1.
  if (process.env.STORM_BUILDER_DIRECT === "1") return startBuilderDirect(errFile);
  const port = Number(process.env.STORM_BUILDER_PORT || CFG.builder_port || 17310);
  let sock = null, buf = "", waiters = [], chain = Promise.resolve();
  function ensure() {
    if (sock && !sock.destroyed) return Promise.resolve();
    return new Promise((res, rej) => {
      sock = net.connect({ host: "127.0.0.1", port }, () => res());
      sock.on("error", rej);
      sock.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) (waiters.shift() || (() => {}))(l); } });
      sock.on("close", () => { sock = null; while (waiters.length) waiters.shift()(JSON.stringify({ ok: false, error: "broker closed" })); });
    });
  }
  const ask = (cmd, ms = 30000) => (chain = chain.then(async () => {
    await ensure();
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("builder timeout")), ms);
      waiters.push((l) => { clearTimeout(t); try { const j = JSON.parse(l); j.ok ? res(j) : rej(new Error("builder: " + j.error)); } catch (e) { rej(e); } });
      sock.write(cmd + "\n");
    });
  }).catch((e) => { throw e; }));
  const safe = (cmd, ms) => { const p = ask(cmd, ms); chain = p.catch(() => {}); return p; };
  let followed = "";
  return {
    ask: safe,
    async follow(st) { const k = st.txid + ":" + st.index + ":" + st.remaining + ":" + st.spk; if (k === followed) return; await safe(`follow ${st.covenantId} ${st.owner} ${st.txid} ${st.index} ${st.remaining} ${st.spk}`); followed = k; },
    forget() { followed = ""; },
  };
}
function startBuilderDirect(errFile) {
  const child = spawn(CFG.builder_exe, ["storm"], { env: { ...process.env, STORM_KEYS: CFG.keys_file, STORM_FEE_RATE: String(CFG.fee_sompi_per_gram || 200) }, stdio: ["pipe", "pipe", "pipe"] });
  process.on("exit", () => { try { child.kill(); } catch {} });
  if (errFile) child.stderr.on("data", (d) => fs.appendFileSync(errFile, d));
  let buf = ""; const waiters = [];
  child.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) (waiters.shift() || (() => {}))(l); } });
  child.on("exit", (c) => { while (waiters.length) waiters.shift()(JSON.stringify({ ok: false, error: "builder exit " + c })); });
  let chain = Promise.resolve();
  const ask = (cmd, ms = 30000) => (chain = chain.then(() => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("builder timeout")), ms);
    waiters.push((l) => { clearTimeout(t); try { const j = JSON.parse(l); j.ok ? res(j) : rej(new Error("builder: " + j.error)); } catch (e) { rej(e); } });
    child.stdin.write(cmd + "\n");
  })).catch((e) => { throw e; }));
  const safe = (cmd, ms) => { const p = ask(cmd, ms); chain = p.catch(() => {}); return p; };
  let followed = "";
  return { ask: safe, async follow(st) { const k = st.txid + ":" + st.index + ":" + st.remaining + ":" + st.spk; if (k === followed) return; await safe(`follow ${st.covenantId} ${st.owner} ${st.txid} ${st.index} ${st.remaining} ${st.spk}`); followed = k; }, forget() { followed = ""; } };
}

export function materialize(tx) {
  const outputs = tx.outputs.map((o) => new kaspa.TransactionOutput(BigInt(o.value), new kaspa.ScriptPublicKey(o.scriptPublicKey.version, o.scriptPublicKey.script),
    o.covenant ? new kaspa.CovenantBinding(o.covenant.authorizingInput, new kaspa.Hash(o.covenant.covenantId)) : null));
  const inputs = tx.inputs.map((i) => ({ previousOutpoint: { transactionId: i.previousOutpoint.transactionId, index: i.previousOutpoint.index }, signatureScript: i.signatureScript, sequence: BigInt(i.sequence), sigOpCount: 0, computeBudget: i.computeBudget }));
  return new kaspa.Transaction({ version: tx.version, inputs, outputs, lockTime: BigInt(tx.lockTime), subnetworkId: tx.subnetworkId, gas: BigInt(tx.gas), payload: tx.payload, storageMass: BigInt(tx.storageMass) });
}
const norm = (s) => String(s).replace(/^0x/, "").toLowerCase();
export const spkAddress = (hex) => kaspa.addressFromScriptPublicKey(new kaspa.ScriptPublicKey(0, hex), NET).toString();
export function keyAddress(i) {
  const hex = fs.readFileSync(CFG.keys_file, "utf8").trim().split(/\r?\n/)[i].trim();
  return new kaspa.PrivateKey(hex).toKeypair().toAddress(NET).toString();
}

// Build one hop. Returns { tx, txid } or throws. Checks the wasm id equals the builder id.
export async function buildHop(B, st, coin, key, nonce) {
  await B.follow(st);
  const r = await B.ask(`hop ${key} ${coin.txid} ${coin.index} ${coin.amount} ${nonce}`);
  const tx = materialize(r.tx); if (norm(tx.id) !== norm(r.txid)) throw new Error("hop id mismatch");
  return { tx, txid: norm(r.txid), nextSpk: r.nextSpk, compute: r.compute, fee: r.fee };
}

// Follower: given the current state, the next minter lands at a known address. Returns the next state or null.
export async function nextSpk(B, st) { await B.follow(st); return (await B.ask("nextspk")).spk; }
export async function step(rpc, B, st) {
  if (!st.nextSpk) st.nextSpk = await nextSpk(B, st);
  const r = await to(rpc.getUtxosByAddresses({ addresses: [spkAddress(st.nextSpk)] }), 5000);
  const es = r.entries || [];
  if (!es.length) return null;
  const e = es[0];
  return { covenantId: st.covenantId, owner: st.owner, txid: norm(e.outpoint.transactionId), index: e.outpoint.index, remaining: st.remaining - 1, spk: st.nextSpk, seq: (st.seq || 0) + 1, amount: String(e.amount) };
}
function spkHex(e) {
  const spk = e.scriptPublicKey || e.utxoEntry?.scriptPublicKey;
  if (!spk) return "";
  const s = spk.script ?? spk;
  return typeof s === "string" ? s.replace(/^0x/, "").toLowerCase() : Buffer.from(s).toString("hex");
}
async function liveAt(rpc, st) {
  const r = await to(rpc.getUtxosByAddresses({ addresses: [spkAddress(st.spk)] }), 5000);
  const hit = (r.entries || []).find((e) => norm(e.outpoint.transactionId) === norm(st.txid) && e.outpoint.index === st.index);
  if (hit) return { ...st, amount: String(hit.amount), index: hit.outpoint.index };
  // any UTXO at this spk (txid may be unknown after a virtual walk)
  const any = (r.entries || [])[0];
  if (!any) return null;
  return { covenantId: st.covenantId, owner: st.owner, txid: norm(any.outpoint.transactionId), index: any.outpoint.index, remaining: st.remaining, spk: st.spk, seq: st.seq || 0, amount: String(any.amount) };
}
async function liveAmong(rpc, cands) {
  if (!cands.length) return null;
  const addrs = cands.map((c) => spkAddress(c.spk));
  const r = await to(rpc.getUtxosByAddresses({ addresses: addrs }), 8000);
  const entries = r.entries || [];
  if (!entries.length) return null;
  // Prefer the candidate with the lowest remaining (newest tip). Match by spk hex.
  const bySpk = new Map(cands.map((c) => [String(c.spk).replace(/^0x/, "").toLowerCase(), c]));
  let best = null;
  for (const e of entries) {
    const hx = spkHex(e);
    const c = bySpk.get(hx);
    if (!c) continue;
    const st = { covenantId: c.covenantId, owner: c.owner, txid: norm(e.outpoint.transactionId), index: e.outpoint.index, remaining: c.remaining, spk: c.spk, seq: c.seq || 0, amount: String(e.amount) };
    if (!best || st.remaining < best.remaining) best = st;
  }
  return best;
}
// Virtual walk: intermediates are spent so step() cannot chain; probe successive nextSpk addresses in batches.
async function tipFind(rpc, B, st, max) {
  B.forget();
  const BATCH = 32;
  let cur = { ...st, amount: String(st.amount) };
  let pending = [{ ...cur }];
  let found = null;
  for (let i = 0; i < max; i++) {
    const nspk = await nextSpk(B, cur);
    cur = { covenantId: cur.covenantId, owner: cur.owner, txid: "0".repeat(64), index: 0, remaining: cur.remaining - 1, spk: nspk, seq: (cur.seq || 0) + 1, amount: String(cur.amount) };
    pending.push({ ...cur });
    if (pending.length >= BATCH) {
      const hit = await liveAmong(rpc, pending);
      if (hit) found = hit; // keep scanning a little so we land on the newest
      // Once we have a hit, only keep looking within the next batch or two for a newer tip
      pending = found ? [] : [];
      if (found) {
        // continue one more batch from found to confirm tip
        const more = [];
        let probe = { ...found };
        for (let j = 0; j < BATCH; j++) {
          const nspk2 = await nextSpk(B, probe);
          probe = { covenantId: probe.covenantId, owner: probe.owner, txid: "0".repeat(64), index: 0, remaining: probe.remaining - 1, spk: nspk2, seq: (probe.seq || 0) + 1, amount: String(probe.amount) };
          more.push({ ...probe });
        }
        const newer = await liveAmong(rpc, more);
        return newer || found;
      }
    }
  }
  if (pending.length) {
    const hit = await liveAmong(rpc, pending);
    if (hit) return hit;
  }
  if (found) return found;
  throw new Error("tip-find: no live minter from stale state");
}
// Walk forward from a (possibly old) state to the newest minter. Used by a takeover coordinator and by self senders.
// When intermediate UTXOs are already spent, falls back to tip-find (virtual nextSpk walk + batched address probes).
export async function catchUp(rpc, B, st, max = 100000) {
  let n = 0;
  for (;;) {
    const x = await step(rpc, B, st);
    if (x) { st = x; if (++n > max) return st; continue; }
    break;
  }
  const live = await liveAt(rpc, st);
  if (live) return live;
  return tipFind(rpc, B, st, Math.max(1, max - n));
}

// Funding-coin pool for one key. Coins are split by family so two families never spend the same coin.
export class Pool {
  constructor(rpc, address) { this.rpc = rpc; this.address = address; this.coins = []; this.at = 0; this.rr = new Map(); }
  async refresh() {
    const r = await to(this.rpc.getUtxosByAddresses({ addresses: [this.address] }), 8000);
    this.coins = (r.entries || []).filter((e) => !e.isCoinbase && BigInt(e.amount) > 300_000_000n)
      .map((e) => ({ txid: norm(e.outpoint.transactionId), index: e.outpoint.index, amount: String(e.amount) }))
      .sort((a, b) => (a.txid + a.index < b.txid + b.index ? -1 : 1));
    this.at = Date.now();
  }
  pick(family, nFam) {
    const mine = this.coins.filter((_, i) => i % nFam === (family - 1) % nFam); if (!mine.length) return null;
    const k = (this.rr.get(family) || 0) % mine.length; this.rr.set(family, k + 1); return mine[k];
  }
}
export async function waitAddress(rpc, address, ms) { const end = Date.now() + ms; while (Date.now() < end) { const r = await rpc.getUtxosByAddresses({ addresses: [address] }); if ((r.entries || []).length) return r.entries; await sleep(250); } return null; }
