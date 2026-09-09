# Superpowers 中文版 — Reasonix 安装指南

在 [Reasonix](https://reasonix.io/)（[esengine/DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix)，DeepSeek 原生终端 coding agent）中使用 superpowers-zh 的完整指南。

## 快速安装

```bash
cd /your/project
npx superpowers-zh                          # 自动检测 .reasonix/ 或 reasonix.toml
npx superpowers-zh --global --tool reasonix # 全局
```

## 装到哪、为什么

路径全部取自官方文档，不是猜的：

| 内容 | 路径 | 出处 |
|---|---|---|
| skills（项目级） | `.reasonix/skills/` | [`docs/CONFIG_PATHS.zh-CN.md`](https://github.com/esengine/DeepSeek-Reasonix/blob/main-v2/docs/CONFIG_PATHS.zh-CN.md)：项目本地 settings / skills / commands 位于项目 `.reasonix/` 目录 |
| skills（全局，macOS/Linux） | `~/.reasonix/skills/` | 同上：「全局 skills = `<Reasonix home>/skills/`」，Reasonix home 在 macOS/Linux 为 `~/.reasonix` |
| skills（全局，**Windows**） | `%APPDATA%\reasonix\skills\` | 同上的 Reasonix home 表：**Windows 为 `%APPDATA%\reasonix`**，与 Unix 不同构 |
| 引导（项目级） | 项目根 `REASONIX.md` | [`docs/GUIDE.zh-CN.md`](https://github.com/esengine/DeepSeek-Reasonix/blob/main-v2/docs/GUIDE.zh-CN.md)：常驻指令来自分层加载的 `REASONIX.md` / `AGENTS.md` / `CLAUDE.md` |

Windows 与 Unix 的全局路径**不同构**，安装器按平台自动选择（与 Crush 同一机制）。

## 全局安装不写引导文件，这是故意的

官方文档说常驻指令「用户全局文件先加载，再加载 workspace」，但**没有写明那个用户全局文件的确切路径**（`CONFIG_PATHS` 的目录内容表里没有它）。按本仓一贯口径：不确认就不写。

所以 `--global` 只装 skills、不写引导 —— 技能能被发现，但不会自动触发。**想要自动触发，请用项目级安装**（会写 `REASONIX.md`）。

若你查到 Reasonix 用户全局指令文件的确切路径，欢迎开 issue，我们会补上。

## 已经装过别的工具？

Reasonix 的技能配置里有 `excluded_paths = ["~/.agents/skills"]` 这样的示例，说明它会扫 `.agents/skills` 这类**约定来源**。如果你已经为 Codex CLI（全局 `~/.agents/skills`）或 Antigravity（项目 `.agents/skills`）装过，那批技能可能已经能被 Reasonix 读到 —— 重复安装会加载两份。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p .reasonix/skills
cp -r superpowers-zh/skills/* .reasonix/skills/
```

## 卸载

```bash
npx superpowers-zh --uninstall              # 项目级（含 REASONIX.md 里我们写的那段）
npx superpowers-zh --global --uninstall     # 全局
```

只移除我们装的技能目录与哨兵注释包住的引导段落，你自己写的内容不受影响。

## 相关 issue

- [#42](https://github.com/jnMetaCode/superpowers-zh/issues/42) 建议支持 Reasonix
