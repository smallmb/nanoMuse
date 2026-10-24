# 本地桌面开发与调试

本地长期定制分支：`custom/personal`，远程跟踪 `origin/custom/personal`。后续更新遵循[定制版本更新策略](zh/desktop-muse.md#custom-update-policy)。本轮只安装和验证 Windows 桌面端，不构建 Android、iOS、独立 Web 服务或中继服务。官方仓库为 `upstream`，推送地址已禁用；个人仓库 `smallmb/nanoMuse` 配置为 `origin`。

## 启动

使用 PowerShell 7，在源码根目录执行：

```powershell
# 进入带 Git 历史的本地定制源码。
Set-Location 'D:\OneDrive\Desktop\nanoMuse-main\nanoMuse-personal'

# 构建本地插件和桌面外壳，启动带调试端口的 Electron。
pwsh -NoProfile -File .\scripts\dev-desktop.ps1 -Debug
```

普通启动省略 `-Debug`。脚本会重新构建 `harness/dsh-nanomuse`，把插件产物、素材和配置同步到已准备的 DSH，再构建、启动 `harness/desktop`。修改源码后，退出开发版并重新执行脚本即可加载修改；当前流程使用重新构建与重启。

只在浏览器验收同一套桌面插件时，先退出已运行的开发版，再执行：

```powershell
# 启动同一桌面插件的 Web 页面，保留本机鉴权，地址在终端的 dsh web 行输出。
pwsh -NoProfile -File .\scripts\dev-desktop.ps1 -Web
```

`-Web` 沿用桌面开发数据目录，先普通启动一次即可生成配置；同一个目录不同时运行两个 Host。通过终端输出的完整进入地址建立浏览器会话后，动态页地址为 `http://127.0.0.1:38421/#nanomuse-feed`。进入地址包含本机登录令牌，日志不提交。Web 模式不启动 Electron 外壳和它的电脑操作服务；如另加 `-Debug`，`9233` 调试对象是 Host 主进程。

脚本等待 Electron 退出，并持续显示启动日志。窗口关闭后可能按上游偏好保留在托盘；需要重启构建时，从应用菜单或托盘退出开发版。运行期间不要再次执行 `prepare-dsh.mjs`，该上游脚本会重建整个暂存目录。

## 数据目录

开发版使用仓库中已被忽略的目录：

- `build/desktop-dev/harness/`：DSH 配置、nanoMuse 账号和会话数据、`desktop.log`。
- `build/desktop-dev/electron/`：Electron 用户数据。
- `build/desktop-dev/runtime/`：电脑操作 Python 运行时的数据。
- `.venv/`：本仓库的 Python 3.12 虚拟环境。

这些本地文件与安装版的默认目录分开。登录相同 nanoMuse Cloud 账号后，官方会话同步仍会把该账号的历史同步到开发版；开发目录隔离不改变账号的同步行为。运行数据和凭据不提交。

## 调试

- 渲染进程：窗口中按 `Ctrl+Shift+I` 打开开发者工具，检查元素、Console 和 Network；`Ctrl+R` 刷新当前页面。
- 主进程：`-Debug` 开启 `127.0.0.1:9233` 的 Node Inspector，可从编辑器附加调试器。
- 渲染进程远程调试：`-Debug` 开启 `127.0.0.1:9234`。两个端口均已核实只监听回环地址，普通启动不添加这些参数。
- 插件构建保留源码映射；启动脚本也为外壳生成源码映射。已通过主进程调试连接核实 `harness/desktop/out/main.js` 关联 `main.js.map`。
- 插件修改主要位于 `harness/dsh-nanomuse/src/`；原生窗口、托盘和电脑操作主要位于 `harness/desktop/src/`。

## 首次安装的复现步骤

本机已完成以下安装。只在依赖丢失、锁文件变更或切换环境时重新执行。

```powershell
# 安装桌面插件依赖，保持上游锁文件。
Push-Location .\harness\dsh-nanomuse
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm build
Pop-Location

# 安装 Electron 外壳，装配固定版本的 DSH。
Push-Location .\harness\desktop
npm ci --registry=https://registry.npmjs.org --no-audit --no-fund
node scripts/prepare-dsh.mjs
Pop-Location

# 单独下载 Electron 二进制；npm 的脚本策略可能将下载延后到首次引用。
node .\harness\desktop\node_modules\electron\install.js

# 本机临时目录在 D 盘，缓存放同盘以避免 uv 缓存跨盘移动失败。
$env:UV_CACHE_DIR = Join-Path (Get-Location) 'build\uv-cache'
uv venv --python 3.12 .venv
uv pip install --python .venv\Scripts\python.exe -e '.[hands]' --index-url https://pypi.org/simple
```

本机已使用：Node 24.16.0、npm 11.13.0、pnpm 11.10.0、PowerShell 7.6.7、Python 3.12.10、Electron 44.7.0、DSH 0.2.0-rc.2、nanoMuse 1.0.5。Electron 的精确版本与 DSH 原生组件有关，沿用锁定版本。

## 验证记录：2026-10-22

已通过：

- 插件构建、插件类型检查；插件测试共 350 项，341 通过、9 跳过、0 失败。跳过项以 `build/desktop-plugin-tests.log` 的具体条件为准。
- Electron 外壳类型检查及 140 项测试，全部通过。
- `node scripts/check-hooks.mjs`：69 个样式依赖钩子在当前 DSH 中存在。
- `node scripts/smoke.mjs --operator`：5 个插件配置补丁生效，Host 启动，nanoMuse 的 cloud/status 和 rooms/state 接口均返回 200；未授权页面访问返回 401。
- 实际 Electron 电脑操作模块可用，320×180 PNG 截图有效；未授权操作接口返回 401。此项没有执行点击或键盘输入。
- `.venv` 中的 `nanomuse mcp` 完成协议握手和工具枚举，包含 `computer_screen`、`computer_act`，没有执行这些动作。
- 模型及连接器目录一致性检查通过。
- 实际桌面窗口可见，个人助手界面完成渲染；调试模式的主进程连接、源码映射与回环监听已核实。
- `git diff --check` 通过。

本轮没有主动发送测试聊天、调用真实模型、执行邮件/文件业务动作，未验证真实模型质量、付费请求、完整打包安装和生产自动更新。

## 本轮最小修复

1. ZIP 导出测试固定 Python 输出为 UTF-8，并兼容 CRLF，保留对压缩包完整性、中文文件名与内容长度的检查。
2. 桌面冒烟脚本将 Windows 盘符路径转为文件 URL，再动态导入 Electron。
3. Git 属性固定模型目录的源文件及中继副本为 LF，避免 Windows 检出时与桌面素材的逐字比较误报过期；模型内容未改变，移动端源码未修改。
4. 新增 PowerShell 7 日常开发启动脚本，隔离本地数据，保留调试日志与源码映射。

以上变更留在本地工作树，尚未提交或推送。

## 个人动态适配

本地桌面动态已适配原项目的配图、来源高亮跳转及创建理由，具体行为、源码位置与验证范围见 [桌面动态适配记录](desktop-feed-local.md)。这些改动保留在 `codex/personal` 的本地工作树，不向官方仓库推送。

## 上游更新与复验：2026-10-23

- 在 `codex/personal` 分支从 `948a11d0` 快进更新到 `18edeb6a`，同步官方 22 个提交；桌面版本号仍为 `1.0.5`。
- 更新前用 `desktop-local-before-update-2026-10-23` 保存本地改动，备份对象为 `561022cee9acbfb999594e061ebcd1ce431cc454`。更新后成功恢复原有改动，没有合并冲突，备份仍保留在 stash 中。
- 本次桌面更新包括四个头像设计预设及其展示素材，以及按中继实际能力显示图片、视频云端重试入口。其他上游改动随 Git 同步，本轮只构建和验证桌面端。
- 桌面插件、外壳、DSH 和 Python 依赖声明及锁文件均未变化。已执行插件冻结安装、外壳依赖树检查、Python 可编辑安装及依赖兼容检查，继续沿用固定版本的 DSH 和 Electron。
- 已重新构建插件，并核对安装副本的 `client.js` 与本地构建 SHA-256 一致；四个新预设素材的文件摘要也一致。
- 本地属性恢复后，将模型目录源文件与中继副本落实为 LF，修复 Windows 检出造成的一致性误报，目录内容未改变。
- 插件构建和类型检查通过；350 项测试中 341 通过、9 跳过、0 失败，日志为 `build/desktop-plugin-tests-2026-10-23.log`。
- 外壳类型检查和 140 项测试全部通过，日志为 `build/desktop-shell-tests-2026-10-23.log`。
- 69 个 DSH 样式钩子检查通过；两个 nanoMuse 接口返回 200，未授权页面返回 401；电脑操作模块的真实截图及未授权访问检查通过，日志为 `build/desktop-smoke-2026-10-23.log`。
- 更新后的 Python MCP 运行时握手及工具目录检查通过，未执行电脑动作。
- 使用 PowerShell 7 开发脚本实际启动后，确认 Electron 44.7.0 的窗口可见、页面加载完成、桌面桥存在，主进程源码映射为 `main.js.map`。调试端口 `9233`、`9234` 仅监听 `127.0.0.1`。
- 模型和连接器目录一致性检查、`git diff --check` 均通过。没有主动发送真实模型测试消息、生成头像或视频，也没有提交或推送个人改动。

## Web 验收与首次上传

验收对象是桌面插件对应的 DSH Web 页面，沿用本轮桌面功能范围。仓库 `web/` 是另一套 Python 运行时的控制台，不代表这次动态改动已经移植到该控制台。

执行顺序：自动检查与 Web 页面验收完成，用户自行手测并确认，再把第一份个人改动提交、推送到 `origin/codex/personal`。不向官方仓库提交 PR，不把个人功能放入同步上游使用的 `main`。

手测检查：

1. 动态图片正常显示，无法取图时不出现破图或空白占位。
2. 标题、配图和正文内的蓝色高亮链接打开对应原文，浏览器模式应能新开页面；不重复显示来源栏。
3. 右上角更多菜单显示动态日期与创建理由入口，点击可打开理由弹窗并正常关闭；历史记录没有理由时显示未保存提示。
4. 使用专用测试动态验证喜欢状态刷新后保留、讨论带入来源及理由、移除后列表正确更新。
5. 实际生成一批新动态后，核对理由是否符合真实指令和兴趣。此项会调用用户配置的模型，之前的自动回归没有验证真实模型输出质量。

2026-10-23 本轮 Web 复验已通过：通过新启动 Host 输出的正常入口建立内置浏览器会话，完成真实动态配图、四种来源跳转、历史理由菜单及弹窗、喜欢状态刷新保存与还原。此前访问受阻的记录保留在施工历史中；桌面外壳日志里的 `token=…` 已脱敏，不是可用的登录地址。

本轮修复了浏览器刷新动态页回到聊天的问题，动态页现在通过自己的地址片段恢复，切回聊天时清除；修复了同一动态首次讨论并发创建多个会话的问题，并新增回归验证并发去重、不同动态独立及失败重试。完整插件测试为 360 项，351 通过、9 跳过、0 失败。

后续手测发现正文链接应使用文本内蓝色高亮，创建理由应在更多菜单中查看。本次已移除封面下方重复来源栏及卡片底部的理由按钮；更多菜单只保留日期、创建理由和移除，卡片底部为喜欢与讨论。另修复 Host 在每日 Feed 生成未完成时重启会重复调用模型的问题：开始时间已写入动态存储，重启后的定时任务遵守两小时重试间隔。修复后构建、类型检查和 361 项测试通过（352 通过、9 跳过、0 失败）。

合成动态的浏览器夹具验证了保存的创建理由、坏图降级、正文关键词、高亮、喜欢、讨论回调和可恢复的移除操作；夹具只替换宿主弹窗容器与通信，不改真实动态，不代表真实模型聊天已验收。真实讨论上下文由本地服务回归覆盖，新生成动态的内容与个性化理由质量留给用户手测。日志和界面检查记录位于忽略目录 `build/feed-web-check/`、`build/desktop-feed-web-tests-2026-10-23.log`，重启后 `client.js`、`rooms.js` 与安装副本摘要一致。

目前停在用户手测阶段，尚未提交或推送。

## 个人分支与上游同步

已完成的本地准备：

- `origin` 指向 `https://github.com/smallmb/nanoMuse.git`；核对时远端仅有 `main`，提交为 `18edeb6a`。
- `upstream` 指向 `https://github.com/nano-muse/nanoMuse.git`，推送地址继续为 `disabled://upstream`。
- 本地 `main` 已从 `948a11d0` 快进到 `18edeb6a`，跟踪 `upstream/main`，只保存上游基础代码。
- 当前仍在 `codex/personal`，个人改动留在本地工作树，尚未提交或上传。首次上传等待 Web 验收及用户手测确认。

后续更新上游时，先提交或妥善保存个人分支的改动，再执行：

```powershell
# 获取官方更新，在当前个人分支中快进更新未被检出的本地 main。
git fetch upstream main:main

# 普通推送同步个人仓库的 main；远端存在分歧时会拒绝，不强制覆盖。
git push origin main

# 回到个人开发分支，把上游更新合入个人功能，保留已有提交历史。
git switch codex/personal
git merge --signoff main -m 'chore: sync upstream main'

# 处理冲突并完成构建和验收后，再推送个人分支。
git push origin codex/personal
```

分支分开保存能避免日常开发直接改写上游基础代码，但不能保证合并永远没有冲突。只同步 `main` 不会自动更新 `codex/personal`，仍需把 `main` 合入个人分支并复验。首次上传与后续合并前，都只提交源码及开发文档，不提交运行数据、凭据、构建目录或测试日志。
