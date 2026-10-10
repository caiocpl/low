<#
.SYNOPSIS
    Limpeza segura e otimização de espaço do disco C: (Windows 10 e 11).

.DESCRIPTION
    Fase 1 - Diagnóstico ....... mede o que pode ser liberado com segurança.
    Fase 2 - Limpeza segura .... temporários, caches, restos de atualização, lixeira.
    Fase 3 - Otimizações ....... hibernação, Windows.old, pontos de restauração, CompactOS,
                                 Sensor de Armazenamento (cada uma explica o impacto e pede confirmação).
    Fase 4 - Mapa do disco ..... mostra o que ainda ocupa espaço para você decidir
                                 (pastas, arquivos grandes, programas instalados).

    O script NUNCA apaga: Documentos, Imagens, Vídeos, Músicas, Área de Trabalho, Downloads,
    OneDrive, programas instalados, senhas/favoritos/histórico de navegadores,
    C:\Windows\Installer nem arquivos de sistema "na mão".

    Um relatório completo é salvo na Área de Trabalho (Relatorio-Limpeza-C_<data>.txt).

.PARAMETER Simular
    Apenas diagnóstico e mapa do disco. Nada é apagado nem alterado.

.PARAMETER Automatico
    Executa toda a Fase 2 sem perguntar item a item. A Fase 3 continua pedindo confirmação.

.EXAMPLE
    .\Limpar-DiscoC.ps1 -Simular
#>
[CmdletBinding()]
param(
    [switch]$Simular,
    [switch]$Automatico
)

# =============================================================================
#  0. Preparação
# =============================================================================

if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host 'Este script requer o Windows PowerShell 5.1 ou superior (Windows 10/11).' -ForegroundColor Red
    Read-Host 'Pressione Enter para sair'
    exit 1
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Solicitando permissão de administrador...' -ForegroundColor Yellow
    $argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Simular)    { $argumentos += '-Simular' }
    if ($Automatico) { $argumentos += '-Automatico' }
    try {
        Start-Process -FilePath 'powershell.exe' -ArgumentList $argumentos -Verb RunAs -ErrorAction Stop
    } catch {
        Write-Host 'Permissão negada. A limpeza precisa rodar como administrador.' -ForegroundColor Red
        Read-Host 'Pressione Enter para sair'
    }
    exit
}

$ProgressPreference = 'SilentlyContinue'
try { $Host.UI.RawUI.WindowTitle = 'Limpeza do Disco C:' } catch { }

$L = $env:LOCALAPPDATA
$R = $env:APPDATA
$W = $env:SystemRoot

# Sem estas variáveis os caminhos ficariam relativos à raiz do disco: aborta por segurança.
foreach ($v in @($L, $R, $W, $env:TEMP, $env:USERPROFILE, $env:ProgramData)) {
    if ([string]::IsNullOrWhiteSpace($v)) {
        Write-Host 'Variáveis de ambiente do Windows ausentes. Nada foi alterado.' -ForegroundColor Red
        Read-Host 'Pressione Enter para sair'
        exit 1
    }
}

# Pastas que jamais podem ser esvaziadas, mesmo por engano de configuração.
$Protegidos = @('C:\', $W, "$W\System32", 'C:\Users', $env:USERPROFILE, $L, $R, $env:ProgramData,
                $env:ProgramFiles, ${env:ProgramFiles(x86)},
                [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('MyDocuments')) |
    Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\').ToLower() }

$AtributoLink  = 0x400                                # junções/links simbólicos: nunca são seguidos
$AtributosNuvem = 0x1000 -bor 0x40000 -bor 0x400000    # arquivos só na nuvem (OneDrive): não ocupam disco

$Itens      = New-Object System.Collections.Generic.List[object]
$Resultados = New-Object System.Collections.Generic.List[object]

$Desktop   = [Environment]::GetFolderPath('Desktop')
$Relatorio = Join-Path $Desktop ('Relatorio-Limpeza-C_{0}.txt' -f (Get-Date -Format 'yyyyMMdd_HHmm'))

# Itens da "Limpeza de Disco" do Windows (cleanmgr) considerados seguros.
# Ficam DE FORA de propósito:
#   DownloadsFolder ................ apagaria a sua pasta Downloads
#   User file versions ............. versões do Histórico de Arquivos (backup)
#   Windows ESD installation files . usados pela opção "Restaurar o PC"
#   Language Pack .................. pode remover idiomas/teclados
#   Recycle Bin e Previous Installations: tratados à parte, com confirmação
$HandlersSeguros = @(
    'Active Setup Temp Folders', 'BranchCache', 'D3D Shader Cache', 'Delivery Optimization Files',
    'Device Driver Packages', 'Diagnostic Data Viewer database files', 'Downloaded Program Files',
    'Feedback Hub Archive log files', 'Internet Cache Files', 'Old ChkDsk Files',
    'RetailDemo Offline Content', 'Setup Log Files', 'System error memory dump files',
    'System error minidump files', 'Temporary Files', 'Temporary Setup Files', 'Thumbnail Cache',
    'Update Cleanup', 'Upgrade Discarded Files', 'Windows Defender', 'Windows Error Reporting Files',
    'Windows Upgrade Log Files'
)

# =============================================================================
#  Funções utilitárias
# =============================================================================

function Format-Tamanho {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N0} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -gt 0)   { return ('{0:N0} KB' -f [math]::Max(1, $Bytes / 1KB)) }
    return '0'
}

function Get-EspacoLivre {
    return [double](New-Object System.IO.DriveInfo('C')).AvailableFreeSpace
}

function Write-Titulo {
    param([string]$Texto)
    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkCyan
    Write-Host "  $Texto" -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkCyan
}

function Write-Tabela {
    param([Parameter(ValueFromPipeline = $true)]$Entrada)
    begin   { $lista = New-Object System.Collections.Generic.List[object] }
    process { if ($null -ne $Entrada) { $lista.Add($Entrada) } }
    end {
        if ($lista.Count -eq 0) { Write-Host '    (nada encontrado)' -ForegroundColor DarkGray; return }
        $lista | Format-Table -AutoSize -Wrap | Out-String -Width 220 | Write-Host
    }
}

function Confirmar {
    param([string]$Pergunta)
    if ($Simular) { return $false }
    while ($true) {
        $resposta = "$(Read-Host "$Pergunta [S/N]")".Trim().ToUpper()
        if ($resposta -eq 'S') { return $true }
        if ($resposta -eq 'N') { return $false }
    }
}

