//! Storm builder (TN10 only). Line protocol on stdin, one JSON line per reply. Keys stay in the key file; never printed.
//! Unlike `contend`, chain state is set from outside (`follow`), so many processes on many machines can build hops for
//! the same family: the coordinator (or a self-discovering sender) tells each builder the current minter.
//!   ping
//!   genesis <key> <fund_txid> <index> <amount> <launch_path>   -> tx, covenantId, owner, minterSpk
//!   follow <covenantId> <owner_hex> <minter_txid> <index> <remaining> <minter_spk_hex>
//!   nextspk                                                     -> script of the next minter (for hop detection)
//!   hop <key> <fund_txid> <index> <amount> <nonce>              -> tx (input 0 minter, input 1 fund; out 0 minter, 1 token, 2 change)
//!   quit
use std::fs;
use std::io::{BufRead, Write};
use std::str::FromStr;

use argent::artifact::Artifact;
use argent_runtime::{CovenantOutput, EntryCall, InputSigScript, TxBuilder, TxContext, args, state};
use kaspa_consensus_core::mass::MassCalculator;
use kaspa_consensus_core::tx::{
    CovenantBinding, MutableTransaction, ScriptPublicKey, Transaction, TransactionId,
    TransactionOutpoint, UtxoEntry,
};
use secp256k1::{Keypair, Secp256k1, SecretKey};

use super::support::sign_input;

const NAME: &[u8] = b"contention-2026-10-29";
const SUPPLY: i64 = 100_000;
const LIMIT: i64 = 1;
const MINTER: u64 = 1_000_000_000;
const TOKEN: u64 = 20_000_000;
const STORAGE_LIMIT: u64 = 500_000;

fn fee_rate() -> u64 { std::env::var("STORM_FEE_RATE").ok().and_then(|v| v.parse().ok()).unwrap_or(200).max(100) }

struct Chain {
    remaining: i64,
    outpoint: TransactionOutpoint,
    amount: u64,
    spk: ScriptPublicKey,
    covenant_id: kaspa_consensus_core::Hash,
    owner: [u8; 32],
}

pub fn run(artifact: &Artifact) -> Result<(), Box<dyn std::error::Error>> {
    let keys = load_keys(&std::env::var("STORM_KEYS")?)?;
    let extension = *blake3::hash(NAME).as_bytes();
    let mut chain: Option<Chain> = None;
    let mut stdout = std::io::stdout();
    for line in std::io::stdin().lock().lines() {
        let line = line?;
        let line = line.trim();
        if line.is_empty() { continue; }
        match handle(artifact, &keys, &extension, &mut chain, line) {
            Ok(json) => writeln!(stdout, "{json}")?,
            Err(error) => writeln!(stdout, "{{\"ok\":false,\"error\":{}}}", json_str(&error.to_string()))?,
        }
        stdout.flush()?;
        if line == "quit" { break; }
    }
    Ok(())
}

fn key_at<'a>(keys: &'a [Keypair], s: Option<&str>) -> Result<&'a Keypair, Box<dyn std::error::Error>> {
    let i: usize = s.ok_or("key")?.parse()?;
    keys.get(i).ok_or_else(|| "key index".into())
}

