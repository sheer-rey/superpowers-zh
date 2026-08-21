# Superpowers 中文版 — Windsurf 安装指南

在 [Windsurf](https://windsurf.com) 中使用 superpowers-zh 的完整指南。

## 自动安装

```bash
cd /your/project
npx superpowers-zh
```

安装脚本会自动检测 `.windsurf/` 目录并将 skills 复制到 `.windsurf/skills/` 目录。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
cp -r superpowers-zh/skills /your/project/.windsurf/skills
```

或全局安装（注意路径 —— **不是** `~/.windsurf/skills`）：

```bash
npx superpowers-zh --global --tool windsurf
# 等价于手动：cp -r superpowers-zh/skills/* ~/.codeium/windsurf/skills/
```

> 📌 **v1.7.10 及更早的 `--global` 装到了 `~/.windsurf/skills`，Windsurf 不读那里，等于装了不生效。** 这是我们的实现错误，v1.7.11 起修正为官方路径 `~/.codeium/windsurf/skills/`。之前全局装过的请重装，并可手动删掉遗留的 `~/.windsurf/skills`。

## 工作原理

[Windsurf 官方文档](https://docs.windsurf.com/windsurf/cascade/skills)明确了两个路径，**它们不同构**：

| 范围 | 路径 |
|---|---|
| 项目级 | `.windsurf/skills/<skill-name>/` |
| 用户级（全局） | `~/.codeium/windsurf/skills/<skill-name>/` |

用户级在 `~/.codeium/` 下而不是 `~/.windsurf/` 下 —— 这点反直觉，是我们之前搞错的地方。

自动发现，无需配置。Cascade 采用渐进式披露：默认只把 skill 的 name 和 description 交给模型，决定调用时才加载 SKILL.md 全文，所以装 20 个不会造成常驻开销。

### 跨工具发现

官方还写明 Windsurf 会扫 `.agents/skills/` 与 `~/.agents/skills/`；若开启了读取 Claude Code 配置，`.claude/skills/` 与 `~/.claude/skills/` 也会被扫描。

也就是说：**如果你已经为 Antigravity（`.agents/skills`）或 Claude Code 装过，Windsurf 其实已经能读到**，不必重复装 —— 否则会加载两份。

## Skill 加载优先级

| 位置 | 优先级 | 说明 |
|------|--------|------|
| `.windsurf/skills/` | 最高 | 项目级，仅当前项目 |
| `~/.windsurf/skills/` | 中 | 用户级，所有项目共享 |

## 使用

安装完成后重启 Windsurf，skills 会自动生效。

也可以在 `.windsurfrules` 文件中引用 skills 目录：

```
请参考 .windsurf/skills/ 目录中的 SKILL.md 文件作为工作方法论。
```

## 故障排查

### Skills 未生效

1. 确认 `.windsurf/skills/` 目录存在且包含 skill 文件夹
2. 每个 skill 需要包含有效 YAML frontmatter 的 `SKILL.md` 文件
3. 重启 Windsurf

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- 项目主页：https://github.com/jnMetaCode/superpowers-zh
- Windsurf 文档：https://docs.windsurf.com/windsurf/cascade/memories
