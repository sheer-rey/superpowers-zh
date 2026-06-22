# Superpowers 中文版 — Cline 安装指南

在 [Cline](https://cline.bot)（开源 AI 编码助手，支持 VS Code / JetBrains / CLI）中使用 superpowers-zh 的完整指南。

## 自动安装

```bash
cd /your/project
npx superpowers-zh
```

安装脚本会自动检测 `.clinerules/` 或 `.cline/` 目录并：

1. 把 20 个 skills 复制到 `.cline/skills/<name>/SKILL.md`
2. 生成 bootstrap rule 到 `.clinerules/superpowers-zh.md`

如果项目目录里还没有 `.clinerules/`，可以显式指定：

```bash
npx superpowers-zh --tool cline
```

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
cp -r superpowers-zh/skills /your/project/.cline/skills
mkdir -p /your/project/.clinerules
cp superpowers-zh/.clinerules/superpowers-zh.md /your/project/.clinerules/
```

## 工作原理

Cline 通过以下方式加载配置：

| 方式 | 文件/目录 | 说明 |
|------|----------|------|
| Rules | `.clinerules/` 目录下的所有 `.md` 文件 | 自动加载，每个会话生效 |
| Skills | `.cline/skills/<name>/SKILL.md` | 按需读取 |
| 跨工具指令 | `AGENTS.md`（项目根） | Cline 递归向上搜索 |
| 全局配置 | `~/.clinerules/` | 影响所有项目 |

### 文件结构

```
your-project/
├── .clinerules/
│   └── superpowers-zh.md          # bootstrap：核心规则 + skill 索引（自动生成）
├── .cline/
│   └── skills/
│       ├── brainstorming/
│       │   └── SKILL.md
│       ├── test-driven-development/
│       │   └── SKILL.md
│       └── ...                    # 其他 18 个 skills
└── AGENTS.md                      # 可选：跨工具指令
```

## 使用

1. 安装完成后重启 Cline
2. Cline 会在每个会话自动加载 `.clinerules/superpowers-zh.md` 中的规则
3. 遇到任务时，先检查是否有匹配的 skill
4. 按需读取 `.cline/skills/<skill-name>/SKILL.md` 并遵循其流程

### Plan / Act 模式

Cline 支持 Plan 和 Act 两种模式：

- **Plan 模式**：探索代码库、提问、设计方案 —— 不执行任何写操作
- **Act 模式**：执行代码变更、运行命令

superpowers-zh 的 brainstorming skill 天然适配 Plan 模式：先在 Plan 模式下做需求分析和设计，确认后再切换到 Act 模式实现。

### 手动触发 Skill

由于 Cline 没有专有的 `Skill` 工具，在对话中显式说明 skill 名称即可，例如：

> "请使用 brainstorming skill 分析这个需求"
> "按照 test-driven-development skill 来开发"

## 工具映射说明

skills 中引用的 Claude Code 工具名称对应 Cline 的等价工具：

| Claude Code | Cline |
|-------------|-------|
| `Read` | `read_files` |
| `Write` | `write_to_file` |
| `Edit` | `replace_in_file` / `apply_patch` |
| `Bash` | `execute_command` |
| `Grep` / `Glob` | `search_files` |
| `Task`（子 agent） | `delegate` / `new_task` |
| `AskUserQuestion` | `ask_followup_question` |
| `TodoWrite` | `list_tasks` / `set_task_done` |
| `WebFetch` / `WebSearch` | `web_search` / `url_screenshot` |
| `AttemptComplete` | `attempt_completion` |

> Skill 是工作方法论，不是工具实现 —— 即使工具名略有差异，模型也会自动选用最近似的 Cline 工具完成。无需为 Cline 重写 skill。

## 局限性

Cline 没有 Claude Code 的 `Skill` 专用工具，以下功能略有差异：

- 技能无法通过 `Skill` 命令自动加载 —— 需通过 `.clinerules/` 规则或手动告知
- 没有 `TodoWrite` 等价工具 —— 可用 `list_tasks` / `set_task_done` 替代
- Git Worktree 相关 skill 需借助 Cline 的 `execute_command` 在终端中操作
- 子 Agent 派遣通过 `delegate` / `new_task` 实现，行为略有不同

方法论类 skills（头脑风暴、TDD、调试、代码审查等）完全兼容。

## 故障排查

### Skills 未生效

1. 确认 `.cline/skills/<skill-name>/SKILL.md` 文件存在且 frontmatter 完整
2. 确认 `.clinerules/superpowers-zh.md` 存在
3. 重启 Cline 后测试

### Cline 没有自动加载规则

Cline 自动加载 `.clinerules/` 目录下所有 `.md` 文件，无需额外配置。如果没生效，检查：

```bash
ls -la .clinerules/
ls -la .cline/skills/
```

确保 `.clinerules/` 是**目录**而非文件。Cline 同时支持 `.clinerules` 文件和目录，但目录模式更推荐。

## 卸载

```bash
cd /your/project
npx superpowers-zh --uninstall
```

会移除 `.cline/skills/` 目录下所有 superpowers-zh 装的 skill 文件夹（保留你自己写的），并删除 `.clinerules/superpowers-zh.md`。

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- 项目主页：https://github.com/jnMetaCode/superpowers-zh
- Cline 官方文档：https://docs.cline.bot/
- Cline GitHub：https://github.com/cline/cline
