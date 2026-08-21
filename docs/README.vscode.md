# Superpowers 中文版 — VS Code (Copilot) 安装指南

在 VS Code + GitHub Copilot 中使用 superpowers-zh 的完整指南。

## 前置条件

- VS Code（最新版本）
- GitHub Copilot 扩展（免费版或付费版均可）

## 快速安装

```bash
cd /your/project
npx superpowers-zh
```

安装脚本会自动检测 `.github/` 目录并将 skills 复制到该目录。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p /your/project/.github/superpowers
cp -r superpowers-zh/skills/* /your/project/.github/superpowers/
```

## ⚠️ v1.7.10 及更早版本请重新安装

旧版把 20 个 skill 拷进 `.github/superpowers/`，然后**什么引导都不写** —— 而 [VS Code 官方文档](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)明确 Copilot 只自动读这几处：

- `.github/copilot-instructions.md`、`AGENTS.md`、`CLAUDE.md`（始终生效）
- `.github/instructions/*.instructions.md`（按 frontmatter 的 `applyTo` 匹配）

**`.github/superpowers/` 不在其中，Copilot 一个字都不会读。** 旧文档还写着「建议你自己创建 `copilot-instructions.md` 引用它们」—— 等于我们知道需要引导，却让用户自己动手。

v1.7.11 起自动生成 `.github/instructions/superpowers-zh.instructions.md`（约 4.5 KB 索引，`applyTo: "**"` 对所有请求生效）。重装即可：

```bash
cd /your/project
npx superpowers-zh --tool vscode
```

## 工作原理

装两样东西：

| 位置 | 内容 | Copilot 是否自动读 |
|---|---|---|
| `.github/instructions/superpowers-zh.instructions.md` | 索引：核心规则 + 20 个 skill 的触发条件表 | **是**（`applyTo: "**"`） |
| `.github/superpowers/<name>/SKILL.md` | skill 正文 | 否，由索引引导按需读取 |

**为什么不直接改 `.github/copilot-instructions.md`：** 那是你的文件。我们用自己的 `.instructions.md`，两者互不干扰，卸载时也能精确删掉而不碰你的内容。

**为什么正文不放进索引：** `applyTo: "**"` 的文件对每个请求都生效，正文塞进去就是每轮常驻开销。索引 4.5 KB，正文按需读。

### frontmatter 说明

```yaml
---
applyTo: "**"      # 对所有文件/请求生效；省略此字段则只能在对话里手动挂载
name: Superpowers-ZH
description: superpowers-zh 技能框架的索引与触发规则
---
```

`applyTo` 是关键 —— 官方文档原文：省略它，「instructions 不会自动应用，但你仍可手动加进某次聊天请求」。也就是说不写就等于白写。

### 使用 .instructions.md 文件（推荐）

VS Code 还支持更细粒度的 `.instructions.md` 文件：

```
.github/
  copilot-instructions.md          # 全局指令
  .instructions/
    typescript.instructions.md     # TypeScript 文件专用
    testing.instructions.md        # 测试相关
```

## 使用

在 VS Code 中：
- **Copilot Chat**（`Ctrl+Shift+I`）：直接引用 skill 名称
- **内联补全**：自动遵循 copilot-instructions.md 中的规则
- **`/init`**：在 Chat 中输入，自动生成项目配置

## 局限性

VS Code Copilot 不像 Claude Code 那样支持 `Skill` 工具或子 Agent 派遣。以下 skills 需要手动参考而非自动执行：

- 派遣并行 Agent（需要 Agent 框架支持）
- 子 Agent 驱动开发（需要 Agent 框架支持）
- Git Worktree 使用（需要终端操作）

其他方法论类 skills（头脑风暴、TDD、调试、代码审查等）完全兼容。

## 更新

```bash
cd /your/project
npx superpowers-zh
```

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- VS Code Copilot 文档：https://code.visualstudio.com/docs/copilot/customization/custom-instructions
