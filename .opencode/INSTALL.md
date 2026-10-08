# 为 OpenCode 安装 Superpowers 中文版

## 前置条件

- 已安装 [OpenCode.ai](https://opencode.ai)

## 安装步骤

OpenCode V2 需要 2.0.4 或更高版本。

### OpenCode V1

使用原有的 V1 插件配置，在你的 `opencode.json`（全局或项目级别）中将 superpowers-zh 添加到 `plugin` 数组：

```json
{
  "plugin": ["superpowers@git+https://github.com/jnMetaCode/superpowers-zh.git"]
}
```

### OpenCode V2（2.0.4 或更高版本）

使用 V2 插件配置（注意键名是 `plugins`）：

```json
{
  "plugins": ["superpowers@git+https://github.com/jnMetaCode/superpowers-zh.git"]
}
```

如果是 V2 的本地安装，配置的应当是包含 `index.js` 的仓库目录。OpenCode 2.0.4 和 2.0.7 会拒绝直接配置成 JavaScript 文件路径。通过自动发现找到的插件符号链接仍然受支持。

重启 OpenCode。V2 使用 `opencode` 命令；`opencode2` 可能作为别名可用。插件会通过 OpenCode 的插件管理器安装，并注册所有 skills。

通过询问来验证："告诉我你的超能力"

OpenCode 使用它自己的插件安装。如果你同时在用 Claude Code、Codex 或其他运行环境，需要为每一个分别安装 Superpowers。

## 从旧版符号链接安装方式迁移

如果你之前使用 `git clone` 和符号链接安装过 superpowers，请移除旧的配置：

```bash
# 移除旧的符号链接
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers

# 可选：移除克隆的仓库
rm -rf ~/.config/opencode/superpowers

# 如果你在 opencode.json 中为 superpowers 添加过 skills.paths，请将其移除
```

然后按照上面的安装步骤操作。

## 使用方法

使用 OpenCode 的原生 `skill` 工具：

```
use skill tool to list skills
use skill tool to load brainstorming
```

## 更新

OpenCode 通过一个基于 git 的包说明（package spec）安装 Superpowers。有些 OpenCode 和 Bun 版本会把解析出的 git 依赖锁定在 lockfile 或缓存里，所以重启不一定能拿到 Superpowers 的最新提交。如果更新没有生效，清掉 OpenCode 的包缓存，或重新安装插件。

要固定到特定版本，在包说明后面加上标签或提交（V1 的 `plugin` 键和 V2 的 `plugins` 键写法相同）：

```json
{
  "plugin": ["superpowers@git+https://github.com/jnMetaCode/superpowers-zh.git#v1.7.13"]
}
```

在 V2 上，要固定到包含 V2 插件的版本（v1.7.13 之后的版本）；v1.7.13 及更早的发布只能在 V1 上加载。

## 故障排除

### 插件未加载

1. 检查日志。V1：`opencode run --print-logs "hello" 2>&1 | grep -i superpowers`。
   V2 在后台服务进程里加载插件，所以要加上 `--standalone`：
   `opencode run --standalone --print-logs "hello" 2>&1 | grep -i superpowers`，
   或者查看 `~/.local/share/opencode/log/opencode.log`，过滤 `role=server`。
2. 验证 `opencode.json` 中的插件配置
3. 确保你运行的是较新版本的 OpenCode

### Windows 安装问题

部分 Windows 版 OpenCode 对基于 git 的插件说明存在上游安装器问题，包括 `git+https` URL 的缓存路径问题，以及 Bun 找不到 `git.exe`（即使它在普通终端里能用）。如果 OpenCode 装不上插件，可以试试用系统的 npm 安装，再让 OpenCode 指向本地包：

```powershell
npm install superpowers@git+https://github.com/jnMetaCode/superpowers-zh.git --prefix "$HOME\.config\opencode"
```

然后按你的 OpenCode 版本，在 `opencode.json` 里使用已安装包的绝对路径。OpenCode 不展开 `~`；`~/...` 这样的条目会被当成包名，而不是本地目录。

**V1：**

```json
{
  "plugin": ["C:\\Users\\<you>\\.config\\opencode\\node_modules\\superpowers"]
}
```

**V2（2.0.4 或更高版本）：**

```json
{
  "plugins": ["C:\\Users\\<you>\\.config\\opencode\\node_modules\\superpowers"]
}
```

### Skills 未找到

1. 使用 `skill` 工具列出已发现的内容
2. 检查插件是否已加载（见上文）

### 工具映射

Skill 用动作来表述（「创建一条待办」「分派一个子智能体」「读取一个文件」）。插件会按 OpenCode 的版本注入对应的映射——先确认你的 OpenCode 版本：

**V1（`opencode` 1.x）：**

- 「创建一条待办」/「在待办列表里标记完成」→ `todowrite`
- `Subagent (general-purpose):` 模板 → `task` 工具，传 `subagent_type: "general"`（探索代码库时用 `"explore"`）
- 「调用一个 skill」→ OpenCode 的原生 `skill` 工具
- 「读取文件」→ `read`
- 「创建文件」/「编辑文件」/「删除文件」→ `apply_patch`
- 「运行 shell 命令」→ `bash`
- 「搜索文件内容」/「按文件名查找」→ `grep`、`glob`
- 「抓取 URL」→ `webfetch`

**V2（`opencode` 2.0.4 或更高版本；`opencode2` 可能作为别名可用）：**

- 「创建一条待办」→ V2 没有待办工具；改为在一个 markdown 文件里跟踪计划
- `Subagent (general-purpose):` 模板 → `subagent` 工具，传 `agent: "general"`（或 `"explore"`）；传 `sessionID` 可以继续之前的子智能体
- 「调用一个 skill」→ OpenCode 的原生 `skill` 工具
- 「读取文件」→ `read`
- 「创建、编辑或删除文件」→ 有 `patch` 时用 `patch` 并传 `patchText`；否则用 `write` 创建或覆盖文件、`edit` 做定点修改、`shell` 删除文件
- 「运行 shell 命令」→ `shell`（`command`、`workdir`、`timeout`、`background`）
- 「搜索文件内容」/「按文件名查找」→ `grep`、`glob`
- 「抓取 URL」→ `webfetch`
- 「搜索网络」→ `websearch`

## 获取帮助

- 报告问题：https://github.com/jnMetaCode/superpowers-zh/issues
- 完整文档：https://github.com/jnMetaCode/superpowers-zh/blob/main/docs/README.opencode.md
