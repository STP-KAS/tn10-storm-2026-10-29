<#
.SYNOPSIS
  node-watch.ps1: READ-ONLY watch of this machine's own kaspad, every 5 s. Writes logs\node-watch-<label>.csv.
  Columns: ts_utc,label,rpc_ms,synced,peers,mempool,daa,kaspad_cpu_pct,kaspad_ram_mb,free_ram_mb,probe_ms,err
  No sends, no kaspad changes (only reads Get-Process and the local RPC). TESTNET-10 ONLY. Stop: Ctrl+C or Stop-Process.
.EXAMPLE
  .\node-watch.ps1 -Kit <your-folder>\tn10-storm-kit -Label desk -Out <your-folder>\tn10-storm-2026-10-29\logs [-NodeExe node] [-Probe <public-host>:443]
#>
param([string]$Kit, [string]$Label, [string]$Out, [string]$WsModule = '', [string]$NodeExe = 'node', [string]$Url = 'ws://127.0.0.1:17210', [string]$Probe = '', [int]$Every = 5)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Out | Out-Null
$csv = Join-Path $Out "node-watch-$Label.csv"
if (-not (Test-Path $csv)) { 'ts_utc,label,rpc_ms,synced,peers,mempool,daa,kaspad_cpu_pct,kaspad_ram_mb,free_ram_mb,probe_ms,err' | Out-File $csv -Encoding ascii }
$ws = if ($WsModule) { $WsModule } else { Join-Path $Kit 'node_modules\websocket' }
if (-not (Test-Path $ws)) { $ws = (Get-Content (Join-Path $Kit 'config.example.json') -Raw | ConvertFrom-Json).websocket_module }
$na = @("$PSScriptRoot\node-watch.mjs", '--sdk', (Join-Path $Kit 'sdk\kaspa\kaspa.js'), '--url', $Url, '--every', $Every)
if ($ws) { $na += @('--ws', $ws) }; if ($Probe) { $na += @('--probe', $Probe) }
$n = [Environment]::ProcessorCount; $prev = $null; $pt = $null
& $NodeExe @na | ForEach-Object {
  $line = [string]$_; $r = $line | ConvertFrom-Json; $ts = if ($line -match '"ts":"([^"]+)"') { $Matches[1] } else { '' }
  $k = Get-Process kaspad -ErrorAction SilentlyContinue | Select-Object -First 1
  $cpu = ''; $ram = ''
  if ($k) { $now = Get-Date; if ($prev -ne $null) { $cpu = [math]::Round(100 * ($k.TotalProcessorTime.TotalSeconds - $prev) / (($now - $pt).TotalSeconds * $n), 1) }; $prev = $k.TotalProcessorTime.TotalSeconds; $pt = $now; $ram = [math]::Round($k.WorkingSet64 / 1MB) }
  $free = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
  "$ts,$Label,$($r.rpc_ms),$($r.synced),$($r.peers),$($r.mempool),$($r.daa),$cpu,$ram,$free,$($r.probe_ms),$($r.err)" | Out-File $csv -Append -Encoding ascii
}
