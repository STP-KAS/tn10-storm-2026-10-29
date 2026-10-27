// monitor.mjs --label <tag> --node <wrpc-url> : side log for the node-dead investigation (test branch, 27 Oct).
// Every 3 s: RPC latency, isSynced, DAA, reference-node DAA (CFG.ref_node_url), peers, mempool, CPU %, free RAM.
// Writes private/monitor-<label>.jsonl. Read-only RPC; never restarts or reconfigures a node. TESTNET-10 ONLY.
import fs from "node:fs";
import os from "node:os";
import { CFG, P, iso, sleep, to, connect, arg, END, STOPF } from "./lib.mjs";
const LABEL = arg("label"), URL = arg("node");
const out = fs.createWriteStream(P("private", `monitor-${LABEL}.jsonl`), { flags: "a" });
let rpc = await connect(URL); const ref = CFG.ref_node_url ? await connect(CFG.ref_node_url).catch(() => null) : null;
const cpuT = () => os.cpus().reduce((a, c) => { const t = c.times; a.idle += t.idle; a.all += t.user + t.nice + t.sys + t.irq + t.idle; return a; }, { idle: 0, all: 0 });
let prev = cpuT();
const until = Number(arg("until_ms", 0)) || END;
while (Date.now() < until + 120000 && !fs.existsSync(P("control", "MONITOR_STOP"))) {
  const row = { ts: iso(), node: LABEL };
  const t0 = Date.now();
  try {
    const [si, dag, info, peers] = await Promise.all([to(rpc.getServerInfo(), 5000), to(rpc.getBlockDagInfo(), 5000), to(rpc.getInfo(), 5000), to(rpc.getConnectedPeerInfo(), 5000).catch(() => null)]);
    row.rpc_ms = Date.now() - t0; row.synced = si.isSynced; row.daa = String(dag.virtualDaaScore); row.mempool = Number(info.mempoolSize);
    row.peers = peers ? (peers.peerInfo || []).length : null;
  } catch (e) { row.rpc_ms = Date.now() - t0; row.err = String(e.message || e).slice(0, 120); try { await rpc.disconnect(); rpc = await connect(URL); } catch {} }
  if (ref) { const t1 = Date.now(); try { row.ref_daa = String((await to(ref.getBlockDagInfo(), 5000)).virtualDaaScore); row.ref_ms = Date.now() - t1; } catch { row.ref_ms = -1; } }
  if (row.daa && row.ref_daa) row.lag = Number(BigInt(row.ref_daa) - BigInt(row.daa));
  const c = cpuT(); row.cpu = Math.round(100 * (1 - (c.idle - prev.idle) / Math.max(1, c.all - prev.all))); prev = c;
  row.free_mb = Math.round(os.freemem() / 1048576);
  out.write(JSON.stringify(row) + "\n");
  await sleep(3000);
}
out.end(); process.exit(0);