function Add-Resultado {
    param([string]$Etapa, [string]$Status, [double]$Bytes = 0)
    $Resultados.Add([pscustomobject]@{ Etapa = $Etapa; Status = $Status; Bytes = $Bytes })
}

function Test-ReinicioPendente {
    return ((Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') -or
            (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'))
}

# Expande caminhos com curinga (*) e devolve apenas os que existem.
function Resolve-Caminhos {
    param([string[]]$Padroes)
    $saida = New-Object System.Collections.Generic.List[string]
    foreach ($p in $Padroes) {
        if ([string]::IsNullOrWhiteSpace($p)) { continue }
        if ($p.Contains('*')) {
            foreach ($r in @(Resolve-Path -Path $p -ErrorAction SilentlyContinue)) {
                if (-not $saida.Contains($r.ProviderPath)) { $saida.Add($r.ProviderPath) }
            }
        } elseif ((Test-Path -LiteralPath $p) -and -not $saida.Contains($p)) {
            $saida.Add($p)
        }
    }
    return $saida.ToArray()
}

# Tamanho real em disco de uma pasta (ou arquivo). Não segue junções e ignora
# arquivos do OneDrive que estão apenas na nuvem.
function Get-TamanhoPasta {
    param([string]$Caminho)
    if ([string]::IsNullOrWhiteSpace($Caminho) -or -not (Test-Path -LiteralPath $Caminho)) { return [double]0 }
    $item = Get-Item -LiteralPath $Caminho -Force -ErrorAction SilentlyContinue
    if ($item -is [System.IO.FileInfo]) { return [double]$item.Length }
    $total = [double]0
    $pilha = New-Object System.Collections.Stack
    $pilha.Push($Caminho)
    while ($pilha.Count -gt 0) {
        $atual = $pilha.Pop()
        try { $filhos = (New-Object System.IO.DirectoryInfo($atual)).GetFileSystemInfos() } catch { continue }
        foreach ($f in $filhos) {
            $attr = [int]$f.Attributes
            if ($attr -band $AtributoLink) { continue }
            if ($f -is [System.IO.DirectoryInfo]) { $pilha.Push($f.FullName) }
            elseif (-not ($attr -band $AtributosNuvem)) { $total += $f.Length }
        }
    }
    return $total
}

function Get-TamanhoTotal {
    param([string[]]$Padroes)
    $soma = [double]0
    foreach ($c in @(Resolve-Caminhos $Padroes)) { $soma += Get-TamanhoPasta $c }
    return $soma
}

function Remove-Arquivo {
    param([System.IO.FileInfo]$Arquivo)
    try {
        if ($Arquivo.IsReadOnly) { $Arquivo.IsReadOnly = $false }
        $Arquivo.Delete()
    } catch { }   # arquivo em uso: é ignorado
}

# Apaga o CONTEÚDO de uma pasta (a pasta em si é mantida) ou um arquivo isolado.
# - Nunca entra em junções/links (evita apagar o destino de um atalho de pasta).
# - Arquivos em uso são ignorados silenciosamente.
# - DiasMinimos > 0 preserva arquivos modificados recentemente.
function Remove-Conteudo {
    param([string]$Caminho, [int]$DiasMinimos = 0)
    if (-not (Test-Path -LiteralPath $Caminho)) { return }
    $raiz = Get-Item -LiteralPath $Caminho -Force -ErrorAction SilentlyContinue
    if ($null -eq $raiz) { return }
    if ($Protegidos -contains $raiz.FullName.TrimEnd('\').ToLower()) { return }
    $limite = (Get-Date).AddDays(-$DiasMinimos)

    if ($raiz -is [System.IO.FileInfo]) {
        if ($DiasMinimos -eq 0 -or $raiz.LastWriteTime -lt $limite) { Remove-Arquivo $raiz }
        return
    }
    if ([int]$raiz.Attributes -band $AtributoLink) { return }

    $pastas = New-Object System.Collections.Generic.List[System.IO.DirectoryInfo]
    $pilha  = New-Object System.Collections.Stack
    $pilha.Push($raiz)
    while ($pilha.Count -gt 0) {
        $atual = $pilha.Pop()
        try { $filhos = $atual.GetFileSystemInfos() } catch { continue }
        foreach ($f in $filhos) {
            if ($f -is [System.IO.DirectoryInfo]) {
                if ([int]$f.Attributes -band $AtributoLink) { continue }
                $pastas.Add($f)
                $pilha.Push($f)
            } elseif ($DiasMinimos -eq 0 -or $f.LastWriteTime -lt $limite) {
                Remove-Arquivo $f
            }
        }
    }
    # Subpastas vazias: das mais profundas para as mais rasas
    for ($i = $pastas.Count - 1; $i -ge 0; $i--) {
        try { $pastas[$i].Delete() } catch { }
    }
}

# Verifica se programas que usam o cache estão abertos. Retorna $true se pode prosseguir.
function Test-ProgramasFechados {
    param([string[]]$Nomes)
    $abertos = @(Get-Process -Name $Nomes -ErrorAction SilentlyContinue)
    if ($abertos.Count -eq 0) { return $true }
    $lista = ($abertos | Select-Object -ExpandProperty ProcessName -Unique) -join ', '
    Write-Host "    Programa(s) aberto(s): $lista" -ForegroundColor Yellow
    if (-not $Automatico -and (Confirmar '    Fechar agora para limpar o cache? (salve o que estiver fazendo)')) {
        $abertos | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
        return $true
    }
    return $false
}

# Executa uma etapa medindo o espaço realmente liberado no disco.
function Invoke-Etapa {
    param([string]$Nome, [scriptblock]$Bloco, [object]$Argumento = $null)
    Write-Host ''
    Write-Host "  > $Nome" -ForegroundColor White
    $antes  = Get-EspacoLivre
    $status = 'Concluído'
    try {
        $texto = @(& $Bloco $Argumento | Where-Object { $_ -is [string] })
        if ($texto.Count -gt 0) { $status = $texto[-1] }
    } catch {
        $status = 'Erro: ' + $_.Exception.Message
    }
    $liberado = [math]::Max([double]0, (Get-EspacoLivre) - $antes)
    Add-Resultado -Etapa $Nome -Status $status -Bytes $liberado
    $cor = 'Green'
    if ($status -ne 'Concluído') { $cor = 'Yellow' }
    Write-Host ('    {0} | liberado: {1}' -f $status, (Format-Tamanho $liberado)) -ForegroundColor $cor
}

function Invoke-LimpezaDeDisco {
    param([string[]]$Handlers)
    $base   = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches'
    $flag   = 'StateFlags0777'
    $chaves = @(Get-ChildItem -Path $base -ErrorAction SilentlyContinue)
    foreach ($c in $chaves) { Remove-ItemProperty -Path $c.PSPath -Name $flag -ErrorAction SilentlyContinue }
    foreach ($h in $Handlers) {
        $chave = Join-Path $base $h
        if (Test-Path -LiteralPath $chave) {
            New-ItemProperty -LiteralPath $chave -Name $flag -Value 2 -PropertyType DWord -Force | Out-Null
        }
    }
    Write-Host '    Executando a Limpeza de Disco do Windows (pode levar de 5 a 30 minutos)...' -ForegroundColor Gray
    Start-Process -FilePath "$W\System32\cleanmgr.exe" -ArgumentList '/sagerun:777' -Wait
    foreach ($c in $chaves) { Remove-ItemProperty -Path $c.PSPath -Name $flag -ErrorAction SilentlyContinue }
}

# hiberfil.sys e pagefile.sys ficam bloqueados pelo sistema: lê o tamanho pela listagem da raiz.
function Get-ArquivoRaiz {
    param([string]$Nome)
    try { return @((New-Object System.IO.DirectoryInfo('C:\')).GetFiles($Nome)) | Select-Object -First 1 } catch { return $null }
}

function Get-ArmazenamentoRestauracao {
    $volume = Get-CimInstance -ClassName Win32_Volume -Filter "DriveLetter='C:'" -ErrorAction SilentlyContinue
    $todos  = @(Get-CimInstance -ClassName Win32_ShadowStorage -ErrorAction SilentlyContinue)
    foreach ($s in $todos) {
        if ($volume -and $s.Volume.DeviceID -eq $volume.DeviceID) { return $s }
    }
    if ($todos.Count -eq 1) { return $todos[0] }
    return $null
}

function Add-ItemLimpeza {
    param(
        [string]$Nome,
        [string]$Descricao,
        [string[]]$Caminhos = @(),
        [int]$DiasMinimos = 0,
        [string[]]$Processos = @(),
        [scriptblock]$Acao = $null,
        [string]$TextoEstimativa = '',
        [switch]$DependeDeAtualizacao
    )
    $Itens.Add([pscustomobject]@{
        Nome                 = $Nome
        Descricao            = $Descricao
        Caminhos             = $Caminhos
        DiasMinimos          = $DiasMinimos
        Processos            = $Processos
        Acao                 = $Acao
        TextoEstimativa      = $TextoEstimativa
        DependeDeAtualizacao = [bool]$DependeDeAtualizacao
        Bytes                = [double]0
    })
}

function Invoke-ItemLimpeza {
    param($Item)
    if ($Item.Processos.Count -gt 0 -and -not (Test-ProgramasFechados $Item.Processos)) {
        return 'Ignorado: programa aberto (feche e rode de novo)'
    }
    if ($Item.Acao) {
        $null = & $Item.Acao
    } else {
        foreach ($p in @(Resolve-Caminhos $Item.Caminhos)) { Remove-Conteudo -Caminho $p -DiasMinimos $Item.DiasMinimos }
    }
    return 'Concluído'
}

function Get-CachesChromium {
    param([string]$UserData)
    $lista = @("$UserData\ShaderCache", "$UserData\GrShaderCache", "$UserData\GraphiteDawnCache")
    foreach ($s in @('Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache',
                     'Service Worker\CacheStorage', 'Service Worker\ScriptCache')) {
        $lista += "$UserData\*\$s"
    }
    return $lista
}

function Get-Sugestao {
    param([System.IO.FileInfo]$Arquivo)
    $dir = $Arquivo.DirectoryName
    if ($dir -like "$env:ProgramFiles*" -or $dir -like "${env:ProgramFiles(x86)}*" -or $dir -like "$env:ProgramData*") {
        return 'Parte de um programa: desinstale pelo Windows se não usar (não apague manualmente).'
    }
    switch -Regex ($Arquivo.Extension.ToLower()) {
        '^\.(vhdx|vhd|vmdk|vdi|avhdx)$' { return 'Disco virtual (WSL/Docker/VM): não apague; limpe pelo próprio programa.' }
        '^\.(pst|ost)$'                 { return 'Dados do Outlook: não apague; arquive pelo próprio Outlook.' }
        '^\.(iso|img)$'                 { return 'Imagem de disco: normalmente pode ser apagada depois de usada.' }
        '^\.(exe|msi|msix|appx)$'       { return 'Instalador: se o programa já está instalado, pode apagar.' }
        '^\.(zip|rar|7z|tar|gz)$'       { return 'Arquivo compactado: se já foi extraído, pode apagar.' }
        '^\.(mp4|mkv|mov|avi|wmv|m4v)$' { return 'Vídeo: mova para HD externo ou nuvem.' }
        '^\.(bak|tmp|old|dmp|log)$'     { return 'Backup/temporário/log: geralmente pode apagar.' }
    }
    return 'Avalie: se não precisa mais, mova para HD externo/nuvem ou apague.'
}

# Varre o C: uma única vez e agrupa o espaço por pasta principal, por pasta do
# usuário e por subpasta de AppData; também coleta arquivos grandes.
function Get-MapaDisco {
    param([double]$MinArquivo = 500MB)
    $perfil     = $env:USERPROFILE.TrimEnd('\')
    $appLocal   = Join-Path $perfil 'AppData\Local'
    $appRoaming = Join-Path $perfil 'AppData\Roaming'
    $windir     = $W.TrimEnd('\')
    $topo       = @{}
    $usuario    = @{}
    $appData    = @{}
    $grandes    = New-Object System.Collections.Generic.List[System.IO.FileInfo]

    $pilha = New-Object System.Collections.Stack
    $pilha.Push(@('C:\', '(raiz) pagefile/hiberfil/swapfile', '', ''))
    while ($pilha.Count -gt 0) {
        $no = $pilha.Pop()
        $caminho = $no[0]; $rTopo = $no[1]; $rUsuario = $no[2]; $rApp = $no[3]
        try { $filhos = (New-Object System.IO.DirectoryInfo($caminho)).GetFileSystemInfos() } catch { continue }
        $soma = [double]0
        foreach ($f in $filhos) {
            $attr = [int]$f.Attributes
            if ($attr -band $AtributoLink) { continue }
            if ($f -is [System.IO.DirectoryInfo]) {
                $t = $rTopo; $u = $rUsuario; $a = $rApp
                if ($caminho -eq 'C:\')         { $t = $f.Name }
                if ($caminho -eq $perfil)       { $u = $f.Name }
                if ($caminho -eq $appLocal)     { $a = 'Local\' + $f.Name }
                elseif ($caminho -eq $appRoaming) { $a = 'Roaming\' + $f.Name }
                $pilha.Push(@($f.FullName, $t, $u, $a))
            } elseif (-not ($attr -band $AtributosNuvem)) {
                $soma += $f.Length
                if ($f.Length -ge $MinArquivo -and $caminho -ne 'C:\' -and
                    -not $caminho.StartsWith($windir, [StringComparison]::OrdinalIgnoreCase)) {
                    $grandes.Add($f)
                }
            }
        }
        if ($soma -gt 0) {
            $topo[$rTopo] = [double]$topo[$rTopo] + $soma
            if ($rUsuario) { $usuario[$rUsuario] = [double]$usuario[$rUsuario] + $soma }
            if ($rApp)     { $appData[$rApp]     = [double]$appData[$rApp] + $soma }
        }
    }
    return [pscustomobject]@{ Topo = $topo; Usuario = $usuario; AppData = $appData; Grandes = $grandes }
}

function ConvertTo-Ranking {
    param([hashtable]$Tabela, [int]$Top = 10, [string]$Rotulo = 'Pasta')
    $Tabela.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First $Top |
        ForEach-Object { [pscustomobject]@{ Tamanho = Format-Tamanho $_.Value; $Rotulo = $_.Key } }
}

function Get-ProgramasInstalados {
    param([int]$Top = 25)
    $chaves = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $vistos = @{}
    Get-ItemProperty -Path $chaves -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -and $_.EstimatedSize -and -not $_.SystemComponent -and -not $_.ParentKeyName } |
        Select-Object DisplayName, InstallDate, @{ n = 'Bytes'; e = { [double]$_.EstimatedSize * 1KB } } |
        Sort-Object -Property Bytes -Descending |
        Where-Object { if ($vistos.ContainsKey($_.DisplayName)) { $false } else { $vistos[$_.DisplayName] = $true; $true } } |
        Select-Object -First $Top |
        ForEach-Object {
            $data = ''
            if ("$($_.InstallDate)" -match '^(\d{4})(\d{2})(\d{2})$') { $data = '{0}/{1}/{2}' -f $Matches[3], $Matches[2], $Matches[1] }
            [pscustomobject]@{ Tamanho = Format-Tamanho $_.Bytes; Instalado = $data; Programa = $_.DisplayName }
        }
}

# =============================================================================
#  Catálogo da limpeza segura (Fase 2)
# =============================================================================

$dirDO = "$W\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache"

Add-ItemLimpeza -Nome 'Arquivos temporários do usuário' -Descricao 'Pasta TEMP (preserva arquivos das últimas 24 h)' `
    -Caminhos @($env:TEMP) -DiasMinimos 1

Add-ItemLimpeza -Nome 'Arquivos temporários do Windows' -Descricao 'C:\Windows\Temp (preserva últimas 24 h)' `
    -Caminhos @("$W\Temp") -DiasMinimos 1

Add-ItemLimpeza -Nome 'Cache do Windows Update' -Descricao 'Atualizações já baixadas/instaladas' `
    -Caminhos @("$W\SoftwareDistribution\Download") -DependeDeAtualizacao -Acao {
        $servicos = @(Get-Service -Name 'wuauserv', 'bits' -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' })
        Get-Service -Name 'wuauserv', 'bits' -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Remove-Conteudo -Caminho "$W\SoftwareDistribution\Download"
        foreach ($s in $servicos) { Start-Service -Name $s.Name -ErrorAction SilentlyContinue }
    }

Add-ItemLimpeza -Nome 'Cache da Otimização de Entrega' -Descricao 'Cópias de atualizações compartilhadas' `
    -Caminhos @($dirDO) -Acao {
        if (Get-Command -Name 'Delete-DeliveryOptimizationCache' -ErrorAction SilentlyContinue) {
            Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue | Out-Null
        } else {
            Remove-Conteudo -Caminho $dirDO
        }
    }

Add-ItemLimpeza -Nome 'Despejos de memória e relatórios de erro' -Descricao 'Arquivos .dmp e relatórios de falhas antigas' `
    -Caminhos @("$L\CrashDumps", "$W\Minidump", "$W\MEMORY.DMP", "$W\LiveKernelReports",
                "$env:ProgramData\Microsoft\Windows\WER\ReportArchive", "$env:ProgramData\Microsoft\Windows\WER\ReportQueue",
                "$env:ProgramData\Microsoft\Windows\WER\Temp", "$L\Microsoft\Windows\WER\ReportArchive",
                "$L\Microsoft\Windows\WER\ReportQueue")

Add-ItemLimpeza -Nome 'Logs antigos de manutenção do Windows' -Descricao 'CbsPersist (logs que podem acumular GBs)' `
    -Caminhos @("$W\Logs\CBS\CbsPersist*")

Add-ItemLimpeza -Nome 'Cache de shaders da placa de vídeo' -Descricao 'NVIDIA/AMD/DirectX (recriado automaticamente)' `
    -Caminhos @("$L\D3DSCache", "$L\NVIDIA\DXCache", "$L\NVIDIA\GLCache", "$L\AMD\DxCache", "$L\AMD\DxcCache",
                "$L\AMD\GLCache", "$L\AMD\VkCache", "$L\Intel\ShaderCache")

Add-ItemLimpeza -Nome 'Instaladores de driver já extraídos' -Descricao 'C:\AMD, C:\NVIDIA e downloads do GeForce' `
    -Caminhos @('C:\AMD', 'C:\NVIDIA', "$env:ProgramData\NVIDIA Corporation\Downloader")

Add-ItemLimpeza -Nome 'Cache do Google Chrome' -Descricao 'Somente cache (mantém senhas, favoritos e histórico)' `
    -Caminhos (Get-CachesChromium "$L\Google\Chrome\User Data") -Processos @('chrome')

Add-ItemLimpeza -Nome 'Cache do Microsoft Edge' -Descricao 'Somente cache (mantém senhas, favoritos e histórico)' `
    -Caminhos (Get-CachesChromium "$L\Microsoft\Edge\User Data") -Processos @('msedge')

Add-ItemLimpeza -Nome 'Cache do Brave' -Descricao 'Somente cache (mantém senhas, favoritos e histórico)' `
    -Caminhos (Get-CachesChromium "$L\BraveSoftware\Brave-Browser\User Data") -Processos @('brave')

Add-ItemLimpeza -Nome 'Cache do Opera' -Descricao 'Somente cache (mantém senhas, favoritos e histórico)' `
    -Caminhos @("$L\Opera Software\*\Cache", "$R\Opera Software\*\Code Cache", "$R\Opera Software\*\GPUCache") -Processos @('opera')

Add-ItemLimpeza -Nome 'Cache do Firefox' -Descricao 'Somente cache (mantém senhas, favoritos e histórico)' `
    -Caminhos @("$L\Mozilla\Firefox\Profiles\*\cache2", "$L\Mozilla\Firefox\Profiles\*\startupCache",
                "$L\Mozilla\Firefox\Profiles\*\thumbnails") -Processos @('firefox')

Add-ItemLimpeza -Nome 'Cache do Discord' -Descricao 'Imagens/vídeos em cache (mantém login e conversas)' `
    -Caminhos @("$R\discord\Cache", "$R\discord\Code Cache", "$R\discord\GPUCache") -Processos @('Discord')

Add-ItemLimpeza -Nome 'Cache do Microsoft Teams (clássico)' -Descricao 'Cache local (mantém login e conversas)' `
    -Caminhos @("$R\Microsoft\Teams\Cache", "$R\Microsoft\Teams\Code Cache", "$R\Microsoft\Teams\GPUCache",
                "$R\Microsoft\Teams\Service Worker\CacheStorage", "$R\Microsoft\Teams\tmp") -Processos @('Teams')

Add-ItemLimpeza -Nome 'Cache do Slack' -Descricao 'Cache local (mantém login e conversas)' `
    -Caminhos @("$R\Slack\Cache", "$R\Slack\Code Cache", "$R\Slack\GPUCache", "$R\Slack\Service Worker\CacheStorage") `
    -Processos @('slack')

Add-ItemLimpeza -Nome 'Cache do VS Code' -Descricao 'Cache do editor (mantém extensões e configurações)' `
    -Caminhos @("$R\Code\Cache", "$R\Code\CachedData", "$R\Code\Code Cache", "$R\Code\GPUCache",
                "$R\Code\CachedExtensionVSIXs") -Processos @('Code')

Add-ItemLimpeza -Nome 'Lixeira' -Descricao 'Itens que você já excluiu' `
    -Caminhos @('C:\$Recycle.Bin') -Acao { Clear-RecycleBin -DriveLetter C -Force -ErrorAction SilentlyContinue }

Add-ItemLimpeza -Nome 'Limpeza de Disco do Windows' -Descricao 'Restos de atualização, miniaturas, logs, drivers antigos' `
    -TextoEstimativa 'medido ao executar' -Acao {
        $handlers = $HandlersSeguros
        if ($ReinicioPendente) { $handlers = @($handlers | Where-Object { $_ -ne 'Update Cleanup' }) }
        Invoke-LimpezaDeDisco -Handlers $handlers
    }

Add-ItemLimpeza -Nome 'Componentes antigos do Windows (WinSxS)' -Descricao 'Versões substituídas de atualizações (DISM)' `
    -TextoEstimativa 'medido ao executar' -DependeDeAtualizacao -Acao {
        & "$W\System32\Dism.exe" /Online /Cleanup-Image /StartComponentCleanup | Out-Host
    }

# =============================================================================
#  Execução
# =============================================================================

try { Start-Transcript -Path $Relatorio -Force | Out-Null } catch { }

try {
    $LivreInicial = Get-EspacoLivre
    $Disco        = New-Object System.IO.DriveInfo('C')
    $TotalDisco   = [double]$Disco.TotalSize
    $ReinicioPendente = Test-ReinicioPendente

    Write-Titulo 'LIMPEZA E OTIMIZAÇÃO DO DISCO C:'
    if ($Simular) { Write-Host '  MODO SIMULAÇÃO: nada será apagado ou alterado.' -ForegroundColor Magenta }
    Write-Host ('  Capacidade: {0}   |   Em uso: {1}   |   Livre: {2} ({3:N0}%)' -f
        (Format-Tamanho $TotalDisco), (Format-Tamanho ($TotalDisco - $LivreInicial)),
        (Format-Tamanho $LivreInicial), ($LivreInicial / $TotalDisco * 100))
    Write-Host ''
    Write-Host '  Antes de continuar: salve seus trabalhos e feche navegadores e programas.' -ForegroundColor Yellow
    Write-Host '  Nada pessoal (documentos, fotos, Downloads, Área de Trabalho) será apagado.' -ForegroundColor Yellow

    if ($ReinicioPendente) {
        Write-Host ''
        Write-Host '  ATENÇÃO: há uma atualização do Windows aguardando reinicialização.' -ForegroundColor Red
        Write-Host '  Os itens ligados a atualizações serão pulados. Para o melhor resultado,' -ForegroundColor Red
        Write-Host '  reinicie o computador e execute este script novamente.' -ForegroundColor Red
    }

    # -------------------------------------------------------------------------
    Write-Titulo 'FASE 1 - DIAGNOSTICO (o que pode ser liberado com segurança)'
    Write-Host '  Medindo... (até 1 minuto)' -ForegroundColor Gray
    foreach ($it in $Itens) {
        if ($it.Caminhos.Count -gt 0) { $it.Bytes = Get-TamanhoTotal $it.Caminhos }
    }
    $Visiveis = @($Itens | Where-Object { $_.Bytes -ge 1MB -or $_.TextoEstimativa })

    $n = 0
    $Visiveis | ForEach-Object {
        $n++
        $est = $_.TextoEstimativa
        if ($_.Bytes -gt 0) { $est = Format-Tamanho $_.Bytes }
        [pscustomobject]@{ '#' = $n; Item = $_.Nome; Estimativa = $est; 'O que remove' = $_.Descricao }
    } | Write-Tabela

    $somaEstimada = ($Visiveis | Measure-Object -Property Bytes -Sum).Sum
    Write-Host ('  Total mensurável: {0} (+ o que a Limpeza de Disco e o DISM liberarem)' -f (Format-Tamanho $somaEstimada)) -ForegroundColor Cyan

    $hiber      = Get-ArquivoRaiz 'hiberfil.sys'
    $pagefile   = Get-ArquivoRaiz 'pagefile.sys'
    $winOld     = Get-TamanhoTotal @('C:\Windows.old', 'C:\$Windows.~BT', 'C:\$Windows.~WS')
    $sombra     = Get-ArmazenamentoRestauracao
    $limiteRest = [math]::Round($TotalDisco * 0.05)

    Write-Host ''
    Write-Host '  Itens de sistema (decididos na Fase 3, com sua confirmação):' -ForegroundColor White
    $hiberTxt = 'desativado'
    if ($hiber) { $hiberTxt = Format-Tamanho $hiber.Length }
    $restTxt = 'desativada ou sem pontos'
    if ($sombra) { $restTxt = '{0} em uso (limite atual: {1})' -f (Format-Tamanho $sombra.UsedSpace), (Format-Tamanho ([math]::Min([double]$sombra.MaxSpace, $TotalDisco))) }
    $pageTxt = 'não encontrado'
    if ($pagefile) { $pageTxt = (Format-Tamanho $pagefile.Length) + ' (não será alterado: necessário para a estabilidade)' }
    $winOldTxt = 'não existe'
    if ($winOld -gt 0) { $winOldTxt = Format-Tamanho $winOld }
    Write-Host "    - Arquivo de hibernação (hiberfil.sys) ..... $hiberTxt"
    Write-Host "    - Windows anterior (Windows.old) ........... $winOldTxt"
    Write-Host "    - Pontos de restauração .................... $restTxt"
    Write-Host "    - Memória virtual (pagefile.sys) ........... $pageTxt"

    # -------------------------------------------------------------------------
    Write-Titulo 'FASE 2 - LIMPEZA SEGURA'
    if ($Simular) {
        Write-Host '  Modo simulação: nenhuma limpeza executada.' -ForegroundColor Magenta
    } else {
        $todos = $Automatico
        if (-not $todos) {
            Write-Host '  Responda S para limpar todos os itens da tabela acima de uma vez,'
            Write-Host '  ou N para escolher item por item.'
            $todos = Confirmar '  Executar TODOS os itens da limpeza segura?'
        }
        foreach ($it in $Visiveis) {
            if ($it.DependeDeAtualizacao -and $ReinicioPendente) {
                Add-Resultado -Etapa $it.Nome -Status 'Pulado: reinicialização pendente'
                continue
            }
            if (-not $todos -and -not (Confirmar "  Limpar '$($it.Nome)'?")) {
                Add-Resultado -Etapa $it.Nome -Status 'Pulado por escolha'
                continue
            }
            Invoke-Etapa -Nome $it.Nome -Argumento $it -Bloco { param($x) Invoke-ItemLimpeza $x }
        }
    }

    # -------------------------------------------------------------------------
    Write-Titulo 'FASE 3 - OTIMIZAÇÕES OPCIONAIS (cada uma pede confirmação)'
    if ($Simular) {
        Write-Host '  Modo simulação: nenhuma alteração executada.' -ForegroundColor Magenta
    } else {

        # 3.1 Hibernação
        $hiber = Get-ArquivoRaiz 'hiberfil.sys'
        if ($hiber) {
            $notebook = $null -ne (Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue)
            Write-Host ''
            Write-Host ('  [Hibernação] O arquivo hiberfil.sys ocupa {0}.' -f (Format-Tamanho $hiber.Length)) -ForegroundColor White
            Write-Host '    1 = Desativar  -> libera tudo; desliga também a "Inicialização Rápida" (boot alguns segundos mais lento).'
            Write-Host '    2 = Reduzir    -> libera cerca de metade; mantém a Inicialização Rápida; remove a opção "Hibernar".'
            Write-Host '    3 = Manter como está.'
            if ($notebook) { Write-Host '    Recomendado para notebook: 2' -ForegroundColor Cyan }
            else           { Write-Host '    Recomendado para desktop: 1' -ForegroundColor Cyan }
            Write-Host '    (Reversível a qualquer momento com: powercfg /hibernate on)' -ForegroundColor DarkGray
            do { $op = "$(Read-Host '    Escolha 1, 2 ou 3')".Trim() } while ($op -notin @('1', '2', '3'))
            switch ($op) {
                '1' { Invoke-Etapa -Nome 'Hibernação desativada' -Bloco { & "$W\System32\powercfg.exe" /hibernate off | Out-Host } }
                '2' { Invoke-Etapa -Nome 'Hibernação reduzida' -Bloco { & "$W\System32\powercfg.exe" /hibernate /type reduced | Out-Host } }
                default { Add-Resultado -Etapa 'Hibernação' -Status 'Mantida' }
            }
        }

        # 3.2 Windows.old
        $winOld = Get-TamanhoTotal @('C:\Windows.old', 'C:\$Windows.~BT', 'C:\$Windows.~WS')
        if ($winOld -gt 0) {
            Write-Host ''
            Write-Host ('  [Windows anterior] Windows.old e restos de upgrade ocupam cerca de {0}.' -f (Format-Tamanho $winOld)) -ForegroundColor White
            Write-Host '    Contrapartida: não será mais possível "voltar para a versão anterior" do Windows.'
            if (Confirmar '    Remover a instalação anterior do Windows?') {
                Invoke-Etapa -Nome 'Windows anterior (Windows.old)' -Bloco {
                    Invoke-LimpezaDeDisco -Handlers @('Previous Installations', 'Temporary Setup Files', 'Windows Upgrade Log Files', 'Upgrade Discarded Files')
                }
            } else { Add-Resultado -Etapa 'Windows anterior (Windows.old)' -Status 'Mantido' }
        }

        # 3.3 Pontos de restauração
        $sombra = Get-ArmazenamentoRestauracao
        if ($sombra -and [math]::Min([double]$sombra.MaxSpace, $TotalDisco) -gt ($limiteRest * 1.05)) {
            $ganho = [math]::Max([double]0, [double]$sombra.UsedSpace - $limiteRest)
            Write-Host ''
            Write-Host ('  [Pontos de restauração] Em uso: {0}. Proposta: limitar a 5% do disco ({1}).' -f
                (Format-Tamanho $sombra.UsedSpace), (Format-Tamanho $limiteRest)) -ForegroundColor White
            Write-Host ('    Ganho imediato estimado: {0}. Os pontos mais recentes são mantidos; os mais antigos saem.' -f (Format-Tamanho $ganho))
            if (Confirmar '    Limitar o espaço da Restauração do Sistema a 5%?') {
                Invoke-Etapa -Nome 'Restauração do Sistema limitada a 5%' -Bloco {
                    & "$W\System32\vssadmin.exe" resize shadowstorage /for=C: /on=C: /maxsize=5% | Out-Host
                }
            } else { Add-Resultado -Etapa 'Restauração do Sistema' -Status 'Mantida' }
        }

        # 3.4 Base de componentes definitiva
        if (-not $ReinicioPendente) {
            Write-Host ''
            Write-Host '  [Base de componentes] Consolida definitivamente as atualizações já instaladas (DISM /ResetBase).' -ForegroundColor White
            Write-Host '    Contrapartida: as atualizações instaladas até hoje não poderão mais ser desinstaladas.'
            Write-Host '    Pode levar de 10 a 30 minutos.'
            if (Confirmar '    Executar a consolidação (/ResetBase)?') {
                Invoke-Etapa -Nome 'Base de componentes consolidada (ResetBase)' -Bloco {
                    & "$W\System32\Dism.exe" /Online /Cleanup-Image /StartComponentCleanup /ResetBase | Out-Host
                }
            } else { Add-Resultado -Etapa 'Consolidação da base (ResetBase)' -Status 'Não executada' }
        }

        # 3.5 CompactOS
        Write-Host ''
        Write-Host '  [Compactar o Windows] Recurso oficial (CompactOS) para discos pequenos: comprime os' -ForegroundColor White
        Write-Host '    arquivos do sistema e costuma liberar de 2 a 4 GB. Impacto de desempenho mínimo em SSD.'
        Write-Host '    Leva de 10 a 20 minutos. Reversível com: compact /CompactOS:never'
        if (Confirmar '    Ativar a compactação do Windows?') {
            Invoke-Etapa -Nome 'Compactação do Windows (CompactOS)' -Bloco { & "$W\System32\compact.exe" /CompactOS:always | Out-Host }
        } else { Add-Resultado -Etapa 'Compactação do Windows (CompactOS)' -Status 'Não executada' }

        # 3.6 Sensor de Armazenamento
        Write-Host ''
        Write-Host '  [Manutenção automática] Ativar o Sensor de Armazenamento do Windows:' -ForegroundColor White
        Write-Host '    roda semanalmente, apaga temporários e itens com mais de 30 dias na Lixeira.'
        Write-Host '    A pasta Downloads NÃO é tocada.'
        if (Confirmar '    Ativar o Sensor de Armazenamento?') {
            $sp = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy'
            if (-not (Test-Path -LiteralPath $sp)) { New-Item -Path $sp -Force | Out-Null }
            $valores = [ordered]@{ '01' = 1; '04' = 1; '08' = 1; '256' = 30; '32' = 0; '2048' = 7 }
            foreach ($k in $valores.Keys) {
                New-ItemProperty -LiteralPath $sp -Name $k -Value $valores[$k] -PropertyType DWord -Force | Out-Null
            }
            Add-Resultado -Etapa 'Sensor de Armazenamento' -Status 'Ativado (semanal)'
            Write-Host '    Ativado.' -ForegroundColor Green
        } else { Add-Resultado -Etapa 'Sensor de Armazenamento' -Status 'Não ativado' }
    }

    # -------------------------------------------------------------------------
    Write-Titulo 'FASE 4 - MAPA DO DISCO (para você decidir o que mais remover)'
    Write-Host '  Analisando todo o disco C: ... (1 a 5 minutos)' -ForegroundColor Gray
    $mapa = Get-MapaDisco -MinArquivo 500MB

    Write-Host ''
    Write-Host '  4.1 Onde está o espaço no C: (Windows inclui links de sistema: valor aproximado)' -ForegroundColor White
    ConvertTo-Ranking -Tabela $mapa.Topo -Top 12 | Write-Tabela

    Write-Host "  4.2 Sua pasta de usuário ($env:USERPROFILE)" -ForegroundColor White
    ConvertTo-Ranking -Tabela $mapa.Usuario -Top 15 | Write-Tabela

    Write-Host '  4.3 Dados de programas em AppData (maiores)' -ForegroundColor White
    ConvertTo-Ranking -Tabela $mapa.AppData -Top 15 | Write-Tabela

    Write-Host '  4.4 Arquivos grandes (500 MB ou mais) fora da pasta do Windows' -ForegroundColor White
    $grandes = @($mapa.Grandes | Sort-Object -Property Length -Descending | Select-Object -First 30)
    if ($grandes.Count -eq 0) {
        Write-Host '    (nenhum)' -ForegroundColor DarkGray
    } else {
        foreach ($g in $grandes) {
            Write-Host ('    {0,10}  {1:dd/MM/yyyy}  {2}' -f (Format-Tamanho $g.Length), $g.LastWriteTime, $g.FullName)
            Write-Host ('                -> {0}' -f (Get-Sugestao $g)) -ForegroundColor DarkYellow
        }
    }

    Write-Host ''
    Write-Host '  4.5 Instaladores e compactados esquecidos na pasta Downloads' -ForegroundColor White
    $pastaDownloads = $null
    try { $pastaDownloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path } catch { }
    if (-not $pastaDownloads) { $pastaDownloads = Join-Path $env:USERPROFILE 'Downloads' }
    $instaladores = @(Get-ChildItem -LiteralPath $pastaDownloads -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(exe|msi|msix|iso|img|zip|rar|7z)$' })
    if ($instaladores.Count -gt 0) {
        $somaInst = ($instaladores | Measure-Object -Property Length -Sum).Sum
        Write-Host ('    {0} arquivo(s) somando {1} em {2}' -f $instaladores.Count, (Format-Tamanho $somaInst), $pastaDownloads)
        Write-Host '    Se os programas já foram instalados/extraídos, esses arquivos podem ser apagados.' -ForegroundColor DarkYellow
        $instaladores | Sort-Object -Property Length -Descending | Select-Object -First 10 | ForEach-Object {
            [pscustomobject]@{ Tamanho = Format-Tamanho $_.Length; Data = $_.LastWriteTime.ToString('dd/MM/yyyy'); Arquivo = $_.Name }
        } | Write-Tabela
    } else {
        Write-Host '    (nenhum)' -ForegroundColor DarkGray
    }

    Write-Host '  4.6 Programas instalados por tamanho (desinstale os que não usa)' -ForegroundColor White
    Get-ProgramasInstalados -Top 25 | Write-Tabela

    Write-Host '  4.7 Consumidores conhecidos de espaço encontrados neste PC' -ForegroundColor White
    $conhecidos = @(
        @{ Nome = 'Backups de iPhone/iPad';         Caminhos = @("$R\Apple Computer\MobileSync\Backup", "$env:USERPROFILE\Apple\MobileSync\Backup"); Dica = 'Apague backups antigos no iTunes / app Dispositivos Apple.' }
        @{ Nome = 'WhatsApp Desktop (mídias)';      Caminhos = @("$L\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm\LocalState"); Dica = 'No WhatsApp: Configurações > Armazenamento > apague mídias grandes.' }
        @{ Nome = 'Microsoft Teams (novo)';         Caminhos = @("$L\Packages\MSTeams_8wekyb3d8bbwe\LocalCache"); Dica = 'Configurações > Aplicativos > Teams > Opções avançadas > Redefinir.' }
        @{ Nome = 'Spotify (músicas em cache)';     Caminhos = @("$L\Spotify\Data", "$L\Packages\SpotifyAB.SpotifyMusic_zpdnekdrzrea0\LocalCache\Spotify\Data"); Dica = 'No Spotify: Configurações > Armazenamento > Limpar cache.' }
        @{ Nome = 'Jogos da Steam';                 Caminhos = @("${env:ProgramFiles(x86)}\Steam\steamapps"); Dica = 'Desinstale jogos parados pela Biblioteca da Steam ou mova-os para outro disco.' }
        @{ Nome = 'Docker Desktop';                 Caminhos = @("$L\Docker"); Dica = 'Rode "docker system prune -a" e use Troubleshoot > Clean/Purge data.' }
        @{ Nome = 'WSL (Linux no Windows)';         Caminhos = @("$L\Packages\CanonicalGroupLimited*\LocalState", "$L\wsl"); Dica = 'Remova distros sem uso: wsl --unregister <nome> (apaga os dados dela).' }
        @{ Nome = 'Android Studio (emuladores/SDK)'; Caminhos = @("$env:USERPROFILE\.android\avd", "$L\Android\Sdk"); Dica = 'Apague emuladores sem uso no Device Manager do Android Studio.' }
        @{ Nome = 'Cache npm / Yarn';               Caminhos = @("$L\npm-cache", "$L\Yarn\Cache"); Dica = 'Rode "npm cache clean --force" e "yarn cache clean".' }
        @{ Nome = 'Cache pip (Python)';             Caminhos = @("$L\pip\cache"); Dica = 'Rode "pip cache purge".' }
        @{ Nome = 'Pacotes NuGet / Gradle / Maven'; Caminhos = @("$env:USERPROFILE\.nuget\packages", "$env:USERPROFILE\.gradle\caches", "$env:USERPROFILE\.m2\repository"); Dica = 'Caches de desenvolvimento: podem ser apagados e serão baixados de novo se preciso.' }
        @{ Nome = 'Adobe (cache de mídia)';         Caminhos = @("$R\Adobe\Common\Media Cache Files", "$R\Adobe\Common\Media Cache"); Dica = 'Premiere/After Effects: Preferências > Cache de mídia > Excluir.' }
        @{ Nome = 'OneDrive (arquivos guardados no PC)'; Caminhos = @($env:OneDrive); Dica = 'Botão direito na pasta OneDrive > "Liberar espaço" (ficam só na nuvem).' }
        @{ Nome = 'Gravações do Zoom';              Caminhos = @("$env:USERPROFILE\Documents\Zoom"); Dica = 'Mova gravações antigas para a nuvem ou HD externo.' }
    )
    $conhecidos | ForEach-Object {
        $bytes = Get-TamanhoTotal $_.Caminhos
        if ($bytes -ge 300MB) { [pscustomobject]@{ Tamanho = Format-Tamanho $bytes; Item = $_.Nome; 'Como liberar' = $_.Dica } }
    } | Write-Tabela

    # -------------------------------------------------------------------------
    Write-Titulo 'RESUMO'
    $LivreFinal = Get-EspacoLivre
    $Ganho      = [math]::Max([double]0, $LivreFinal - $LivreInicial)
    Write-Host ('  Espaço livre antes ..... {0}' -f (Format-Tamanho $LivreInicial))
    Write-Host ('  Espaço livre agora ..... {0} ({1:N0}% do disco)' -f (Format-Tamanho $LivreFinal), ($LivreFinal / $TotalDisco * 100))
    Write-Host ('  Total liberado ......... {0}' -f (Format-Tamanho $Ganho)) -ForegroundColor Green

    if ($Resultados.Count -gt 0) {
        $Resultados | ForEach-Object {
            [pscustomobject]@{ Etapa = $_.Etapa; Status = $_.Status; Liberado = Format-Tamanho $_.Bytes }
        } | Write-Tabela
    }

    $meta = [math]::Max([double]20GB, $TotalDisco * 0.15)
    Write-Host ''
    if ($LivreFinal -lt $meta) {
        Write-Host ('  Meta recomendada: pelo menos {0} livres. Faltam {1}.' -f (Format-Tamanho $meta), (Format-Tamanho ($meta - $LivreFinal))) -ForegroundColor Yellow
        Write-Host '  Use o mapa da Fase 4 para decidir o restante:' -ForegroundColor Yellow
    } else {
        Write-Host ('  Meta atingida: pelo menos {0} livres.' -f (Format-Tamanho $meta)) -ForegroundColor Green
    }
    Write-Host '    1. Desinstale programas que não usa: Configurações > Aplicativos > Aplicativos instalados'
    Write-Host '       (ordene por "Tamanho"). Veja a lista 4.6.'
    Write-Host '    2. Revise os arquivos grandes (4.4) e os instaladores na pasta Downloads (4.5).'
    Write-Host '    3. Mova fotos e vídeos para HD externo/nuvem; no OneDrive use "Liberar espaço".'
    Write-Host '    4. Reinicie o computador para concluir a limpeza de atualizações.'
    if ($ReinicioPendente) {
        Write-Host '    5. Depois de reiniciar, execute este script de novo (itens de atualização foram pulados).' -ForegroundColor Yellow
    }
    Write-Host ''
    Write-Host "  Relatório completo salvo em: $Relatorio" -ForegroundColor Cyan
}
catch {
    Write-Host ''
    Write-Host ('  Erro inesperado: {0}' -f $_.Exception.Message) -ForegroundColor Red
    Write-Host '  Nenhum arquivo pessoal foi afetado. Envie o relatório da Área de Trabalho para análise.' -ForegroundColor Red
}
finally {
    try { Stop-Transcript | Out-Null } catch { }
    Write-Host ''
    Read-Host 'Pressione Enter para fechar'
}
