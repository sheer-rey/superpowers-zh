# Superpowers 中文版 — ZCode 安装指南

在 [ZCode](https://zcode.z.ai/)（智谱的 Agentic Development Environment）中使用 superpowers-zh 的完整指南。

## ⚠️ 只支持全局安装，这是证据决定的

```bash
npx superpowers-zh --global --tool zcode
```

装到 `~/.zcode/skills/`，所有工作区共享。

**项目级安装会被明确拒绝，不是漏做。** ZCode [官方技能文档](https://zcode.z.ai/docs/skill)（中英文版一致）只给出一个磁盘路径：

> ZCode Agent 的用户级技能目录：`~/.zcode/skills/<skill-name>/SKILL.md`

而项目级在文档里是**应用内的 UI 导入动作**（设置 → 技能 → 导入，可选「链接到来源目录」或「复制成 ZCode 内部副本」，导入目标可选「全局」或「当前项目」），**从不暴露项目级磁盘路径**。

社区在 [#120](https://github.com/jnMetaCode/superpowers-zh/issues/120) 提供的补丁写的是 `.zcode/skills` + `.zcode/AGENTS.md` —— 那是让 AI 按目录结构猜的，官方文档里查无此路径。按本仓一贯口径：**不确认能生效就不写**，猜一个路径装进去只会变成「装了不生效」。

如果你确认了 ZCode 的项目级磁盘路径（最好带官方文档链接），欢迎开 issue，我们会补上。

## 装完怎么用

ZCode 里技能通过 `$skill-name` 调用：在输入框输入 `$`，选择需要的技能。也可以在 **设置 → 技能** 里查看列表、按名称搜索、用开关启用/停用。

装完后建议先确认：设置 → 技能 里能看到这 20 个 skill，且处于启用状态。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p ~/.zcode/skills
cp -r superpowers-zh/skills/* ~/.zcode/skills/
```

目录结构必须是**单层**：`~/.zcode/skills/<技能名>/SKILL.md`。官方文档明确提到「嵌套在分组目录下的技能不会被 Agent 识别」。

## 卸载

```bash
npx superpowers-zh --global --uninstall
```

只移除我们装的那 20 个技能目录，你自建的技能不受影响（已在 verify-release 里有断言守着）。

## 关于 AGENTS.md

ZCode 支持 `AGENTS.md` 作为六类扩展之一（技能、命令、MCP、Hooks、插件、AGENTS.md），但其**位置与作用域官方文档页没有直接写明**（文档指向内置的 `$zcode-configuration-guide` 技能查询）。因此本工具目前是 **skills-only**：不写 bootstrap 文件，不猜路径。

这意味着技能不会「自动触发」，需要你用 `$skill-name` 显式调用。若你查到 AGENTS.md 的确切位置与作用域，欢迎开 issue。

## 相关 issue

- [#95](https://github.com/jnMetaCode/superpowers-zh/issues/95) 建议支持 Zcode
- [#120](https://github.com/jnMetaCode/superpowers-zh/issues/120) feat: 添加 ZCode 支持
