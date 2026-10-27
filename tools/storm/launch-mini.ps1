<#
.SYNOPSIS
  launch-mini.ps1: start all mini lanes for the storm at T-5 min (broker, coordinator if main, sender). Senders idle until
  START, skip gaps and stop at END by themselves. TESTNET-10 ONLY. Never starts, stops or changes kaspad.
.EXAMPLE
  .\launch-mini.ps1 -Kit <your-folder>\tn10-storm-kit -Config <your-folder>\tn10-storm-2026-10-29\config.json [-NoCoordinator]
#>
param([string]$Kit, [string]$Config, [string]$Node = 'ws://127.0.0.1:17210', [switch]$NoCoordinator)
$ErrorActionPreference = 'Stop'
$env:STORM_CONFIG = $Config
$run = (Get-Content $Config -Raw | ConvertFrom-Json).run_dir
if (Test-Path "$run\control\STOP") { "control/STOP present; not starting"; exit 1 }
New-Item -ItemType Directory -Force "$run\out" | Out-Null
$s = @{ WorkingDirectory = $Kit; WindowStyle = 'Hidden'; PassThru = $true }
$b = Start-Process node -ArgumentList 'builder-broker.mjs' @s -RedirectStandardOutput "$run\out\broker.out" -RedirectStandardError "$run\out\broker.err"
$env:STORM_BUILDER_PORT = '17310'; Start-Sleep 3; "broker pid $($b.Id)"
if (-not $NoCoordinator) { $c = Start-Process node -ArgumentList 'coordinator.mjs' @s -RedirectStandardOutput "$run\out\coord.out" -RedirectStandardError "$run\out\coord.err"; "coordinator pid $($c.Id)" }
$p = Start-Process node -ArgumentList "sender.mjs --label mini --node $Node" @s -RedirectStandardOutput "$run\out\sender.out" -RedirectStandardError "$run\out\sender.err"
"sender mini pid $($p.Id)"
"stop: New-Item $run\control\STOP"
