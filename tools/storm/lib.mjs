// lib.mjs: shared helpers for the TN10 storm sender + coordinator. TESTNET-10 ONLY.
// Hop shape here is the P2W stand-in from earlier storms (P2SH(push4(id) OP_DROP OP_TRUE), 1-in-1-out, no key),
// used for dry runs. The covenant hop (reference build, kcc20 public_mint) plugs into buildHop() for Thursday.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const CFG_PATH = process.env.STORM_CONFIG || path.join(process.cwd(), "config.json");
export const CFG = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
if (!globalThis.WebSocket) { globalThis.WebSocket = require(CFG.websocket_module).w3cwebsocket; }
export const kaspa = require(CFG.kaspa_sdk);           // kaspa-wasm32-sdk/nodejs/kaspa (SDK 2.1.0)
export const NET = "testnet-10";
export const RUN = CFG.run_dir;
export const P = (...a) => path.join(RUN, ...a);
for (const d of ["logs", "state", "control", "private"]) fs.mkdirSync(P(d), { recursive: true });
export const STOPF = P("control", "STOP");
export const iso = (ms = Date.now()) => new Date(ms).toISOString();
export const isoS = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 19) + "Z";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const to = (p, ms, l = "rpc") => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(l + " timeout")), ms))]);
export const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d; };
// phase.log: fixed tokens, actual UTC second. Never a txid, address, covenant id, hostname or IP.
export function phase(line, ms = Date.now()) { fs.appendFileSync(P("logs", "phase.log"), isoS(ms) + " " + line + "\n"); console.log(isoS(ms) + " " + line); }
export const T = (s) => Date.parse(s);
// schedule: [{step, from, to, families, rate}] ; step "gap" = no attempts
export function stepAt(ms) { for (const s of CFG.schedule) if (ms >= T(s.from) && ms < T(s.to)) return s; return null; }
export const END = T(CFG.end_utc);
const le32 = (id) => Buffer.from(Uint32Array.of(id >>> 0).buffer).toString("hex");
export function laneScript(id) {
  const redeem = "04" + le32(id) + "75" + "51"; const spk = kaspa.payToScriptHashScript(redeem);
  return { id, redeem, sigScript: "07" + redeem, spk, address: kaspa.addressFromScriptPublicKey(spk, NET).toString() };
}
export const massOf = (tx) => Number(kaspa.calculateTransactionMass(NET, tx));
// st = { txid, index, amount(BigInt) } of the published minter outpoint; L = laneScript; salt makes each attempt's txid unique
export function buildHop(L, st, feeRate, salt) {
  const ins = [{ address: L.address, outpoint: { transactionId: st.txid, index: st.index },
    utxoEntry: { amount: st.amount, scriptPublicKey: L.spk, blockDaaScore: 0n, isCoinbase: false } }];
  const mk = (amt) => { const t = kaspa.createTransaction(ins, [{ address: L.address, amount: amt }], 0n, null, 0); t.inputs[0].signatureScript = L.sigScript; return t; };
  let tx = mk(st.amount - 100000n); const m = massOf(tx);
  const fee = BigInt(m) * feeRate + BigInt(salt);
  const amt = st.amount - fee; if (amt < 30000000n) return null;
  tx = mk(amt); const m2 = massOf(tx); if (m2 > 100000) return null;
  return { tx, txid: tx.id, mass: m2, amount: amt };
}
// spec reason tokens: already_spent, orphan, fee, mass, mempool_full, route, rpc, other
export function reason(e) {
  const s = String(e?.message || e);
  if (/orphan|missing outpoint|outpoint .*not found|no such utxo/i.test(s)) return "orphan";
  if (/already spent|double.?spend|spent by|already in the mempool|already accepted|already exists|in the mempool/i.test(s)) return "already_spent";
  if (/mempool is full|mempool full|evict/i.test(s)) return "mempool_full";
  if (/fee|feerate/i.test(s)) return "fee";
  if (/mass/i.test(s)) return "mass";
  if (/route|network id|wrong network/i.test(s)) return "route";
  if (/timeout|timed out|closed|not connected|disconnect|websocket|connect/i.test(s)) return "rpc";
  return "other";
}
export async function connect(url) {
  const c = new kaspa.RpcClient({ url, encoding: kaspa.Encoding.Borsh, networkId: NET });
  await to(c.connect({ timeoutDuration: 8000, blockAsyncConnect: true }), 10000, "connect");
  const si = await to(c.getServerInfo(), 5000);
  if (si.networkId !== "testnet-10") { await c.disconnect(); throw new Error("route: network id " + si.networkId + " is not testnet-10"); }
  return c;
}
export const stateFile = (f) => P("state", `family-${f}.json`);
export function readState(f) { try { const j = JSON.parse(fs.readFileSync(stateFile(f), "utf8")); return { ...j, amount: BigInt(j.amount) }; } catch { return null; } }
// Windows: a reader holding the file makes rename fail with EPERM; retry, then fall back to an in-place write.
export function writeState(f, st) {
  const body = JSON.stringify({ ...st, amount: String(st.amount) }), t = stateFile(f) + ".tmp";
  fs.writeFileSync(t, body);
  for (let i = 0; i < 50; i++) { try { fs.renameSync(t, stateFile(f)); return; } catch { const u = Date.now() + 2; while (Date.now() < u); } }
  fs.writeFileSync(stateFile(f), body);
}
