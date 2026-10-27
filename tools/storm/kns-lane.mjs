// kns-lane.mjs: background KNS lane for the storm (family=0). Does NOT start live until stp says GO.
// Spec (GO-MAP / PLAN): 60 names/min, max 16 in flight, off in both 5-minute gaps, not before 19:03 UTC,
// hard END 20:00 UTC, node `vector` (spare `muon`), fee = min(1.5× priority, 1 tKAS/name), pause not escalate.
// Coordinates with the existing kns tn10 tooling (kns-smoke-create / kns-bulk-create) via a pluggable runner.
// Usage (dry / armed only): node kns-lane.mjs --config <storm-config> --runner <path-to-create.mjs> [--armed]
// Without --armed the lane only prints the schedule and exits. TESTNET-10 ONLY.
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d; };
const CFG = JSON.parse(fs.readFileSync(arg("config", process.env.STORM_CONFIG || "config.json"), "utf8"));
const RUNNER = arg("runner");                       // e.g. <kns-tn10>/scripts/kns-smoke-create.mjs
const ARMED = process.argv.includes("--armed");
const RATE = 60;                                    // names per minute
const MAX_INFLIGHT = 16;
const FEE_MULT = 1.5;
const FEE_CAP_SOMPI = 100_000_000n;                 // 1 tKAS
const LABEL = "kns";
const RUN = CFG.run_dir;
const P = (...a) => path.join(RUN, ...a);
for (const d of ["logs", "control", "private"]) fs.mkdirSync(P(d), { recursive: true });
const STOPF = P("control", "STOP");
const T = (s) => Date.parse(s);
const END = T(CFG.end_utc);
const startAt = T(CFG.kns_from_utc || "2026-10-29T19:03:00.000Z");
const gaps = (CFG.schedule || []).filter((s) => s.step === "gap").map((s) => [T(s.from), T(s.to)]);
const inGap = (ms) => gaps.some(([a, b]) => ms >= a && ms < b);
const iso = (ms = Date.now()) => new Date(ms).toISOString();
const phase = (line) => { fs.appendFileSync(P("logs", "phase.log"), iso().slice(0, 19) + "Z " + line + "\n"); console.log(line); };
const minutePath = P("logs", "minute-kns.csv");
if (!fs.existsSync(minutePath)) fs.writeFileSync(minutePath, "minute_utc,sent,ok,rej,inflight,paused\n");

console.log(JSON.stringify({
  family: 0, sender: LABEL, rate_per_min: RATE, max_inflight: MAX_INFLIGHT,
  fee: "1.5x priority capped 1 tKAS/name; pause not escalate",
  node: CFG.kns_node || "vector", spare: CFG.kns_spare || "muon",
  from: new Date(startAt).toISOString(), end: new Date(END).toISOString(),
  gaps: gaps.map(([a, b]) => [new Date(a).toISOString(), new Date(b).toISOString()]),
  runner: RUNNER || null, armed: ARMED,
}));
if (!ARMED) { console.log("not armed; exiting. Pass --armed and --runner to run (only after stp GO)."); process.exit(0); }
if (!RUNNER) { console.error("need --runner"); process.exit(2); }

let inflight = 0, sent = 0, ok = 0, rej = 0, paused = false, seq = 0;
let minuteKey = "", minute = null;
function flushMinute() {
  if (!minute) return;
  fs.appendFileSync(minutePath, [minute.key, minute.sent, minute.ok, minute.rej, minute.inflight, minute.paused ? 1 : 0].join(",") + "\n");
}
function bump(field) {
  const k = new Date().toISOString().slice(0, 16);
  if (k !== minuteKey) { flushMinute(); minuteKey = k; minute = { key: k, sent: 0, ok: 0, rej: 0, inflight: 0, paused: false }; }
  minute[field]++; minute.inflight = inflight; if (paused) minute.paused = true;
}

function runOne(label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, "--label", label, "--broadcast", "1", "--fee-mult", String(FEE_MULT), "--fee-cap-sompi", String(FEE_CAP_SOMPI)], {
      env: { ...process.env, KNS_FEE_MULT: String(FEE_MULT), KNS_FEE_CAP_SOMPI: String(FEE_CAP_SOMPI), KNS_PAUSE_ON_FEE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    child.stdout.on("data", (d) => { buf += d; });
    child.stderr.on("data", (d) => { buf += d; });
    child.on("close", (code) => {
      const feePause = /fee.*(cap|pause|escalat)/i.test(buf);
      resolve({ code, feePause, buf: buf.slice(-500) });
    });
  });
}

phase(`KNS_ARM sender=${LABEL} rate=${RATE}/min max_inflight=${MAX_INFLIGHT}`);
const interval = 60000 / RATE;
let next = Math.max(Date.now(), startAt);
while (Date.now() < END && !fs.existsSync(STOPF)) {
  const now = Date.now();
  if (now < startAt || inGap(now)) { paused = true; await new Promise((r) => setTimeout(r, 500)); continue; }
  if (inflight >= MAX_INFLIGHT) { paused = true; await new Promise((r) => setTimeout(r, 200)); continue; }
  if (now < next) { await new Promise((r) => setTimeout(r, Math.min(100, next - now))); continue; }
  paused = false; next += interval;
  const label = `storm-${String(++seq).padStart(4, "0")}`;
  inflight++; sent++; bump("sent");
  runOne(label).then((r) => {
    inflight--;
    if (r.feePause) { paused = true; phase(`KNS_PAUSE reason=fee_cap`); }
    if (r.code === 0) { ok++; bump("ok"); }
    else { rej++; bump("rej"); }
  });
}
flushMinute();
phase(`KNS_STOP sent=${sent} ok=${ok} rej=${rej}`);
process.exit(0);
