# Status line "Deck" para o Claude Code (Windows cmd / PowerShell)
# Recebe o JSON da sessao pela entrada padrao e imprime 3 linhas.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$in = [Console]::In.ReadToEnd() | ConvertFrom-Json

$e = [char]27
$reset = "$e[0m"; $bold = "$e[1m"; $dim = "$e[2m"
$active = "$e[1;30;48;5;214m"   # fundo laranja, texto preto em negrito

# --- Modelo ativo ---
$modelId = "$($in.model.id) $($in.model.display_name)".ToLower()
$models = @(
  @{ name = 'haiku';  icon = [char]0x2727 },
  @{ name = 'sonnet'; icon = [char]0x2731 },
  @{ name = 'opus';   icon = [char]0x2726 }
)
$chips = foreach ($m in $models) {
  $label = "[$($m.icon) $($m.name)]"
  if ($modelId -like "*$($m.name)*") { "$active$label$reset" } else { "$dim$label$reset" }
}

# --- Nivel de esforco (JSON da sessao > settings.json > variavel de ambiente) ---
$effort = $null
if ($in.effort) { $effort = if ($in.effort.level) { $in.effort.level } else { $in.effort } }
if (-not $effort) {
  foreach ($f in @("$($in.workspace.project_dir)\.claude\settings.local.json",
                   "$($in.workspace.project_dir)\.claude\settings.json",
                   "$env:USERPROFILE\.claude\settings.json")) {
    if (Test-Path $f) {
      try {
        $s = Get-Content $f -Raw -Encoding UTF8 | ConvertFrom-Json
        # Nivel por modelo (modelSettings.<id>.effortLevel) tem prioridade sobre o global
        $porModelo = $null
        if ($s.modelSettings -and $in.model.id) { $porModelo = $s.modelSettings.($in.model.id).effortLevel }
        if ($porModelo) { $effort = $porModelo; break }
        if ($s.effortLevel) { $effort = $s.effortLevel; break }
      } catch {}
    }
  }
}
if (-not $effort -and $env:CLAUDE_CODE_EFFORT_LEVEL) { $effort = $env:CLAUDE_CODE_EFFORT_LEVEL }
if (-not $effort) { $effort = 'medium' }
$levels = @{ low = 1; medium = 2; high = 3; xhigh = 4; max = 5 }
$n = if ($levels.ContainsKey("$effort")) { $levels["$effort"] } else { 2 }
$bar = ([string][char]0x25AE * $n) + ([string][char]0x25AF * (5 - $n))

# --- Saida ---
$tri = [char]0x25BE
Write-Output "$bold$tri Deck$reset  Model  $($chips -join '  ')"
Write-Output "Effort $bar $bold$effort$reset"
Write-Output "${dim}No tasks running$reset"
