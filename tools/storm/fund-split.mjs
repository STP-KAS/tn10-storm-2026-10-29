// fund-split.mjs: pre-split lane funding from a treasury (or desk) key into N coins of ~TARGET sompi.
// Reads the mnemonic or hex key from a file path given on the command line; NEVER prints it.
// Usage: node fund-split.mjs --wallet <path> --out-address <receive-address> --coins 100 --target-kas 16 --node <url>
//        node fund-split.mjs --keys-file <path> --key 0 --coins 100 --target-kas 16 --node <url>
// Modest batching (≤ 20 outputs per tx). TESTNET-10 ONLY.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const CFG = JSON.parse(fs.readFileSync(process.env.STORM_CONFIG || "config.json", "utf8"));
if (!globalThis.WebSocket && CFG.websocket_module) globalThis.WebSocket = require(CFG.websocket_module).w3cwebsocket;
const kaspa = require(CFG.kaspa_sdk);
const NET = "testnet-10";
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d; };
const URL = arg("node", CFG.main_node_url);
const COINS = Number(arg("coins", "100"));
const TARGET = BigInt(Math.round(Number(arg("target-kas", "16")) * 1e8));
const BATCH = Math.min(20, Number(arg("batch", "20")));
const FEE = 2_000_000n;

function loadKey() {
  const keysFile = arg("keys-file"); const wallet = arg("wallet");
  if (keysFile) {
    const lines = fs.readFileSync(keysFile, "utf8").trim().split(/\r?\n/);
    return new kaspa.PrivateKey(lines[Number(arg("key", "0"))].trim());
  }
  if (!wallet) throw new Error("need --keys-file or --wallet");
  // read silently; support raw mnemonic (12-24 words) or hex
  const raw = fs.readFileSync(wallet, "utf8").trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return new kaspa.PrivateKey(raw);
  const words = raw.split(/\s+/);
  if (![12, 15, 18, 21, 24].includes(words.length)) throw new Error("wallet file is not a mnemonic or hex key");
  const xprv = new kaspa.XPrv(new kaspa.Mnemonic(words.join(" ")).toSeed(process.env.KASPA_BIP39_PASSPHRASE || ""));
  const want = arg("out-address");
  for (const a of [0, 1]) {
    const g = new kaspa.PrivateKeyGenerator(xprv, false, BigInt(a));
    for (let i = 0; i < 40; i++) {
      for (const p of [g.receiveKey(i), g.changeKey(i)]) {
        if (!want || p.toKeypair().toAddress(NET).toString() === want) return p;
      }
    }
  }
  throw new Error("no matching address in wallet");
}

const pk = loadKey();
const address = pk.toKeypair().toAddress(NET).toString();
const outAddr = arg("out-address", address);
const rpc = new kaspa.RpcClient({ url: URL, encoding: kaspa.Encoding.Borsh, networkId: NET });
await rpc.connect({ timeoutDuration: 8000, blockAsyncConnect: true });
const si = await rpc.getServerInfo();
if (si.networkId !== NET) throw new Error("not testnet-10");
let made = 0, rounds = 0;
while (made < COINS && rounds < 30) {
  rounds++;
  const bag = await rpc.getUtxosByAddresses({ addresses: [address] });
  const entries = (bag.entries || []).filter((e) => !e.isCoinbase);
  // prefer one large coin to split
  entries.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
  const need = Math.min(BATCH, COINS - made);
  const big = entries.find((e) => BigInt(e.amount) >= TARGET * BigInt(need) + FEE + TARGET);
  if (!big) { console.log(JSON.stringify({ done: made, reason: "no_large_coin", utxos: entries.length })); break; }
  const outputs = Array.from({ length: need }, () => ({ address: outAddr, amount: TARGET }));
  const built = await kaspa.createTransactions({ networkId: NET, entries: [big], changeAddress: address, outputs, priorityFee: FEE });
  const txs = built.transactions || built;
  for (const tx of txs) {
    tx.sign([pk]);
    const signed = tx.transaction || tx;
    await rpc.submitTransaction({ transaction: signed, allowOrphan: false });
  }
  made += need;
  console.log(JSON.stringify({ round: rounds, made, batch: need }));
  // wait briefly for inclusion before next round
  await new Promise((r) => setTimeout(r, 3000));
}
const after = await rpc.getUtxosByAddresses({ addresses: [outAddr] });
const sizes = (after.entries || []).map((e) => Number(e.amount));
console.log(JSON.stringify({ address_tag: outAddr === address ? "self" : "other", utxos: sizes.length, near_target: sizes.filter((a) => a >= Number(TARGET) * 0.9 && a <= Number(TARGET) * 1.1).length, total_tkas: sizes.reduce((s, a) => s + a, 0) / 1e8 }));
await rpc.disconnect();
