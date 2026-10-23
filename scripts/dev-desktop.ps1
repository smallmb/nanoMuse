#requires -Version 7.0
param(
    [switch]$Debug,
    [switch]$Web,
    [switch]$OpenBrowser
)

# 从脚本位置定位源码，启动不依赖调用者当前目录。
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pluginDirectory = Join-Path $projectRoot 'harness\dsh-nanomuse'
$desktopDirectory = Join-Path $projectRoot 'harness\desktop'
$installedPlugin = Join-Path $desktopDirectory 'dsh\node_modules\dsh-nanomuse'
$electron = Join-Path $desktopDirectory 'node_modules\electron\dist\electron.exe'
$runtime = Join-Path $projectRoot '.venv\Scripts\nanomuse.exe'
$developmentDirectory = Join-Path $projectRoot 'build\desktop-dev'

# 依赖由安装流程准备；日常启动不重新下载或重建整套 DSH。
foreach ($required in @($electron, $runtime, (Join-Path $installedPlugin 'package.json'))) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "桌面依赖未准备完整，请先按 docs/desktop-development-local.md 安装：$required"
    }
}

if ($Web) {
    # 端口已占用时快速退出，避免重复构建后才发现旧 Host 仍在运行。
    $portProbe = [System.Net.Sockets.TcpClient]::new()
    try {
        $existingConnection = $portProbe.ConnectAsync('127.0.0.1', 38421)
        if ($existingConnection.Wait(500) -and $portProbe.Connected) {
            throw '本地 Web 端口 38421 已被占用；请先在之前启动的窗口按 Ctrl+C，再重试。'
        }
    } catch [System.AggregateException] {
        # 没有运行中的 Web Host 时，拒绝连接属于正常情况。
    } finally {
        $portProbe.Dispose()
    }
}

Push-Location $pluginDirectory
try {
    & pnpm.cmd build
    if ($LASTEXITCODE -ne 0) { throw '桌面插件构建失败。' }
} finally {
    Pop-Location
}

# 同步自己的插件产物及配置；保留 DSH 已安装的依赖和原生模块。
foreach ($item in @('lib', 'assets', 'presets', 'cordis.patch.yml', 'package.json')) {
    Copy-Item -LiteralPath (Join-Path $pluginDirectory $item) -Destination $installedPlugin -Recurse -Force
}

Push-Location $desktopDirectory
$environmentNames = @('NANOMUSE_DESKTOP_HOME', 'NANOMUSE_DATA_DIR', 'NANOMUSE_PY', 'ELECTRON_RUN_AS_NODE', 'DSH_HOME', 'NANOMUSE_MCP_CONFIRM')
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    # 调试构建保留主进程源码映射；开发数据与安装版完全分开。
    & '.\node_modules\.bin\tsc.cmd' -p tsconfig.json --sourceMap
    if ($LASTEXITCODE -ne 0) { throw '桌面外壳构建失败。' }
    New-Item -ItemType Directory -Path $developmentDirectory -Force | Out-Null
    $env:NANOMUSE_DESKTOP_HOME = Join-Path $developmentDirectory 'harness'
    $env:NANOMUSE_DATA_DIR = Join-Path $developmentDirectory 'runtime'
    $env:NANOMUSE_PY = $runtime
    $env:ELECTRON_RUN_AS_NODE = $null
    if ($Web) {
        # 浏览器直接连接同一个桌面插件 Host，正常入口自行建立浏览器会话，不关闭鉴权。
        $env:DSH_HOME = Join-Path $developmentDirectory 'harness'
        if (-not (Test-Path -LiteralPath (Join-Path $env:DSH_HOME 'profiles\nanomuse\package.json'))) {
            throw '请先普通启动一次桌面开发版，生成 nanoMuse 开发配置后再使用 -Web。'
        }
        $env:ELECTRON_RUN_AS_NODE = '1'
        $env:NANOMUSE_MCP_CONFIRM = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)).ToLowerInvariant()
        $webArguments = @('--expose-internals', (Join-Path $desktopDirectory 'dsh\node_modules\@deepseek-ai\dsh\lib\bin.js'), 'nanomuse')
        if (-not $OpenBrowser) {
            # 自动化浏览器检查需要自行管理入口，不由 DSH 再打开默认浏览器。
            $webArguments += '--no-open'
        }
        $webArguments += @('--port', '38421')
        if ($Debug) { $webArguments = @('--inspect=127.0.0.1:9233') + $webArguments }
        if ($OpenBrowser) {
            # 由 DSH 在服务就绪后打开浏览器，同时隐藏一次性授权参数。
            & $electron @webArguments | ForEach-Object {
                $line = [string]$_
                if ($line -match '^dsh web:') {
                    Write-Host 'dsh web: http://127.0.0.1:38421/（一次性授权参数已隐藏）'
                } else {
                    Write-Host ($line -replace '(?i)([?&]token=)[^&\s]+', '$1[已隐藏]')
                }
            }
        } else {
            & $electron @webArguments | Out-Host
        }
        if ($LASTEXITCODE -ne 0) { throw "Web 开发服务退出码：$LASTEXITCODE" }
        return
    }
    $launchArguments = @('.', "--user-data-dir=$(Join-Path $developmentDirectory 'electron')")
    if ($Debug) {
        # 调试端口仅监听本机，普通启动不开放这些端口。
        $launchArguments += '--inspect=127.0.0.1:9233', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9234'
    }
    # 保持终端连接到 GUI 进程，持续显示调试输出并等待应用退出。
    & $electron @launchArguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "桌面进程退出码：$LASTEXITCODE" }
} finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
    Pop-Location
}
