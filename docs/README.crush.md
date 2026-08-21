# Superpowers 中文版 — Crush 安装指南

在 [Crush](https://github.com/charmbracelet/crush)（Charm 出品的终端 AI 编程 agent）中使用 superpowers-zh 的完整指南。

## ⚠️ 先看这一条：你可能已经装好了

Crush 遵循 **Agent Skills 开放标准**，项目级会**自动发现**下面四个目录，无需任何配置：

```
.crush/skills      .agents/skills      .claude/skills      .cursor/skills
```

也就是说 —— **如果你已经为 Claude Code、Cursor、Codex 或 Antigravity 装过 superpowers-zh，Crush 现在就已经能读到那些 skills 了。**

**这种情况下不要再装 `--tool crush`**，否则同一批 skills 会出现两份，Crush 会重复加载。先确认一下：

```bash
ls .claude/skills .cursor/skills .agents/skills .crush/skills 2>/dev/null
```

只要上面任一目录里已有 20 个 skill，你就不用做任何事。

## 快速安装

只有在上述目录都为空时才需要装：

```bash
cd /your/project
npx superpowers-zh --tool crush
```

自动检测：项目里存在 `.crush/`、`crush.json` 或 `.crush.json` 任一时会自动装 Crush。

## 全局安装

Crush 支持通用全局安装：

```bash
npx superpowers-zh --global --tool crush
```

装到 `~/.config/crush/skills/`（Windows：`%LOCALAPPDATA%\crush\skills\`），所有项目共享。

> Crush 的用户级发现路径还包括 `~/.config/agents/skills/`（与 Codex、Copilot CLI 等共用的跨运行时别名）。如果你已经用 `--global --tool codex` 装过，那批 skills 也会被 Crush 看到 —— 同样别重复装。

## 工作原理

Crush 是 skills-only 适配：不需要 bootstrap 或规则文件。每个 skill 是一个含 `SKILL.md` 的目录，`SKILL.md` 的 frontmatter 带 `name` 与 `description`，Crush 据此按需发现并激活。

如果你想把 skills 放在非标准位置，Crush 也支持在配置里显式声明：

```json
{
  "options": { "skill-path": ["./other-skills"] }
}
```

或用环境变量 `CRUSH_SKILLS_DIR` 覆盖默认目录。**我们不动你的 `crush.json`** —— 四个自动发现目录已经够用。

## 更新 / 卸载

```bash
npx superpowers-zh --tool crush            # 更新（覆盖式，幂等）
npx superpowers-zh --uninstall             # 卸载项目级
npx superpowers-zh --global --uninstall    # 卸载全局
```

卸载只删我们装进去的 skills，**不会碰你的 `crush.json`**。

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- Crush 仓库：https://github.com/charmbracelet/crush
- Crush skills 文档：https://charmbracelet-crush.mintlify.app/configuration/skills
