# Cline 工具映射

技能使用 Claude Code 的工具名称。当你在技能中遇到这些工具时，使用你平台的等价工具：

| 技能中引用的工具 | Cline 等价工具 |
|-----------------|---------------|
| `Read`（读取文件） | `read_files` |
| `Write`（创建文件） | `write_to_file` |
| `Edit`（编辑文件） | `replace_in_file` / `apply_patch` |
| `Bash`（运行命令） | `execute_command` |
| `Grep`（搜索文件内容） | `search_files` |
| `Glob`（按名称搜索文件） | `search_files` |
| `Task` 工具（分派子智能体） | `delegate` / `new_task` |
| 多个 `Task` 调用（并行） | 多个 `delegate` / `new_task` 调用 |
| `AskUserQuestion` | `ask_followup_question` |
| `WebFetch` | `web_search` / `url_screenshot` |
| `WebSearch` | `web_search` |
| `AttemptComplete` | `attempt_completion` |
| `TodoWrite`（任务跟踪） | `list_tasks` / `set_task_done` |
| `EnterPlanMode` / `ExitPlanMode` | Cline 内建 Plan/Act 模式切换 |

## 智能体类型

Cline 的 `delegate` / `new_task` 支持为子任务分配不同角色，利用 `mode` 参数控制行为：

| 模式 | 用途 |
|------|------|
| `plan` | 探索代码库、提问、出方案 |
| `act` | 执行具体代码变更（默认） |

## 异步操作

Cline 的 `execute_command` 支持 `requiresApproval` 策略配置。长期运行的命令（如 dev server）可通过 `autoApprove` 控制是否需要人工确认。

## 额外的 Cline 能力

| 能力 | 用途 |
|------|------|
| `.clinerules/` 目录 | Cline 自动加载此目录下所有 `.md` 文件作为项目规则 |
| `AGENTS.md` | 跨工具标准指令文件（Cline 会递归搜索） |
| `ask_followup_question` | 向用户提问获取澄清 |
| `attempt_completion` | 完成任务并输出结果摘要 |
| Plan/Act 模式 | Plan 模式下只探索和提问，不执行写操作 |