fn handle(artifact: &Artifact, keys: &[Keypair], extension: &[u8; 32], chain: &mut Option<Chain>, line: &str) -> Result<String, Box<dyn std::error::Error>> {
    let mut parts = line.split_whitespace();
    match parts.next().unwrap_or("") {
        "ping" => Ok("{\"ok\":true,\"cmd\":\"ping\"}".to_string()),
        "genesis" => {
            let key = key_at(keys, parts.next())?;
            let txid = parts.next().ok_or("txid")?;
            let index: u32 = parts.next().ok_or("index")?.parse()?;
            let amount: u64 = parts.next().ok_or("amount")?.parse()?;
            let path = parts.next().ok_or("launch path")?;
            if !path.starts_with("launch::storm-2026-10-") { return Err("launch path not on the storm allow-list".into()); }
            let owner = key.x_only_public_key().0.serialize();
            let built = build_genesis(artifact, key, &owner, extension, txid, index, amount, path)?;
            let minter = CovenantOutput::from_tx(&built.tx, 0)?;
            let spk = built.tx.outputs[0].script_public_key.clone();
            *chain = Some(Chain { remaining: SUPPLY, outpoint: minter.outpoint, amount: MINTER, spk: spk.clone(), covenant_id: minter.covenant_id, owner });
            Ok(format!(
                "{{\"ok\":true,\"cmd\":\"genesis\",\"txid\":{},\"covenantId\":{},\"owner\":{},\"minterSpk\":{},\"remaining\":{SUPPLY},\"minter\":{MINTER},\"fee\":{},\"tx\":{}}}",
                json_str(&built.tx.id().to_string()), json_str(&minter.covenant_id.to_string()), json_str(&hex(&owner)),
                json_str(&hex(spk.script())), built.fee, tx_json(&built.tx)))
        }
        "follow" => {
            let covenant_id = kaspa_consensus_core::Hash::from_str(parts.next().ok_or("covenant")?)?;
            let ob = hex_decode(parts.next().ok_or("owner")?)?;
            let owner: [u8; 32] = ob.try_into().map_err(|_| "owner length")?;
            let txid = parts.next().ok_or("txid")?;
            let index: u32 = parts.next().ok_or("index")?.parse()?;
            let remaining: i64 = parts.next().ok_or("remaining")?.parse()?;
            let spk = ScriptPublicKey::from_vec(0, hex_decode(parts.next().ok_or("spk")?)?);
            *chain = Some(Chain { remaining, outpoint: TransactionOutpoint::new(TransactionId::from_str(txid)?, index), amount: MINTER, spk, covenant_id, owner });
            Ok(format!("{{\"ok\":true,\"cmd\":\"follow\",\"remaining\":{remaining}}}"))
        }
        "nextspk" => {
            let c = chain.as_ref().ok_or("no chain")?;
            // build a throwaway hop with a dummy funding entry; the next minter script does not depend on the sender
            let dummy = "00".repeat(32);
            let built = build_hop(artifact, &keys[0], extension, c, &dummy, 0, 100_000_000_000, 0)?;
            Ok(format!("{{\"ok\":true,\"cmd\":\"nextspk\",\"spk\":{}}}", json_str(&hex(built.tx.outputs[0].script_public_key.script()))))
        }
        "hop" => {
            let c = chain.as_ref().ok_or("no chain")?;
            let key = key_at(keys, parts.next())?;
            let txid = parts.next().ok_or("txid")?;
            let index: u32 = parts.next().ok_or("index")?.parse()?;
            let amount: u64 = parts.next().ok_or("amount")?.parse()?;
            let nonce: u64 = parts.next().ok_or("nonce")?.parse()?;
            let built = build_hop(artifact, key, extension, c, txid, index, amount, nonce)?;
            Ok(format!(
                "{{\"ok\":true,\"cmd\":\"hop\",\"txid\":{},\"fee\":{},\"change\":{},\"compute\":{},\"transient\":{},\"nextSpk\":{},\"tx\":{}}}",
                json_str(&built.tx.id().to_string()), built.fee, built.tx.outputs[2].value, built.compute, built.transient,
                json_str(&hex(built.tx.outputs[0].script_public_key.script())), tx_json(&built.tx)))
        }
        "quit" => Ok("{\"ok\":true,\"cmd\":\"quit\"}".to_string()),
        _ => Err("unknown command".into()),
    }
}

struct Ready { tx: Transaction, fee: u64, compute: u64, transient: u64 }

#[allow(clippy::too_many_arguments)]
fn build_genesis(artifact: &Artifact, key: &Keypair, owner: &[u8; 32], extension: &[u8; 32], txid: &str, index: u32, amount: u64, path: &str) -> Result<Ready, Box<dyn std::error::Error>> {
    let mut fee = 3_000_000u64;
    let mut last = String::from("genesis");
    for _ in 0..6 {
        if amount <= MINTER + fee { return Err(format!("genesis funding {amount} fee {fee}").into()); }
        let change = amount - MINTER - fee;
        let spk = p2pk(&key.x_only_public_key().0.serialize());
        let entry = UtxoEntry::new(amount, spk.clone(), 0, false, None);
        let tx = TxBuilder::new(artifact)?.build(
            &TxContext::new()
                .input(TransactionOutpoint::new(TransactionId::from_str(txid)?, index), entry.clone(),
                    InputSigScript::with_transaction(|tx, i| p2pk_signature(&sign_input(tx, i, key))), 0)
                .actor_genesis_output(0, path, "PublicMint", minter_state(SUPPLY, LIMIT, owner, extension), MINTER)
                .output(spk, None, change),
        )?;
        let ready = commit(tx, "genesis", &[entry], fee)?;
        let need = required_fee(ready.compute, ready.transient);
        if fee >= need { return Ok(ready); }
        fee = need; last = format!("need {need}");
    }
    Err(last.into())
}

