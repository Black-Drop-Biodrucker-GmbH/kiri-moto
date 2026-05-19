# Build a standalone Windows .exe using Node.js SEA (Single Executable Application).
# Run from the repo root: .\bin\build-sea-win.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Set-Location $root
New-Item -ItemType Directory -Force dist | Out-Null

Write-Host "Bundling source..."
node bin/bundle-cli.mjs

Write-Host "Generating SEA blob..."
node --experimental-sea-config sea-config.json

Write-Host "Copying node binary..."
$nodePath = (Get-Command node).Source
Copy-Item $nodePath dist/kiri-win.exe -Force

Write-Host "Injecting SEA blob..."
npx postject dist/kiri-win.exe NODE_SEA_BLOB dist/sea-prep.blob `
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 `
    --overwrite

Write-Host "Done: dist/kiri-win.exe"
dist/kiri-win.exe --help
