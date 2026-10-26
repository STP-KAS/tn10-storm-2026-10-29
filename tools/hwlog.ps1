<#
.SYNOPSIS
  Passive hardware logger for the TN10 run (Thu 29 Oct 2026). Read-only.
.DESCRIPTION
  Every IntervalSeconds (default 5) appends one CSV row with system and kaspad.exe
  load. The 'label' column is the -Label you pass (desk/mini); the script never
  records hostname, IP or username. Uses only Get-Counter and Get-Process reads. Never starts, stops, signals
  or reconfigures kaspad. Stop with Ctrl+C or -DurationMinutes.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\hwlog.ps1 -Label desk -DurationMinutes 120
#>
param(
  [Parameter(Mandatory = $true)][string]$Label,
  [string]$OutFile = "",
  [double]$DurationMinutes = 0,
  [int]$IntervalSeconds = 5
)

if (-not $OutFile) { $OutFile = Join-Path (Get-Location) "hwlog-$Label.csv" }
$header = 'utc,label,cpu_total_pct,ram_avail_mb,disk_reads_s,disk_writes_s,disk_queue,kaspad_ws_mb,kaspad_cpu_pct'
if (-not (Test-Path $OutFile)) { Set-Content -Path $OutFile -Value $header -Encoding ascii }

$counters = @(
  '\Processor(_Total)\% Processor Time',
  '\Memory\Available MBytes',
  '\PhysicalDisk(_Total)\Disk Reads/sec',
  '\PhysicalDisk(_Total)\Disk Writes/sec',
  '\PhysicalDisk(_Total)\Current Disk Queue Length'
)
$cores = [Environment]::ProcessorCount
$inv = [Globalization.CultureInfo]::InvariantCulture
$end = if ($DurationMinutes -gt 0) { (Get-Date).AddMinutes($DurationMinutes) } else { [datetime]::MaxValue }
$prevCpu = $null; $prevT = $null

Write-Host "hwlog: label=$Label out=$(Split-Path -Leaf $OutFile) (Ctrl+C to stop)"
try {
  while ((Get-Date) -lt $end) {
    $tick = Get-Date
    $samples = @()
    try { $samples = (Get-Counter -Counter $counters -ErrorAction SilentlyContinue).CounterSamples } catch { }
    # Match by path suffix, case-insensitive; a missing sample becomes 0.
    function cv([string]$suffix) {
      $m = $samples | Where-Object { $_.Path.ToLowerInvariant().EndsWith($suffix.ToLowerInvariant()) } | Select-Object -First 1
      if ($m) { [double]$m.CookedValue } else { 0.0 }
    }
    $ws = 0.0; $kcpu = 0.0
    $p = Get-Process -Name kaspad -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($p) {
      $ws = [math]::Round($p.WorkingSet64 / 1MB, 1)
      $now = Get-Date
      if ($null -ne $prevCpu -and $null -ne $p.TotalProcessorTime) {
        $dt = ($now - $prevT).TotalSeconds
        if ($dt -gt 0) { $kcpu = [math]::Round((($p.TotalProcessorTime.TotalSeconds - $prevCpu) / $dt / $cores) * 100, 1) }
      }
      $prevCpu = $p.TotalProcessorTime.TotalSeconds; $prevT = $now
    } else { $prevCpu = $null }
    function f($x) { if ($null -eq $x) { '0' } else { ([double]$x).ToString('0.##', $inv) } }
    $row = @(
      (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'), $Label,
      (f (cv '\Processor(_Total)\% Processor Time')), (f (cv '\Memory\Available MBytes')),
      (f (cv '\PhysicalDisk(_Total)\Disk Reads/sec')), (f (cv '\PhysicalDisk(_Total)\Disk Writes/sec')),
      (f (cv '\PhysicalDisk(_Total)\Current Disk Queue Length')),
      (f $ws), (f $kcpu)
    ) -join ','
    Add-Content -Path $OutFile -Value $row -Encoding ascii
    $sleep = $IntervalSeconds - ((Get-Date) - $tick).TotalSeconds
    if ($sleep -gt 0) { Start-Sleep -Milliseconds ([int]($sleep * 1000)) }
  }
} finally { Write-Host "hwlog: stopped" }
