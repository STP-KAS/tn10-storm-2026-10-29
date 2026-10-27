// builder-broker.mjs: one `kcc20 storm` process, many local clients. The argent artifact on Windows is opened
// exclusively, so coordinator + sender cannot each spawn their own builder. Clients speak the same line protocol
// over TCP 127.0.0.1 (STORM_BUILDER_PORT, default 17310). TESTNET-10 ONLY. Never logs keys.
import net from "node:net";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { CFG, P } from "./lib.mjs";

const PORT = Number(process.env.STORM_BUILDER_PORT || CFG.builder_port || 17310);
const errFile = P("private", "builder.err");
const child = spawn(CFG.builder_exe, ["storm"], {
  env: { ...process.env, STORM_KEYS: CFG.keys_file, STORM_FEE_RATE: String(CFG.fee_sompi_per_gram || 200) },
  stdio: ["pipe", "pipe", "pipe"],
});
process.on("exit", () => { try { child.kill(); } catch {} });
child.stderr.on("data", (d) => fs.appendFileSync(errFile, d));
let buf = ""; const waiters = [];
child.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) { const w = waiters.shift(); if (w) w(l); } } });
child.on("exit", (c) => { console.error("builder exit", c); while (waiters.length) waiters.shift()(JSON.stringify({ ok: false, error: "builder exit " + c })); process.exit(1); });

let gate = Promise.resolve();
function ask(cmd, ms = 120000) {
  const run = () => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("builder timeout")), ms);
    waiters.push((l) => { clearTimeout(t); res(l); });
    child.stdin.write(cmd + "\n");
  });
  const p = gate.then(run, run);
  gate = p.catch(() => {});
  return p;
}

const server = net.createServer((sock) => {
  let b = "";
  sock.on("data", (d) => {
    b += d;
    let i;
    while ((i = b.indexOf("\n")) >= 0) {
      const line = b.slice(0, i).trim(); b = b.slice(i + 1);
      if (!line) continue;
      ask(line).then((r) => sock.write(r + "\n")).catch((e) => sock.write(JSON.stringify({ ok: false, error: String(e.message || e) }) + "\n"));
    }
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`builder-broker on 127.0.0.1:${PORT}`));
