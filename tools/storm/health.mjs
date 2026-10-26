// health.mjs: abort watch for dry runs. Every 10 s: desk node DAA vs a public TN10 node, free RAM, free disk on the
// node's drive, and rpc rejects in this run. Writes logs/health.csv; on a breach writes control/STOP + control/ABORT.
// Rules: lag > 10 DAA for 3 reads in a row, free RAM < 2048 MB, free disk < 50 GB, rej rpc > 20. TESTNET-10 ONLY.
import fs from "node:fs"; import os from "node:os";
import { CFG, P, iso, sleep, to, connect, STOPF, END } from "./lib.mjs";
const desk = await connect(CFG.main_node_url); let pub = null;
try { pub = await connect(CFG.reference_node_url); } catch {}
const H = P("logs", "health.csv"); if (!fs.existsSync(H)) fs.writeFileSync(H, "utc,desk_daa,ref_daa,lag_daa,mempool,ram_free_mb,disk_free_gb,rej_rpc\n");
let bad = 0;
const abort = (why) => { fs.writeFileSync(P("control", "ABORT"), iso() + " " + why + "\n"); fs.writeFileSync(STOPF, ""); console.log("ABORT " + why); };
while (Date.now() < END + 5000 && !fs.existsSync(P("control", "ABORT"))) {
  let d = null, r = null, mp = null;
  try { d = BigInt((await to(desk.getBlockDagInfo(), 5000)).virtualDaaScore); mp = Number((await to(desk.getInfo(), 5000)).mempoolSize); } catch {}
  try { if (pub) r = BigInt((await to(pub.getBlockDagInfo(), 5000)).virtualDaaScore); } catch {}
  const lag = d != null && r != null ? Number(r - d) : "";
  const ram = Math.round(os.freemem() / 2 ** 20);
  let disk = ""; try { const s = fs.statfsSync(CFG.node_drive || "C:\\"); disk = (Number(s.bavail) * Number(s.bsize) / 2 ** 30).toFixed(1); } catch {}
  let rpc = 0; for (const f of fs.readdirSync(P("private")).filter((x) => /^submit-.+\.jsonl$/.test(x))) rpc += (fs.readFileSync(P("private", f), "utf8").match(/"reason":"rpc"/g) || []).length;
  fs.appendFileSync(H, [iso(), d ?? "", r ?? "", lag, mp ?? "", ram, disk, rpc].join(",") + "\n");
  if (d == null) bad += 1; else if (lag !== "" && lag > 10) bad += 1; else bad = 0;
  if (bad >= 3) abort("desk_lag_or_rpc"); else if (ram < 2048) abort("ram_low"); else if (disk !== "" && Number(disk) < 50) abort("disk_low"); else if (rpc > 20) abort("rpc_errors");
  await sleep(10000);
}
process.exit(0);
