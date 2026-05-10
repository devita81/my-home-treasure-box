# Instala o Supabase CLI no Windows sem precisar de scoop/winget.
# Baixa o binário oficial do GitHub Releases e coloca em
# `%USERPROFILE%\.supabase-cli\supabase.exe`. Adiciona ao PATH da sessão
# atual; pra persistir, adicionar manualmente em System Environment
# Variables.
#
# Uso: pwsh scripts\install-supabase-cli.ps1

$ErrorActionPreference = 'Stop'

$installDir = "$env:USERPROFILE\.supabase-cli"
$binary = "$installDir\supabase.exe"

if (Test-Path $binary) {
    Write-Host "Supabase CLI já instalado em $binary" -ForegroundColor Green
    & $binary --version
    exit 0
}

Write-Host "Baixando Supabase CLI…" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Pega a última release do GitHub
$latest = Invoke-RestMethod 'https://api.github.com/repos/supabase/cli/releases/latest'
$asset = $latest.assets | Where-Object { $_.name -match 'supabase_windows_amd64\.tar\.gz$' } | Select-Object -First 1

if (-not $asset) {
    throw "Não achei o asset windows_amd64 na release. Verifique manualmente em https://github.com/supabase/cli/releases"
}

$tarPath = "$installDir\supabase.tar.gz"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tarPath
Write-Host "Extraindo…" -ForegroundColor Cyan
tar -xzf $tarPath -C $installDir
Remove-Item $tarPath

if (-not (Test-Path $binary)) {
    throw "Extração falhou — supabase.exe não encontrado em $installDir"
}

# Adiciona no PATH da sessão atual
$env:PATH = "$installDir;$env:PATH"

Write-Host ""
Write-Host "Supabase CLI instalado em $binary" -ForegroundColor Green
& $binary --version

Write-Host ""
Write-Host "PARA PERSISTIR NO PATH (pra abrir novo terminal e funcionar):" -ForegroundColor Yellow
Write-Host "  1. Win + R -> sysdm.cpl -> aba Avançado -> Variáveis de Ambiente"
Write-Host "  2. Edit Path (em User variables) -> New -> $installDir"
Write-Host "  3. OK em tudo, abrir terminal novo"
