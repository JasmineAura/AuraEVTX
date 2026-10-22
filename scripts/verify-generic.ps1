$ErrorActionPreference = 'Stop'
$fixtureDir = Join-Path (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path '.local-fixtures\upstream'
New-Item -ItemType Directory -Force -Path $fixtureDir | Out-Null
$expected = [ordered]@{}
foreach ($name in @('security.evtx','system.evtx','Application.evtx')) {
    $target = Join-Path $fixtureDir $name
    if(-not (Test-Path -LiteralPath $target)) { Invoke-WebRequest -Uri "https://raw.githubusercontent.com/omerbenamram/evtx/master/samples/$name" -OutFile $target }
    $records = @(Get-WinEvent -Path $target -Oldest)
    $expected[$name] = $records.Count
    Write-Output "$name : $($records.Count) Windows-native records"
}
$expected | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixtureDir 'expected.json') -Encoding utf8NoBOM
$env:AURA_EVTX_FIXTURES = $fixtureDir
cargo test --manifest-path (Join-Path $PSScriptRoot '..\src-tauri\Cargo.toml') generic_evtx_matches_windows_native_counts -- --ignored --nocapture
if ($LASTEXITCODE -ne 0) { throw 'Generic EVTX verification failed' }
