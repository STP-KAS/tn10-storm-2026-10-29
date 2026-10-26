<#
.SYNOPSIS
  Repeated contention dry runs on one PC: per cycle a fresh family pair (fresh "genesis"), coordinator -> sender
  outpoint flow, and a coordinator failover (kill + --takeover) in step 2. Health watch aborts on the rules in health.mjs.
  Each cycle keeps its own private folder. TESTNET-10 ONLY. Never touches kaspad or miners.
.EXAMPLE
  .\cycle.ps1 -Base <your-folder>\tn10-storm-dry -Kit <your-folder>\tn10-storm-kit -Lanes 1,2,3,4 -Cycles 2
#>
param([string]$Base, [string]$Kit, [long[]]$Lanes, [int]$Cycles = 3, [int]$Rate = 1, [int]$StartCycle = 1)
$ErrorActionPreference = 'Stop'
$tpl = Get-Content "$Base\config.json" -Raw | ConvertFrom-Json
for ($c = $StartCycle; $c -lt $StartCycle + $Cycles; $c++) {
  if (Test-Path "$Base\ABORTED") { "aborted earlier; not starting cycle $c"; break }
  $run = "$Base\cycle-$c"; New-Item -ItemType Directory -Force $run | Out-Null
  $t = [datetime]::UtcNow; $b = $t.AddSeconds(90 - $t.Second); $f = { param($s) $b.AddSeconds($s).ToString('yyyy-MM-ddTHH:mm:ss.000Z') }
  $cfg = $tpl | ConvertTo-Json -Depth 6 | ConvertFrom-Json
  $cfg.run_dir = $run
  $cfg.families = @(@{ family = 1; lane_id = $Lanes[2 * ($c - 1)] }, @{ family = 2; lane_id = $Lanes[2 * ($c - 1) + 1] })
  $cfg.sec_from_utc = (& $f -30); $cfg.family_check_utc = (& $f -20); $cfg.end_utc = (& $f 240)
  $cfg.schedule = @(@{ step = '1'; from = (& $f 0); to = (& $f 90); families = 1; rate = $Rate }, @{ step = 'gap'; from = (& $f 90); to = (& $f 120); families = 0; rate = 0 }, @{ step = '2'; from = (& $f 120); to = (& $f 240); families = 2; rate = $Rate })
  $cfg | ConvertTo-Json -Depth 6 | Set-Content "$run\config.json" -Encoding utf8
  $env:STORM_CONFIG = "$run\config.json"
  powershell -NoProfile -ExecutionPolicy Bypass -File "$Kit\ntplog.ps1" -Machine desk -OutFile "$run\ntp.csv" | Out-Null
  $hp = Start-Process node -ArgumentList "health.mjs" -WorkingDirectory $Kit -WindowStyle Hidden -PassThru -RedirectStandardOutput "$run\health.out" -RedirectStandardError "$run\health.err"
  $c1 = Start-Process node -ArgumentList "coordinator.mjs" -WorkingDirectory $Kit -WindowStyle Hidden -PassThru -RedirectStandardOutput "$run\coord1.out" -RedirectStandardError "$run\coord1.err"
  $sp = Start-Process node -ArgumentList "sender.mjs --label desk --node $($cfg.main_node_url)" -WorkingDirectory $Kit -WindowStyle Hidden -PassThru -RedirectStandardOutput "$run\sender.out" -RedirectStandardError "$run\sender.err"
  "cycle $c T0=$(& $f 0) pids health=$($hp.Id) coord=$($c1.Id) sender=$($sp.Id)"
  # failover 40 s into step 2
  while ([datetime]::UtcNow -lt $b.AddSeconds(160)) { Start-Sleep 1; if (Test-Path "$run\control\ABORT") { break } }
  if (-not $c1.HasExited) { Stop-Process -Id $c1.Id; Start-Sleep 5 }
  $c2 = Start-Process node -ArgumentList "coordinator.mjs --takeover --label desk --reason main_dead" -WorkingDirectory $Kit -WindowStyle Hidden -PassThru -RedirectStandardOutput "$run\coord2.out" -RedirectStandardError "$run\coord2.err"
  "cycle $c failover: killed coord $($c1.Id), takeover $($c2.Id)"
  foreach ($p in @($sp, $c2, $hp)) { if (-not $p.WaitForExit(120000)) { Stop-Process -Id $p.Id -Force } }
  Push-Location $Kit; node aggregate.mjs | Set-Content "$run\check.json"; Pop-Location
  Get-Content "$run\check.json"
  if (Test-Path "$run\control\ABORT") { Copy-Item "$run\control\ABORT" "$Base\ABORTED"; "ABORT: " + (Get-Content "$run\control\ABORT"); break }
}
