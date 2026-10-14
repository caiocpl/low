# Instala a status line "Deck" do Claude Code para o usuario atual.
# 1) Copia statusline.ps1 para %USERPROFILE%\.claude
# 2) Acrescenta o bloco "statusLine" em %USERPROFILE%\.claude\settings.json (com backup)
$ErrorActionPreference = 'Stop'
$origem   = Join-Path $PSScriptRoot 'statusline.ps1'
$pasta    = Join-Path $env:USERPROFILE '.claude'
$destino  = Join-Path $pasta 'statusline.ps1'
$settings = Join-Path $pasta 'settings.json'

if (-not (Test-Path $origem)) { Write-Host "ERRO: statusline.ps1 nao encontrado ao lado do instalador." -ForegroundColor Red; exit 1 }
if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Path $pasta | Out-Null }

Copy-Item $origem $destino -Force
Write-Host "[1/2] Script copiado para $destino" -ForegroundColor Green

# Caminho absoluto com barras normais: funciona tanto no cmd quanto no Git Bash
$caminho = $destino -replace '\\', '/'
$comando = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$caminho`""

if (Test-Path $settings) {
  $texto = [IO.File]::ReadAllText($settings)
  try { $cfg = if ($texto.Trim()) { $texto | ConvertFrom-Json } else { New-Object PSObject } }
  catch {
    Write-Host "ERRO: $settings nao e um JSON valido. Nada foi alterado." -ForegroundColor Red
    Write-Host "Adicione manualmente:  `"statusLine`": { `"type`": `"command`", `"command`": `"$($comando -replace '"','\"')`" }"
    exit 1
  }
  $backup = "$settings.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
  Copy-Item $settings $backup
  Write-Host "      Backup: $backup"
} else {
  $cfg = New-Object PSObject
}

$bloco = [ordered]@{ type = 'command'; command = $comando; padding = 0 }
$cfg | Add-Member -NotePropertyName statusLine -NotePropertyValue $bloco -Force

# Grava em UTF-8 sem BOM (o Claude Code nao aceita BOM no settings.json)
[IO.File]::WriteAllText($settings, ($cfg | ConvertTo-Json -Depth 50), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[2/2] statusLine configurada em $settings" -ForegroundColor Green
Write-Host ""
Write-Host "Pronto. Feche e abra o Claude Code no cmd para ver o painel Deck." -ForegroundColor Cyan
