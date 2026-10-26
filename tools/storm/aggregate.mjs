// aggregate.mjs: after END. Merges private/submit-*.jsonl with private/hops.jsonl into private/submit.jsonl,
// then writes the counts-only logs/minute.csv (one row per minute and family) and logs/sec.csv (one row per second).
// Prints the self-checks (sec.csv continuity, sent = ok + sum(rej_*), ts / seen_utc deltas).
import fs from "node:fs";
import { CFG, P, T, stepAt } from "./lib.mjs";
const REJ = ["already_spent", "orphan", "fee", "mass", "mempool_full", "route", "rpc", "other"];
const rd = (f) => fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const att = fs.readdirSync(P("private")).filter((f) => /^submit-.+\.jsonl$/.test(f)).flatMap((f) => rd(P("private", f)));
const hops = new Map(rd(P("private", "hops.jsonl")).map((h) => [h.txid, h]));
att.sort((a, b) => (a.ts < b.ts ? -1 : 1));
const out = att.map((a) => { const h = hops.get(a.txid); return { ...a, accept_header_utc: h ? h.accept_header_utc : "", seen_utc: h ? h.seen_utc : "" }; });
fs.writeFileSync(P("private", "submit.jsonl"), out.map((o) => JSON.stringify(o)).join("\n") + "\n");
// phase.log: lower senders_target after NODE_SKIP / NODE_DROP
const ph = fs.existsSync(P("logs", "phase.log")) ? fs.readFileSync(P("logs", "phase.log"), "utf8").split("\n").filter(Boolean) : [];
const lost = ph.filter((l) => / NODE_(SKIP|DROP) /.test(l)).map((l) => ({ t: T(l.slice(0, 20)), node: /node=(\S+)/.exec(l)[1] }));
const famDrop = new Set(ph.filter((l) => / FAMILY_DROP /.test(l)).map((l) => Number(/family=(\d+)/.exec(l)[1])));
const liveFams = CFG.families.map((f) => f.family).filter((f) => !famDrop.has(f));
const famsAt = (s) => (s && s.step !== "gap" ? liveFams.filter((f) => f <= s.families).length : 0);
const stepName = (ms) => { const s = stepAt(ms); return s ? s.step : (ms < T(CFG.schedule[0].from) ? "pre" : "post"); };
// sec.csv
const s0 = Math.floor(T(CFG.sec_from_utc) / 1000), s1 = Math.floor(T(CFG.end_utc) / 1000);
const bySec = new Map(); for (const a of att) { const s = Math.floor(T(a.ts) / 1000); const o = bySec.get(s) || { sent: 0, ok: 0, on: new Set() }; o.sent++; if (a.result === "ok") o.ok++; o.on.add(a.sender); bySec.set(s, o); }
const sec = ["utc_second,step,families,senders_target,senders_on,sent,ok"];
for (let s = s0; s < s1; s++) {
  const ms = s * 1000, st = stepAt(ms), on = st && st.step !== "gap";
  const tgt = on ? CFG.senders.filter((x) => !lost.some((l) => l.node === x && l.t <= ms)).length : 0;
  const o = bySec.get(s) || { sent: 0, ok: 0, on: new Set() };
  sec.push([new Date(ms).toISOString().slice(0, 19) + "Z", stepName(ms), famsAt(st), tgt, o.on.size, o.sent, o.ok].join(","));
}
fs.writeFileSync(P("logs", "sec.csv"), sec.join("\n") + "\n");
// minute.csv
const pct = (a, q) => { if (!a.length) return ""; const b = [...a].sort((x, y) => x - y); return Math.round(b[Math.min(b.length - 1, Math.floor(q * b.length))]); };
const m0 = Math.floor(T(CFG.schedule[0].from) / 60000), m1 = Math.ceil(T(CFG.end_utc) / 60000);
const head = "minute_utc,step,family,families,sent,ok," + REJ.map((r) => "rej_" + r).join(",") + ",winners,hops,include_p50_ms,include_p95_ms,seen_p50_ms,seen_p95_ms";
const rows = [head]; let bad = 0; const tot = { sent: 0, ok: 0, rej: Object.fromEntries(REJ.map((r) => [r, 0])), win: 0, inc: [], seen: [] };
let prevFams = liveFams.slice(0, 1);
for (let m = m0; m < m1; m++) {
  const ms = m * 60000, st = stepAt(ms);
  // families live in any second of this minute (a step may start mid-minute); gap-only minutes keep the previous set
  const secSteps = Array.from({ length: 60 }, (_, i) => stepAt(ms + i * 1000));
  let maxF = 0; for (const x of secSteps) if (x && x.step !== "gap") maxF = Math.max(maxF, x.families);
  const seen = new Set(att.filter((a) => Math.floor(T(a.ts) / 60000) === m).map((a) => a.family));
  let fset = maxF ? liveFams.filter((f) => f <= maxF) : prevFams; fset = [...new Set([...fset, ...seen])].sort((a, b) => a - b);
  if (maxF) prevFams = fset;
  const names = [...new Set(secSteps.map((x) => (x ? x.step : stepName(ms))))]; const stepLabel = names.join("/");
  for (const fam of fset) {
    const A = att.filter((a) => a.family === fam && Math.floor(T(a.ts) / 60000) === m);
    const W = out.filter((a) => a.family === fam && a.result === "ok" && a.accept_header_utc && Math.floor(T(a.accept_header_utc) / 60000) === m);
    const Wts = out.filter((a) => a.family === fam && a.result === "ok" && a.seen_utc && Math.floor(T(a.ts) / 60000) === m);
    const inc = Wts.filter((a) => a.accept_header_utc).map((a) => T(a.accept_header_utc) - T(a.ts)), sn = Wts.map((a) => T(a.seen_utc) - T(a.ts));
    const r = Object.fromEntries(REJ.map((k) => [k, A.filter((a) => a.result !== "ok" && a.reason === k).length]));
    const ok = A.filter((a) => a.result === "ok").length;
    if (A.length !== ok + Object.values(r).reduce((x, y) => x + y, 0)) bad++;
    tot.sent += A.length; tot.ok += ok; for (const k of REJ) tot.rej[k] += r[k]; tot.win += W.length; tot.inc.push(...inc); tot.seen.push(...sn);
    rows.push([new Date(ms).toISOString().slice(0, 16) + "Z", stepLabel, fam, maxF ? liveFams.filter((f) => f <= maxF).length : 0, A.length, ok, ...REJ.map((k) => r[k]), W.length, W.length, pct(inc, .5), pct(inc, .95), pct(sn, .5), pct(sn, .95)].join(","));
  }
}
fs.writeFileSync(P("logs", "minute.csv"), rows.join("\n") + "\n");
// checks
let gaps = 0; for (let i = 2; i < sec.length; i++) if (T(sec[i].split(",")[0]) - T(sec[i - 1].split(",")[0]) !== 1000) gaps++;
const winners = out.filter((a) => a.result === "ok" && a.seen_utc);
console.log(JSON.stringify({ sec_rows: sec.length - 1, sec_expected: s1 - s0, sec_gaps: gaps, minute_rows: rows.length - 1, equality_failures: bad,
  sent: tot.sent, ok: tot.ok, rej: tot.rej, attempts_in_file: att.length, winners_with_seen: winners.length, winners_with_header: winners.filter((a) => a.accept_header_utc).length,
  include_p50_ms: pct(tot.inc, .5), include_p95_ms: pct(tot.inc, .95), seen_p50_ms: pct(tot.seen, .5), seen_p95_ms: pct(tot.seen, .95),
  tokens: [...new Set(ph.map((l) => l.split(" ")[1]))] }));
