# Superpowers 中文版 — DeepSeek Harness 安装指南

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）中使用 superpowers-zh 的完整指南。

## 快速安装

```bash
cd /your/project
npx superpowers-zh              # 自动检测 .dsh/ 并安装
```

全局安装（所有项目共享）：

```bash
npx superpowers-zh --global --tool dsh
```

## 装到哪、为什么

四条路径全部取自官方仓库文档，不是猜的：

| 内容 | 路径 | 出处 |
|---|---|---|
| skills（项目级） | `.dsh/skills/` | [`docs/subsystems/skills.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md) 的 Local discovery priority 表，rank 100 |
| skills（全局） | `~/.dsh/skills/` | `dshHome` 默认值 —— shell-env 文档：`dshHome \| $DSH_HOME, then ~/.dsh` |
| 引导文件（项目级） | 项目根 `AGENTS.md` | `instructionFileCandidates` 默认 `['AGENTS.md', 'CLAUDE.md']` |
| 引导文件（全局） | `~/.dsh/AGENTS.md` | 文档：user-global 指令文件为 `$DSH_HOME/AGENTS.md` |

## 已经装过别的工具？可能已经生效了一半

dsh 的技能发现路径里 **rank 200 是 `.agents/skills`** —— 那正是 Antigravity 的项目级目录、也是 Codex CLI 的全局目录（`~/.agents/skills`）。如果你已经为这两款装过，dsh **已经能读到那批技能**，不必重复装（重复装会加载两份）。

同理，dsh 的指令文件候选里包含 `CLAUDE.md`：装过 Claude Code 的项目，引导那一半已经生效。**但 `.claude/skills` 不在 dsh 的技能根列表里**，技能本身仍需按上面的路径安装。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p .dsh/skills
cp -r superpowers-zh/skills/* .dsh/skills/
```

技能名必须是 kebab-case（官方约束：`^[a-z0-9]+(?:-[a-z0-9]+)*$`），本仓 20 个 skill 全部符合。

## 卸载

```bash
npx superpowers-zh --uninstall              # 项目级
npx superpowers-zh --global --uninstall     # 全局
```

只移除我们装的技能目录与 `AGENTS.md` 里哨兵注释包住的那一段，你自己写的内容不受影响。

## 相关 issue

- [#122](https://github.com/jnMetaCode/superpowers-zh/issues/122) 请求兼容 DeepSeek Harness
