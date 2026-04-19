# Script para iniciar Expo en Windows
# Evita problemas con npm/npx en rutas con espacios

$nodeModulesPath = Join-Path $PSScriptRoot "node_modules"
$exposePath = Join-Path $nodeModulesPath "expo"
$cliPath = Join-Path $exposePath "bin\cli"

Write-Host "Iniciando Expo desde: $cliPath"
Write-Host ""

& node $cliPath start
