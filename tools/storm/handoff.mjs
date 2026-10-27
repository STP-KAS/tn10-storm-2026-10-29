// handoff.mjs: move the post-genesis family states from the main (mini) coordinator to remote self-following senders.
//   on the main:   node handoff.mjs export > handoff.json      (after the GENESIS phase line; chain-public data only)
//   on a remote:   node handoff.mjs import handoff.json        (before START; self senders wait until it is there)
// Only covenantId / owner pubkey / minter outpoint / remaining / spk are carried. No keys. TESTNET-10 ONLY.
import fs from "node:fs";
import { CFG, readState, writeState } from "./lib.mjs";
const [cmd, file] = process.argv.slice(2);
const fams = CFG.families.map((f) => f.family);
if (cmd === "export") {
  const out = {};
  for (const f of fams) { const s = readState(f); if (!s || !s.covenantId) { console.error(`family ${f}: no state yet (wait for GENESIS)`); process.exit(3); } out[f] = { covenantId: s.covenantId, owner: s.owner, txid: s.txid, index: s.index, remaining: s.remaining, spk: s.spk, seq: s.seq || 0, amount: String(s.amount) }; }
  process.stdout.write(JSON.stringify({ kind: "storm-handoff", families: out }) + "\n");
} else if (cmd === "import") {
  const j = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  if (j.kind !== "storm-handoff") { console.error("not a handoff file"); process.exit(4); }
  for (const f of fams) { const s = j.families[f]; if (!s) { console.error(`family ${f} missing`); process.exit(4); } writeState(f, { ...s, source: "handoff" }); }
  console.error(`imported ${fams.length} families`);
} else { console.error("usage: handoff.mjs export | import <file>"); process.exit(5); }
