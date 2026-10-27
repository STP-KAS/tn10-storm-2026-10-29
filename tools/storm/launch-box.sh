#!/usr/bin/env bash
# launch-box.sh: start all box lanes for the storm at T-5 min. TESTNET-10 ONLY. Never touches any kaspad.
# Each public lane signs with its own line of keys_file: vector = VECTOR_KEY (default 0), second lane = PUB2_KEY
# (default 1 for muon; required for an alternate such as boson).
# Usage: STORM_CONFIG=<run>/config.json [KNS_SUPERVISE=<tn10-1984-water>/kns/scripts/kns-abc-supervise.sh KNS_RUN_DIR=<fresh-kns-run> KNS_CONFIG=<fresh-kns-run>/config/storm.json] ./launch-box.sh <url-vector> <url-muon|url-boson>
set -euo pipefail
cd "$(dirname "$0")"
: "${STORM_CONFIG:?set STORM_CONFIG}"
RUN=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.STORM_CONFIG)).run_dir)')
[ -e "$RUN/control/STOP" ] && { echo "control/STOP present; not starting"; exit 1; }
mkdir -p "$RUN/out"
nohup node sender.mjs --label vector --key "${VECTOR_KEY:-0}" --source self --node "$1" > "$RUN/out/sender-vector.out" 2>&1 &
echo "vector pid $!"
[ "${PUB2_LABEL:-muon}" != muon ] && [ -z "${PUB2_KEY:-}" ] && { echo "set PUB2_KEY (own funded key line) for ${PUB2_LABEL}"; exit 1; }
nohup node sender.mjs --label "${PUB2_LABEL:-muon}" --key "${PUB2_KEY:-1}" --source self --node "$2" > "$RUN/out/sender-${PUB2_LABEL:-muon}.out" 2>&1 &
echo "${PUB2_LABEL:-muon} pid $!"
if [ -n "${KNS_SUPERVISE:-}" ]; then
  : "${KNS_RUN_DIR:?set KNS_RUN_DIR}" "${KNS_CONFIG:?set KNS_CONFIG}"
  RUN_DIR="$KNS_RUN_DIR" KNS_CONFIG="$KNS_CONFIG" KNS_SHARED_STOP="$RUN/control/STOP" KNS_ABC_ARMED=1 nohup "$KNS_SUPERVISE" --armed 1 > "$RUN/out/kns.out" 2>&1 &
  echo "kns pid $!"
fi
echo "stop: touch $RUN/control/STOP"
