<#
.SYNOPSIS
  Appends one row to ntp.csv: utc,machine,offset_ms,source. Read-only (w32tm /stripchart).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\tools\ntplog.ps1 -Machine mini -OutFile <your-folder>\tn10-storm\logs\ntp.csv
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('desk','mini')][string]$Machine,
  [string]$OutFile = ".\ntp.csv",
  [string]$Server = "pool.ntp.org"
)
$inv = [Globalization.CultureInfo]::InvariantCulture
$out = w32tm /stripchart /computer:$Server /samples:3 /dataonly 2>&1
$vals = @($out | ForEach-Object { if ("$_" -match ',\s*([+-]\d+[\.,]\d+)s\s*$') { [double]::Parse(($matches[1] -replace ',', '.'), $inv) } })
if ($vals.Count -eq 0) { Write-Error "no offset samples from $Server"; exit 1 }
$sorted = $vals | Sort-Object
$med = $sorted[[int][math]::Floor($sorted.Count / 2)]
# ntp.csv keeps the w32tm/NTP sign as reported (median of 3 samples).
$ms = [math]::Round($med * 1000, 1).ToString('0.#', $inv)
if (-not (Test-Path $OutFile)) { Set-Content -Path $OutFile -Value 'utc,machine,offset_ms,source' -Encoding ascii }
$row = "$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')),$Machine,$ms,$Server"
Add-Content -Path $OutFile -Value $row -Encoding ascii
Write-Host $row
