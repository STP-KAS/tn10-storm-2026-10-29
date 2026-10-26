#!/usr/bin/env python3
"""Append one row to ntp.csv (utc,machine,offset_ms,source) using a plain SNTP query.
Read-only: never sets the clock. Falls back to HTTPS (cloudflare trace, ~ms resolution, error about half the round trip) when UDP 123 is blocked. Offset = NTP convention (server minus local, same sign w32tm prints), median of 3 samples.
Usage: python3 tools/ntplog.py --machine box --out <run>/logs/ntp.csv [--server pool.ntp.org]"""
import argparse, os, socket, struct, time, datetime, statistics
D = 2208988800
def sample(server):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(3)
    t1 = time.time(); s.sendto(b'\x1b' + 47 * b'\0', (server, 123)); d, _ = s.recvfrom(48); t4 = time.time(); s.close()
    f = lambda i: struct.unpack('!I', d[i:i+4])[0] + struct.unpack('!I', d[i+4:i+8])[0] / 2**32 - D
    t2, t3 = f(32), f(40)
    return ((t2 - t1) + (t3 - t4)) / 2   # NTP convention, server minus local
ap = argparse.ArgumentParser(); ap.add_argument('--machine', required=True, choices=['box', 'desk', 'mini'])
ap.add_argument('--out', default='ntp.csv'); ap.add_argument('--server', default='pool.ntp.org'); a = ap.parse_args()
vals = []
for _ in range(3):
    try: vals.append(sample(a.server))
    except OSError: pass
    time.sleep(1)
src = a.server
if not vals:
    # UDP 123 blocked (as on the box): fall back to Cloudflare's HTTPS trace, which returns ts=<epoch.ms>.
    import urllib.request
    for _ in range(3):
        t1 = time.time(); body = urllib.request.urlopen('https://cloudflare.com/cdn-cgi/trace', timeout=5).read().decode(); t4 = time.time()
        ts = float([l for l in body.splitlines() if l.startswith('ts=')][0][3:])
        vals.append(ts - (t1 + t4) / 2); time.sleep(1)
    src = 'cloudflare-https'
if not vals: raise SystemExit('no time samples')
row = '%s,%s,%.1f,%s' % (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), a.machine, statistics.median(vals) * 1000, src)
new = not os.path.exists(a.out)
with open(a.out, 'a') as fh:
    if new: fh.write('utc,machine,offset_ms,source\n')
    fh.write(row + '\n')
print(row)
