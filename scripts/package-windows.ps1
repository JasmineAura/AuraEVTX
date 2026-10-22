$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$version = (Get-Content -LiteralPath (Join-Path $projectDir 'package.json') -Raw | ConvertFrom-Json).version
$binary = Join-Path $projectDir 'src-tauri\target\release\aura-evtx.exe'
if (-not (Test-Path -LiteralPath $binary)) { throw '请先执行 npm run desktop:build' }
$releaseRoot = Join-Path $projectDir 'release'
$stageRoot = Join-Path $releaseRoot ('.staging-' + [guid]::NewGuid().ToString('N'))
$outputDir = [System.IO.Path]::GetFullPath((Join-Path $stageRoot 'AuraEVTX'))
if (-not $outputDir.StartsWith(([System.IO.Path]::GetFullPath($releaseRoot) + [System.IO.Path]::DirectorySeparatorChar), [System.StringComparison]::OrdinalIgnoreCase)) { throw '打包路径越出 release 目录' }
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Copy-Item -LiteralPath $binary -Destination (Join-Path $outputDir 'AuraEVTX.exe')
Copy-Item -LiteralPath $binary -Destination (Join-Path $releaseRoot 'AuraEVTX.exe') -Force
Copy-Item -LiteralPath (Join-Path $projectDir 'README.md') -Destination (Join-Path $outputDir 'README.md')
Copy-Item -LiteralPath (Join-Path $projectDir 'docs') -Destination $outputDir -Recurse
$zipPath = Join-Path $releaseRoot 'AuraEVTX-windows-x64.zip'
Compress-Archive -LiteralPath $outputDir -DestinationPath $zipPath -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    if ($archive.Entries | Where-Object { $_.FullName -match '(?i)(^|/)(example|examples|test-results|tests|node_modules)(/|$)|\.(evtx|db|db-wal|db-shm)$' }) { throw '发行包意外包含日志或开发资料' }
} finally { $archive.Dispose() }
$checksums = @($zipPath, (Join-Path $releaseRoot 'AuraEVTX.exe')) | ForEach-Object {
    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_
    '{0}  {1}' -f $hash.Hash.ToLowerInvariant(), [System.IO.Path]::GetFileName($_)
}
$checksums | Set-Content -LiteralPath (Join-Path $releaseRoot 'SHA256SUMS.txt') -Encoding utf8NoBOM
Write-Output "Windows v$version packaged without logs or test data."
Get-Item -LiteralPath $zipPath, (Join-Path $releaseRoot 'AuraEVTX.exe'), (Join-Path $releaseRoot 'SHA256SUMS.txt') | Select-Object Name,Length
