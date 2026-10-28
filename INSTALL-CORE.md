# 安装配套 Harness 核心与插件（v0.1.1）

本版同时提供插件和**完整配套源码补丁**，不再要求你自行实现兼容接口。它仍不是原版 Harness 可直接安装的纯 UI 插件：请先运行打补丁后的 Harness，再安装 npm 包。补丁不在安装时自动执行。

## 1. 固定版本与准备

- Harness upstream: https://github.com/deepseek-ai/deepseek-harness
- **精确基线：`1f81c047fc48fa190a683e469daa699857e9afe8`**。
- 补丁：`patches/harness-trusted-paths.patch`（同时随 npm 包和 GitHub Release 提供）。
- 插件：`dsh-plugin-trusted-paths@0.1.1`。
- **当前完整授权/撤销支持范围为 Windows。Linux/macOS 的 revoke/reconcile 明确不支持，带引用配置会拒绝激活；不要将本版当作跨平台完整实现。**
- Node 使用符合该 Harness 基线 engines 的版本（`^22.19.0 || >=24.0.0`；推荐 Node 24）。使用基线声明的 pnpm `11.28.5`。
- Git、pnpm，以及 upstream 原生系统模块所需的工具链。按 upstream development 文档安装相应平台构建工具；不要把原生构建失败当作可忽略问题。

优先在**新建的干净目录**中操作，不要在正在执行任务的 Harness 上切换提交或覆盖源码。先备份现有 profile 和会话数据；本补丁涉及持久化工作区目录字段，不能承诺旧核心读取修改后的数据完全兼容。

## 2. 获取源码并应用补丁

先下载本插件的 `v0.1.1` Release 源码，解压到一个目录（以下称为插件目录），或 clone 插件仓库后 checkout `v0.1.1`。

```powershell
git clone https://github.com/deepseek-ai/deepseek-harness.git deepseek-harness-trusted
Set-Location deepseek-harness-trusted
git checkout --detach 1f81c047fc48fa190a683e469daa699857e9afe8
```

把下面路径替换为你下载的插件目录里的补丁完整路径：

```powershell
git apply --check "C:\path\to\dsh-plugin-trusted-paths\patches\harness-trusted-paths.patch"
git apply "C:\path\to\dsh-plugin-trusted-paths\patches\harness-trusted-paths.patch"
git diff --check
```

**任何命令失败都应停止。** 不要使用 `--reject`、忽略冲突、强制覆盖或对其他提交直接应用。升级 upstream 前需重新适配并测试补丁。

发布验证使用隔离 Git index，从该基线的原始 blob 执行 `git apply --cached --check` 和实际应用，并校验补丁 whitespace；没有将开发 checkout 的其他文件作为隐含前提。

## 3. 安装依赖、构建、测试

在打好补丁的 Harness 源码根目录：

```powershell
pnpm install --frozen-lockfile
pnpm run build
```

按 pnpm/upstream 提示审核必要的原生依赖构建脚本。不要用忽略脚本的安装结果冒充已完成运行环境构建。

核心功能回归测试示例：

```powershell
pnpm exec vitest run packages/settings/settings/tests packages/client/ui-workspace/tests packages/sandbox/sandbox/tests packages/sandbox/sandbox-policy/tests packages/fs/fs-sandbox/tests
pnpm exec vitest run packages/workspace/workspace/tests packages/api/workspace-controller/tests packages/api/session-controller/tests
```

平台相关测试以 upstream Vitest 配置为准；部分 Windows ACL/profile 测试可能被默认 suite 排除，不要把“未收集到测试”当通过。Windows 符号链接测试可能需要 Developer Mode 或创建符号链接权限。发布者验证环境中存在此类原有 EPERM 用例，未宣称跨平台全套测试通过。

本次扩展回归实际结果：25 个测试文件中 24 通过；634 项通过、1 跳过、1 失败。失败为既有 `fs-sandbox/tests/containment.spec.ts` 创建目录符号链接时 Windows 返回 EPERM，未改用例掩盖该限制。需要符号链接权限的测试在普通 Windows 进程上可能失败；这是未完成的环境验证，不宣称完整测试全绿。

此补丁的先前发布前记录包括：Host 与 Web 构建成功；Settings 48、UI Workspace 471、文件沙箱 22 项测试通过；工作区域/会话相关测试 113 通过（3 个原有符号链接用例跳过）；Windows 真实受限进程验证引用目录写入、未引用目录拒绝、租约清理和撤权。详见插件测试和兼容说明，这些不等于每个平台都已验收。

## 4. 启动这个源码版本

停止原 Harness 前先结束相关任务和终端。在打补丁的 checkout 中按 upstream 方式启动：

```powershell
pnpm dsh web
```

请确认你访问的是**该源码进程**的 URL，而不是另一个 npm 安装的 `dsh` 或旧服务。用其他全局 `dsh web` 启动可能仍加载未打补丁的核心。已有服务需要重启，网页需要强制刷新；只重建源码不会替换运行中的进程。

## 5. 安装插件

在这个 Harness 的插件管理页面安装：

```text
dsh-plugin-trusted-paths@0.1.1
```

不要同时启用旧开发包 `@local/dsh-trusted-paths`。它与公开版复用配置/菜单标识，迁移前请备份配置。初次安装公开版不信任任何额外目录；打开对应工作区标题「…」→「目录设置」即可设置主目录与引用目录。

## 6. 验收（不要用全权限模式证明沙箱有效）

1. 打开工作区「目录设置」，确认主目录可选、引用可添加/取消/移除；不保存不得改授权。
2. 保存一个专用测试引用目录。在 `workspace-write` 会话中写入引用目录成功；写入另一个未引用目录应被拒绝。`read-only` 不应获得写权限。
3. 停止相关命令、终端及子进程，移除引用并保存，再确认新操作不再获写权限。不要用仍持有文件句柄的进程测试即时撤销。
4. 更换主目录后在该工作区新建一个真正的新会话，要求 AI 不切换目录、不指定 workdir，查看默认目录；新会话使用新目录，旧会话仍用原 cwd。
5. 重开设置确认持久化；不同工作区的引用不能串用。

## 7. 回滚与升级

先停止全部相关任务和 Harness，保留 profile/会话备份。在未有其他源码修改的 checkout 上可先 `git apply --reverse --check <补丁路径>` 检查，再反向应用；更安全是保留旧安装目录、在新目录运行新版本。**源码回滚不会删除授权租约，也不会迁移/回滚工作区数据。** 不要手动清除正在使用的租约。Windows 已打开的句柄无法由删配置收回。

本补丁修改 upstream MIT 源码，非官方维护分支，不表示已被 DeepSeek 上游接纳。请审阅 `patches/harness-trusted-paths.patch` 后再构建运行。
