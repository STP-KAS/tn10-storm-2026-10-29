#!/usr/bin/env bash
# launch-box.sh: start all box lanes for the storm at T-5 min. TESTNET-10 ONLY. Never touches any kaspad.
# Each public lane signs with its own line of keys_file: PUB1_LABEL/PUB1_KEY (default muon/1) and PUB2_LABEL/PUB2_KEY
# (default boson/2). Any other label (e.g. vector, only if it passes the T-1h check) needs an explicit key.
# Usage: STORM_CONFIG=<run>/config.json [PUB1_LABEL=.. PUB1_KEY=..] [PUB2_LABEL=.. PUB2_KEY=..] [KNS_SUPERVISE=<tn10-1984-water>/kns/scripts/kns-abc-supervise.sh KNS_RUN_DIR=<fresh-kns-run> KNS_CONFIG=<fresh-kns-run>/config/storm.json] ./launch-box.sh <url-pub1> <url-pub2>
set -euo pipefail
cd "$(dirname "$0")"
: "${STORM_CONFIG:?set STORM_CONFIG}"
RUN=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.STORM_CONFIG)).run_dir)')
[ -e "$RUN/control/STOP" ] && { echo "control/STOP present; not starting"; exit 1; }
mkdir -p "$RUN/out"
lane() { # label key-or-empty default-label default-key url
  local L="$1" K="$2"
  if [ -z "$K" ]; then
    if [ "$L" = "$3" ]; then K="$4"; else echo "set an explicit key (own funded key line) for $L"; exit 1; fi
  fi
  nohup node sender.mjs --label "$L" --key "$K" --source self --node "$5" > "$RUN/out/sender-$L.out" 2>&1 &
  echo "$L key=$K pid $!"
}
P1="${PUB1_LABEL:-muon}"; P2="${PUB2_LABEL:-boson}"
[ "$P1" = "$P2" ] && { echo "PUB1 and PUB2 must differ"; exit 1; }
lane "$P1" "${PUB1_KEY:-}" muon 1 "$1"
lane "$P2" "${PUB2_KEY:-}" boson 2 "$2"
if [ -n "${KNS_SUPERVISE:-}" ]; then
  : "${KNS_RUN_DIR:?set KNS_RUN_DIR}" "${KNS_CONFIG:?set KNS_CONFIG}"
  RUN_DIR="$KNS_RUN_DIR" KNS_CONFIG="$KNS_CONFIG" KNS_SHARED_STOP="$RUN/control/STOP" KNS_ABC_ARMED=1 nohup "$KNS_SUPERVISE" --armed 1 > "$RUN/out/kns.out" 2>&1 &
  echo "kns pid $!"
fi
echo "stop: touch $RUN/control/STOP"