#[allow(clippy::too_many_arguments)]
fn build_hop(artifact: &Artifact, key: &Keypair, extension: &[u8; 32], chain: &Chain, txid: &str, index: u32, amount: u64, nonce: u64) -> Result<Ready, Box<dyn std::error::Error>> {
    let sender_pk = key.x_only_public_key().0.serialize();
    let mut fee = 5_000_000u64;
    let mut last = String::from("hop");
    for _ in 0..6 {
        if amount <= TOKEN + fee { return Err(format!("hop funding {amount} fee {fee}").into()); }
        let change = amount - TOKEN - fee;
        let before = minter_state(chain.remaining, LIMIT, &chain.owner, extension);
        let after = minter_state(chain.remaining - LIMIT, LIMIT, &chain.owner, extension);
        let minted = recipient_state(&sender_pk, LIMIT, extension);
        let fund_spk = p2pk(&sender_pk);
        let minter_entry = UtxoEntry::new(chain.amount, chain.spk.clone(), 0, false, Some(chain.covenant_id));
        let fund_entry = UtxoEntry::new(amount, fund_spk.clone(), 0, false, None);
        let tx = TxBuilder::new(artifact)?.build(
            &TxContext::new()
                .payload(nonce.to_le_bytes().to_vec())
                .actor_input("PublicMint", before, EntryCall::new("mint").args(args!(minted.clone())), chain.outpoint, minter_entry.clone(), 0)
                .input(TransactionOutpoint::new(TransactionId::from_str(txid)?, index), fund_entry.clone(),
                    InputSigScript::with_transaction(|tx, i| p2pk_signature(&sign_input(tx, i, key))), 0)
                .actor_output("PublicMint", after, CovenantBinding::new(0, chain.covenant_id), chain.amount)
                .actor_output("KCC20", minted, CovenantBinding::new(0, chain.covenant_id), TOKEN)
                .output(fund_spk, None, change),
        )?;
        let ready = commit(tx, "hop", &[minter_entry, fund_entry], fee)?;
        let need = required_fee(ready.compute, ready.transient);
        if fee >= need { return Ok(ready); }
        fee = need; last = format!("need {need}");
    }
    Err(last.into())
}

fn load_keys(path: &str) -> Result<Vec<Keypair>, Box<dyn std::error::Error>> {
    let mut keys = Vec::new();
    for line in fs::read_to_string(path)?.lines().map(str::trim).filter(|l| !l.is_empty()) {
        let bytes = hex_decode(line)?;
        if bytes.len() != 32 { return Err("key length".into()); }
        keys.push(Keypair::from_secret_key(&Secp256k1::new(), &SecretKey::from_slice(&bytes)?));
    }
    if keys.is_empty() { return Err("no keys".into()); }
    Ok(keys)
}

fn commit(mut tx: Transaction, label: &str, entries: &[UtxoEntry], fee: u64) -> Result<Ready, Box<dyn std::error::Error>> {
    let calculator = MassCalculator::new(1, 10, 1_000_000_000_000);
    let populated = MutableTransaction::with_entries(tx.clone(), entries.to_vec());
    let storage = calculator
        .calc_contextual_masses(&populated.as_verifiable())
        .ok_or("storage mass")?
        .storage_mass;
    if storage > STORAGE_LIMIT {
        return Err(format!("{label} storage {storage}").into());
    }
    tx.set_storage_mass(storage);
    tx.finalize();
    let masses = calculator.calc_non_contextual_masses(&tx);
    if masses.compute_mass > 100_000 {
        return Err(format!("{label} compute {}", masses.compute_mass).into());
    }
    let input_value: u64 = entries.iter().map(|entry| entry.amount).sum();
    let output_value: u64 = tx.outputs.iter().map(|output| output.value).sum();
    if input_value < output_value {
        return Err(format!("{label} values").into());
    }
    let paid = input_value - output_value;
    if paid != fee {
        return Err(format!("{label} fee {paid} wanted {fee}").into());
    }
    Ok(Ready {
        tx,
        fee: paid,
        compute: masses.compute_mass,
        transient: masses.transient_mass,
    })
}

