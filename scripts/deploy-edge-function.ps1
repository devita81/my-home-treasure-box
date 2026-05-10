# Deploy direto de uma edge function pro Supabase, sem passar pelo
# Lovable. Use isso quando o Lovable estiver enrolando ou recusando
# redeploy.
#
# Uso:
#   pwsh scripts\deploy-edge-function.ps1
#       -Function fetch-zap-listings
#       -AccessToken sbp_xxxxxxxxxxxx
#
# Você só precisa do AccessToken UMA vez — depois ele fica salvo em
# `~\.supabase-cli\access-token` e o script reusa. Pra invalidar,
# delete esse arquivo.
#
# Pré-requisito: ter rodado `scripts\install-supabase-cli.ps1` antes.

param(
    [Parameter(Mandatory=$true)]
    [string]$Function,

    [string]$AccessToken,

    [string]$ProjectRef = "rbsghoxhcpvrnkemksex"
)

$ErrorActionPreference = 'Stop'

# 1. Localiza o binário (pode estar no PATH ou em ~/.supabase-cli)
$cli = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $cli) {
    $localBin = "$env:USERPROFILE\.supabase-cli\supabase.exe"
    if (Test-Path $localBin) {
        $cli = $localBin
    } else {
        throw "Supabase CLI não encontrado. Rode scripts\install-supabase-cli.ps1 primeiro."
    }
} else {
    $cli = $cli.Source
}

# 2. Resolve access token: parâmetro > arquivo cache > erro
$tokenFile = "$env:USERPROFILE\.supabase-cli\access-token"
if ($AccessToken) {
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.supabase-cli" | Out-Null
    $AccessToken | Out-File -FilePath $tokenFile -Encoding ASCII -NoNewline
    Write-Host "Token salvo em $tokenFile" -ForegroundColor Green
} elseif (Test-Path $tokenFile) {
    $AccessToken = (Get-Content $tokenFile -Raw).Trim()
    Write-Host "Reusando token de $tokenFile" -ForegroundColor Cyan
} else {
    throw @"
AccessToken não fornecido e cache vazio. Gere um Personal Access Token
em https://supabase.com/dashboard/account/tokens e rode com:
  pwsh scripts\deploy-edge-function.ps1 -Function $Function -AccessToken sbp_...
"@
}

$env:SUPABASE_ACCESS_TOKEN = $AccessToken

# 3. Verifica que a função existe localmente
$repoRoot = Split-Path -Parent $PSScriptRoot
$functionDir = Join-Path $repoRoot "supabase\functions\$Function"
if (-not (Test-Path $functionDir)) {
    throw "Diretório da função não encontrado: $functionDir"
}

# 4. Deploy
Write-Host ""
Write-Host "=== Deploying $Function to project $ProjectRef ===" -ForegroundColor Cyan
Write-Host "  diretório: $functionDir"
Write-Host "  CLI: $cli"
Write-Host ""

& $cli functions deploy $Function --project-ref $ProjectRef --no-verify-jwt:$false
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host "DEPLOY FALHOU (exit $exitCode)" -ForegroundColor Red
    exit $exitCode
}

Write-Host ""
Write-Host "DEPLOY OK" -ForegroundColor Green
Write-Host ""
Write-Host "Verifica abrindo a app, atualizando ZAP e checando que" -ForegroundColor Yellow
Write-Host "a response tem o campo _debug.version no DevTools." -ForegroundColor Yellow
