# Superpowers 中文版 — Qwen Code 安装指南

在 [Qwen Code](https://github.com/QwenLM/qwen-code) 中使用 superpowers-zh 的完整指南。

## ⚠️ 先说清楚是哪个产品

**Qwen Code 是 [`QwenLM/qwen-code`](https://github.com/QwenLM/qwen-code) 这个命令行工具**（Gemini CLI 的 fork），跑在终端里。

它**不是**通义灵码 —— 通义灵码是阿里的 IDE 插件，是另一个产品，配置路径完全不同。

> 📌 v1.7.10 及更早版本的本文档把两者写混了（标题写「Qwen Code (通义灵码)」、链接指向 `tongyi.aliyun.com`）。照着那份文档去配通义灵码是配不通的。这是我们的错误，v1.7.11 起更正。

## 安装

```bash
cd /your/project
npx superpowers-zh --tool qwen
```

全局（所有项目共享）：

```bash
npx superpowers-zh --global --tool qwen
```

装两样东西：

| 位置 | 内容 |
|---|---|
| `.qwen/skills/<name>/SKILL.md`（全局为 `~/.qwen/skills/`） | 20 个 skill 正文 |
| `QWEN.md`（全局为 `~/.qwen/QWEN.md`） | bootstrap：核心规则 + skill 清单，引导 AI 在恰当时机去读对应 SKILL.md |

> 📌 v1.7.10 及更早**只装 skills、不写 bootstrap**。skills 能被 Qwen Code 发现，但没有引导就不会在恰当时机自动触发 —— 文件在磁盘上，实际很少被调用。v1.7.11 起补上。

## 工作原理

Qwen Code 两套机制我们都用上了，各自的出处：

**① Skills —— 自动发现，无需配置**

[官方 Skills 文档](https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/)：Qwen Code 从 `~/.qwen/skills/`（个人）和 `.qwen/skills/`（项目）自动发现 skill，每个 skill 是一个含 `SKILL.md` 的子目录，走 Agent Skills 开放标准（与 Claude Code、Gemini CLI 同一套）。

**② QWEN.md —— 分层记忆，自动拼接**

Qwen Code 的分层记忆系统默认上下文文件就是 `QWEN.md`，从当前目录逐层向上到项目根、以及全局 `~/.qwen/` 都会被扫描并拼接进上下文。文件名可用 `contextFileName` 设置改，默认 `QWEN.md`。

所以 bootstrap 写在 `QWEN.md` 里，每次会话自动加载；skill 正文留在 `.qwen/skills/` 按需读取，不占常驻开销。

### 已有 QWEN.md 怎么办

**追加，不覆盖。** 我们把内容包在哨兵注释之间，你自己写的部分原样保留；卸载时只切除我们那一段。已实测：装完再卸，你的 `QWEN.md` 逐字节恢复原状。

## Skill 加载优先级

| 位置 | 范围 |
|------|------|
| `.qwen/skills/` | 项目级，仅当前项目 |
| `~/.qwen/skills/` | 用户级，所有项目共享 |

同名时项目级优先。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p /your/project/.qwen/skills
cp -r superpowers-zh/skills/* /your/project/.qwen/skills/
```

> 手动复制不会生成 `QWEN.md` bootstrap，skill 会被发现但不会自动触发。建议优先用 `npx superpowers-zh --tool qwen`。

## 使用

装好重启 Qwen Code：

- 直接描述任务，bootstrap 会引导它匹配 skill：「帮我加一个导出功能」应先触发 brainstorming 做需求分析，而不是直接写代码
- 也可以点名：「用 brainstorming 分析这个需求」
- 用 `/memory show` 可以查看当前拼接进上下文的内容，确认 bootstrap 是否被加载

## 卸载

```bash
npx superpowers-zh --uninstall            # 项目级
npx superpowers-zh --global --uninstall   # 全局
```

会删除装过的 skill 目录，并从 `QWEN.md` 中精确切除 superpowers-zh 段（保留你自己写的内容）。实测全局卸载后 `~/` 下零残留。

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- Qwen Code 仓库：https://github.com/QwenLM/qwen-code
- Qwen Code Skills 文档：https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/
- Qwen Code 记忆文档：https://qwenlm.github.io/qwen-code-docs/en/users/features/memory/
