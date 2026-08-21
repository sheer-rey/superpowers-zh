# Superpowers 中文版 — Kiro 安装指南

在 [Kiro](https://kiro.dev)（Amazon AI IDE）中使用 superpowers-zh 的完整指南。

## ⚠️ v1.7.9 及更早版本请重新安装

旧版把 20 个 skill 的**正文**直接装进了 `.kiro/steering/`。而 [Kiro 官方文档](https://kiro.dev/docs/steering/)明确：`.kiro/steering/` 下的文件默认 `inclusion: always`，会被 "loaded into every Kiro interaction automatically"。

实测那个布局是 **47 个 md、335 KB，每一轮对话全量进上下文**。不是不能用，是每轮都在烧 token。

v1.7.10 起改成索引式：**4.4 KB**（76 倍差距）。重装即可，安装器会自动清掉旧布局：

```bash
cd /your/project
npx superpowers-zh@latest --tool kiro
```

会看到：

```
🧹 Kiro: 清理旧布局 20 个 skill 目录 <- .kiro/steering/
✅ Kiro: steering 索引 -> .kiro/steering/superpowers-zh.md
```

**你自己写的 steering 文件不会被动** —— 只清理与我们 skill 同名的那些目录。

## 快速安装

```bash
cd /your/project
npx superpowers-zh --tool kiro
```

装两样东西：

| 位置 | 内容 | 是否每轮常驻 |
|---|---|---|
| `.kiro/steering/superpowers-zh.md` | 索引：核心规则 + 20 个 skill 的触发条件表（约 4.4 KB） | **是**（`inclusion: always`） |
| `.kiro/skills/<name>/SKILL.md` | skill 正文 | 否，按需读取 |

## 工作原理

Kiro 用 **Steering** 机制管理 AI 行为规则。关键的三件事：

- **目录**：`.kiro/steering/`（项目级）、`~/.kiro/steering/`（全局）
- **默认行为**：**没写 `inclusion` 的文件默认就是 always** —— 每次交互自动加载
- **frontmatter 键**（这是 Kiro 自己的，别和 Cursor 系搞混）：

  | 键 | 含义 |
  |---|---|
  | `inclusion: always` | 每次交互都加载（**默认值**） |
  | `inclusion: fileMatch` + `fileMatchPattern` | 匹配特定文件时加载 |
  | `inclusion: manual` | 仅在聊天里用 `#steering-file-name` 引用时加载 |
  | `inclusion: auto` | 按 `description` 与请求匹配时自动加载 |

> 📌 v1.7.9 及更早的本文档写着加载模式是 `alwaysApply: true` 和 `globs: "*.ts"` —— **这两个键 Kiro 文档里根本不存在**，是 Cursor / Trae 的约定被误写成了 Kiro 的。已更正。

### 为什么正文不放 steering 里

因为 steering 是常驻开销。这跟我们对 Cline、Kilo Code 的处理是同一个道理：**常驻的位置只放索引，正文按需读取。**

索引里明确告诉 Kiro：任务匹配某个 skill 时，去读 `.kiro/skills/<skill-name>/SKILL.md` 并遵循其流程。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p /your/project/.kiro/skills
cp -r superpowers-zh/skills/* /your/project/.kiro/skills/
```

> 手动复制不会生成 `.kiro/steering/superpowers-zh.md` 索引，Kiro 不会知道这些 skill 的存在，你需要自己写一份索引。建议优先用 `npx superpowers-zh --tool kiro`。
>
> **不要**把正文直接拷进 `.kiro/steering/` —— 那正是本次修掉的问题。

## 使用

装好重启 Kiro 后：

- 直接描述任务即可，索引会引导它去匹配 skill：「帮我加一个导出功能」应触发 brainstorming
- 也可以点名：「用 brainstorming 分析这个需求」
- 手动引用索引本身：在聊天里输入 `#superpowers-zh`

## 卸载

```bash
npx superpowers-zh --uninstall
```

会删除 `.kiro/skills/` 下装过的 skill 和 `.kiro/steering/superpowers-zh.md`，并顺带清理旧布局残留。你自己的 steering 文件保留。

## 更新

```bash
npx superpowers-zh@latest --tool kiro
```

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- Kiro Steering 文档：https://kiro.dev/docs/steering/
