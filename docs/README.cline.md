# Superpowers 中文版 — Cline 安装指南

在 [Cline](https://cline.bot)（VS Code AI 编程扩展）中使用 superpowers-zh 的完整指南。

## 快速安装

```bash
cd /your/project
npx superpowers-zh --tool cline
```

自动检测：安装脚本发现项目里有 `.clinerules/` 目录时也会自动装 Cline。**如果你还没建过 rules，就用上面的 `--tool cline` 显式指定。**

装完会得到两样东西：

```
.cline/skills/            # 20 个 skill 本体，按需读取
.clinerules/
└── superpowers-zh.md     # 一份小索引，常驻 system prompt
```

## 工作原理（和其他工具不一样，值得读一下）

Cline 没有「skills」概念，它加载的是 **Rules**：`.clinerules/` 目录下所有 `.md` / `.txt` 会被**合并进每一轮的 system prompt**。

这跟 skills 的懒加载完全不同 —— 所以**绝不能把 20 个 SKILL.md 直接放进 `.clinerules/`**，那会让每轮对话都背着几万字的常驻开销，Cline 官方也提示规则超过约 300 行后遵守度会下降。

superpowers-zh 的做法：

| 放哪 | 内容 | 何时进 prompt |
|------|------|--------------|
| `.clinerules/superpowers-zh.md` | 核心规则 + 20 个 skill 的名称/触发条件索引表 | 每轮常驻（很小） |
| `.cline/skills/<name>/SKILL.md` | skill 完整流程正文 | 仅当任务匹配、Cline 主动读取时 |

索引 rule 里明确告诉 Cline：匹配到触发条件就去读对应的 `SKILL.md`，**不要**把正文抄进 rules。

### 为什么不写 YAML frontmatter

Cline 目前只支持 `paths`（glob 数组）一个条件字段。不写 frontmatter 就是「始终生效」，正是我们要的效果，所以索引 rule 是纯 Markdown。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p /your/project/.cline/skills /your/project/.clinerules
cp -r superpowers-zh/skills/* /your/project/.cline/skills/
```

然后在 `.clinerules/superpowers-zh.md` 里手写一份索引（内容参考 `npx` 装出来的那份）。**推荐直接用 `npx`** —— 索引表是根据 skills 的 frontmatter 自动生成的，手写容易漏。

## 关于全局安装

`--global` 对 Cline **不支持**。Cline 的全局 rules 目录随操作系统变化：

- macOS / Linux：`~/Documents/Cline/Rules`
- Windows：`Documents\Cline\Rules`
- Linux / WSL 有时是 `~/Cline/Rules`

没有一条稳定路径能让通用 `--global` 可靠命中，写错等于「装了不生效」，所以宁可不做。请用项目级安装。想全局用的话，把 `npx` 生成的那份 `superpowers-zh.md` 手动拷进你系统上实际的 Cline 全局 rules 目录即可。

## 使用

装好后新开一个 Cline 会话（rules 在会话开始时加载）。然后正常提需求即可：

- 「给用户模块加个批量导出功能」→ 应当先触发 brainstorming 做需求澄清，而不是直接写代码
- 也可以手动点名：「用 test-driven-development skill 做这个」

## 更新 / 卸载

```bash
npx superpowers-zh --tool cline      # 更新（覆盖式，幂等）
npx superpowers-zh --uninstall       # 卸载，同时清掉 .clinerules/superpowers-zh.md
```

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- Cline Rules 文档：https://docs.cline.bot/customization/cline-rules