fn required_fee(compute: u64, transient: u64) -> u64 {
    compute.max(transient.div_ceil(2)).saturating_mul(fee_rate()).max(1)
}

fn minter_state(remaining: i64, mint_amount: i64, owner: &[u8; 32], extension: &[u8; 32]) -> super::TokenState {
    state! {
        remaining: remaining,
        mint_amount: mint_amount,
        owner: owner.to_vec(),
        extension_commitment: extension.to_vec()
    }
}

fn recipient_state(owner: &[u8; 32], amount: i64, extension: &[u8; 32]) -> super::TokenState {
    let mut row = super::token_state(owner, amount);
    row.insert("extension_commitment".into(), extension.to_vec().into());
    row
}

fn p2pk(public_key: &[u8; 32]) -> ScriptPublicKey {
    let mut script = Vec::with_capacity(34);
    script.push(32);
    script.extend_from_slice(public_key);
    script.push(0xac);
    ScriptPublicKey::from_vec(0, script)
}

fn p2pk_signature(raw: &[u8]) -> Vec<u8> {
    let mut script = Vec::with_capacity(1 + raw.len());
    script.push(u8::try_from(raw.len()).expect("signature length"));
    script.extend_from_slice(raw);
    script
}

fn tx_json(tx: &Transaction) -> String {
    let mut inputs = String::from("[");
    for (index, input) in tx.inputs.iter().enumerate() {
        if index > 0 {
            inputs.push(',');
        }
        inputs.push_str(&format!(
            "{{\"previousOutpoint\":{{\"transactionId\":{},\"index\":{}}},\"signatureScript\":{},\"sequence\":\"{}\",\"computeBudget\":{}}}",
            json_str(&input.previous_outpoint.transaction_id.to_string()),
            input.previous_outpoint.index,
            json_str(&hex(&input.signature_script)),
            input.sequence,
            input.compute_commit.compute_budget().unwrap_or(0)
        ));
    }
    inputs.push(']');
    let mut outputs = String::from("[");
    for (index, output) in tx.outputs.iter().enumerate() {
        if index > 0 {
            outputs.push(',');
        }
        let covenant = match output.covenant {
            Some(binding) => format!(
                "{{\"authorizingInput\":{},\"covenantId\":{}}}",
                binding.authorizing_input,
                json_str(&binding.covenant_id.to_string())
            ),
            None => "null".to_string(),
        };
        outputs.push_str(&format!(
            "{{\"value\":\"{}\",\"scriptPublicKey\":{{\"version\":{},\"script\":{}}},\"covenant\":{covenant}}}",
            output.value,
            output.script_public_key.version(),
            json_str(&hex(output.script_public_key.script()))
        ));
    }
    outputs.push(']');
    format!(
        "{{\"version\":{},\"inputs\":{inputs},\"outputs\":{outputs},\"lockTime\":\"{}\",\"subnetworkId\":{},\"gas\":\"{}\",\"payload\":{},\"storageMass\":\"{}\"}}",
        tx.version,
        tx.lock_time,
        json_str(&hex(tx.subnetwork_id.as_bytes())),
        tx.gas,
        json_str(&hex(&tx.payload)),
        tx.storage_mass()
    )
}

fn json_str(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(DIGITS[(byte >> 4) as usize] as char);
        out.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    out
}

fn hex_decode(text: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    if text.len() % 2 != 0 {
        return Err("hex".into());
    }
    let mut out = Vec::with_capacity(text.len() / 2);
    let bytes = text.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        out.push((hex_value(bytes[index])? << 4) | hex_value(bytes[index + 1])?);
        index += 2;
    }
    Ok(out)
}

fn hex_value(byte: u8) -> Result<u8, Box<dyn std::error::Error>> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err("hex".into()),
    }
}
