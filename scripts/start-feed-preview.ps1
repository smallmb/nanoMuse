#requires -Version 7.0

# 先清理本项目上次启动的 Web Host，再打开项目首页供桌面端调试。
$ErrorActionPreference = 'Stop'
$desktopScript = Join-Path $PSScriptRoot 'dev-desktop.ps1'
$projectRoot = Split-Path -Parent $PSScriptRoot
$expectedElectron = Join-Path $projectRoot 'harness\desktop\node_modules\electron\dist\electron.exe'
$port = 38421

if (-not (Test-Path -LiteralPath $desktopScript)) {
    throw "找不到桌面开发启动脚本：$desktopScript"
}

# 仅确认监听程序由本项目的启动脚本创建后才结束，避免误杀其他本地服务。
$listenerIds = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
$verifiedProcesses = @()
foreach ($listenerId in $listenerIds) {
    $listenerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerId" -ErrorAction SilentlyContinue
    if (-not $listenerProcess) {
        throw "无法确认端口 $port 的监听进程归属；请检查该端口后重试。"
    }

    $isProjectElectron = $listenerProcess.ExecutablePath -and
        ([string]$listenerProcess.ExecutablePath).Equals($expectedElectron, [StringComparison]::OrdinalIgnoreCase)
    $hasProjectLauncherAncestor = $false
    $ancestorId = [uint32]$listenerProcess.ParentProcessId
    for ($depth = 0; $depth -lt 12 -and $ancestorId -ne 0; $depth++) {
        $ancestor = Get-CimInstance Win32_Process -Filter "ProcessId = $ancestorId" -ErrorAction SilentlyContinue
        if (-not $ancestor) { break }

        $isPowerShell = $ancestor.Name -match '^(pwsh|powershell)\.exe$'
        # DSH 的原启动命令可能以相对路径传入，因此同时用 Electron 的项目内绝对路径确认归属。
        $matchesProjectScript = $ancestor.CommandLine -match '(?i)(start-feed-preview|dev-desktop)\.ps1'
        if ($isPowerShell -and $matchesProjectScript) {
            $hasProjectLauncherAncestor = $true
            break
        }
        $ancestorId = [uint32]$ancestor.ParentProcessId
    }

    if (-not ($isProjectElectron -and $hasProjectLauncherAncestor)) {
        throw "端口 $port 正被其他程序占用（进程 $($listenerProcess.ProcessId)）；为避免误关程序，已停止启动。"
    }
    $verifiedProcesses += [uint32]$listenerProcess.ProcessId
}

foreach ($processId in $verifiedProcesses) {
    # 只结束已核验的本项目 Electron Host，不影响启动它的其他 PowerShell 或浏览器进程。
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

if ($verifiedProcesses.Count -gt 0) {
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 200
        $remainingListeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    } while ($remainingListeners.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline)

    if ($remainingListeners.Count -gt 0) {
        throw "旧 Web Host 未能及时关闭，端口 $port 仍在监听；请关闭旧启动窗口后重试。"
    }
    Write-Host '已关闭本项目之前启动的 Web Host。'
}

# 复用桌面开发启动流程，并由 DSH 在服务就绪后打开项目首页。
& $desktopScript -Web -OpenBrowser
