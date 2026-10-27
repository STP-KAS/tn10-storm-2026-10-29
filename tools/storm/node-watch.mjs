// node-watch.mjs: READ-ONLY poll of the local kaspad over wRPC (borsh). One JSON line per poll on stdout.
// No sends, no config changes, never starts/stops kaspad. TESTNET-10 ONLY (refuses another network id).
// Usage: node node-watch.mjs --sdk <kit>\sdk\kaspa\kaspa.js --ws <kit-websocket-module> [--url ws://127.0.0.1:17210] [--every 5]
//        [--probe <public-host>:443]
import net from "node:net";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d; };
if (!globalThis.WebSocket && arg("ws")) globalThis.WebSocket = require(arg("ws")).w3cwebsocket;
const k = require(arg("sdk"));
const URL = arg("url", "ws://127.0.0.1:17210"), EVERY = Number(arg("every", "5")) * 1000, PROBE = arg("probe", "");
const to = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function tcp(hp) {
  if (!hp) return Promise.resolve(null);
  const [h, p] = hp.split(":"); const t = Date.now();
  return new Promise((res) => { const s = net.connect({ host: h, port: Number(p || 443) }); const done = (v) => { s.destroy(); res(v); };
    s.setTimeout(3000, () => done(-1)); s.on("connect", () => done(Date.now() - t)); s.on("error", () => done(-1)); });
}
let rpc = null;
async function conn() { rpc = new k.RpcClient({ url: URL, encoding: k.Encoding.Borsh, networkId: "testnet-10" }); await to(rpc.connect({ timeoutDuration: 4000, blockAsyncConnect: true }), 5000);
  const si = await to(rpc.getServerInfo(), 4000); if (si.networkId !== "testnet-10") { console.error("not testnet-10"); process.exit(2); } }
for (;;) {
  const t0 = Date.now(); const row = { ts: new Date(t0).toISOString() };
  try {
    if (!rpc) await conn();
    const [si, dag, info, peers] = await Promise.all([to(rpc.getServerInfo(), 4000), to(rpc.getBlockDagInfo(), 4000), to(rpc.getInfo(), 4000), to(rpc.getConnectedPeerInfo(), 4000).catch(() => null)]);
    Object.assign(row, { rpc_ms: Date.now() - t0, synced: si.isSynced ? 1 : 0, peers: peers ? (peers.peerInfo || []).length : "", mempool: Number(info.mempoolSize), daa: String(dag.virtualDaaScore), err: "" });
  } catch (e) { Object.assign(row, { rpc_ms: Date.now() - t0, synced: "", peers: "", mempool: "", daa: "", err: String(e.message || e).replace(/[,\s]+/g, " ").slice(0, 60) }); try { await rpc?.disconnect(); } catch {} rpc = null; }
  row.probe_ms = await tcp(PROBE);
  process.stdout.write(JSON.stringify(row) + "\n");
  await sleep(Math.max(200, EVERY - (Date.now() - t0)));
}
