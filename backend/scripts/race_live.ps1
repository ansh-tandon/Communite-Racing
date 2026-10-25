<#
Live view of a race from the database: results, entrants, every pick and live totals (race_live.sql).

  .\backend\scripts\race_live.ps1                  # US GP (race 4), once
  .\backend\scripts\race_live.ps1 -Watch           # refresh every 30 s (Ctrl + C to stop)
  .\backend\scripts\race_live.ps1 -Save            # also save the printout to race-reports\
  .\backend\scripts\race_live.ps1 -Race 10 -Every 60

The database address comes from $env:CRQL_DB, or from backend\.env.prod (one line: CRQL_DB=postgresql://...),
which git ignores. Get it from Render: crql-db -> Connect -> External Database URL.
#>
param(
    [int]$Race = 4,
    [switch]$Watch,
    [int]$Every = 30,
    [switch]$Save
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
$sql = Join-Path $PSScriptRoot 'race_live.sql'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

$db = $env:CRQL_DB
$envFile = Join-Path $root 'backend\.env.prod'
if (-not $db -and (Test-Path $envFile)) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*CRQL_DB\s*=' } | Select-Object -First 1
    if ($line) { $db = ($line -split '=', 2)[1].Trim().Trim('"') }
}
if (-not $db) { throw "No database address. Set `$env:CRQL_DB or put CRQL_DB=postgresql://... in backend\.env.prod" }
if ($db -notmatch 'sslmode=') { $db += $(if ($db -match '\?') { '&' } else { '?' }) + 'sslmode=require' }

chcp 65001 > $null
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:PGCLIENTENCODING = 'UTF8'
$reports = Join-Path $root 'race-reports'

do {
    $out = & $psql $db -X -v race=$Race -f $sql 2>&1 | Out-String
    $stamp = Get-Date -Format 'dd MMM HH:mm:ss'
    if ($Watch) { Clear-Host }
    Write-Host "Race $Race at $stamp IST" -ForegroundColor Cyan
    Write-Host $out
    if ($Save) {
        New-Item -ItemType Directory -Force $reports > $null
        $file = Join-Path $reports ("race{0}-{1}.txt" -f $Race, (Get-Date -Format 'yyyyMMdd-HHmmss'))
        "Race $Race at $stamp IST`n$out" | Out-File -Encoding utf8 $file
        Write-Host "Saved $file" -ForegroundColor DarkGray
    }
    if ($Watch) { Write-Host "Next refresh in $Every s (Ctrl + C to stop)" -ForegroundColor DarkGray; Start-Sleep $Every }
} while ($Watch)
