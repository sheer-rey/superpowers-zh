# Superpowers 中文版 — Claw Code 安装指南

在 [Claw Code](https://github.com/ultraworkers/claw-code) 中使用 superpowers-zh 的完整指南。

> 📌 v1.7.10 及更早版本 **Claw Code 没有任何安装文档** —— 23 款支持工具里唯一一个。v1.7.11 补上。

## 安装

```bash
cd /your/project
npx superpowers-zh --tool claw
```

装两样东西：

| 位置 | 内容 |
|---|---|
| `.claw/skills/<name>/SKILL.md` | 20 个 skill 正文 |
| `CLAW.md` | bootstrap：核心规则 + skill 清单 |

> 📌 v1.7.10 及更早**只装 skills、不写 `CLAW.md`**。skills 能被发现，但没有引导就不会在恰当时机自动触发。v1.7.11 起补上。

## 工作原理

两处都有**源码级证据**，不是猜的：

**① Skills 目录**

claw 自己的源码（`rust/crates/plugins/src/lib.rs`）里写着：

> `claw` does not load plugin-managed skills and instead discovers skills from local roots such as `.claw/skills`, `.omc/skills`, `.agents/skills`, `~/.omc/skills`, and `~/.claude/skills/omc-learned`.

所以 `.claw/skills/` 是它的主要发现路径之一，无需配置。

**② 根指令文件**

`USAGE.md` 列出 claw 加载的根指令文件及优先级：

```
CLAUDE.md > CLAW.md > AGENTS.md
```

另外它也读 `.claw/CLAUDE.md`、`.claude/CLAUDE.md`、`.claw/instructions.md`。我们写 `CLAW.md`。

### ⚠️ 已有 CLAUDE.md 时要注意

因为优先级是 **CLAUDE.md > CLAW.md**，如果你的项目里已经有 `CLAUDE.md`（比如装过 Claude Code），它可能压过我们刚写的 `CLAW.md`，导致 skill 不自动触发。

安装器检测到这种情况会主动提示。解法是让 `CLAUDE.md` 也带上引导：

```bash
npx superpowers-zh --tool claude
```

两个文件都带引导就不会互相遮蔽。

### 装过 Antigravity 的项目不用重复装

注意上面源码里那句 —— claw 也扫 **`.agents/skills`**，而那正是我们给 Antigravity 装的目录。如果你已经跑过 `npx superpowers-zh --tool antigravity`，claw 其实已经能读到这些 skill 了，再装一次 `.claw/skills` 会让它加载两份。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p /your/project/.claw/skills
cp -r superpowers-zh/skills/* /your/project/.claw/skills/
```

> 手动复制不会生成 `CLAW.md`，skill 不会自动触发。建议优先用 `npx superpowers-zh --tool claw`。

也可以用 claw 自带的安装命令逐个装：

```bash
claw skills install /path/to/superpowers-zh/skills/brainstorming
```

装完用 `/skills list`（REPL 内）或 `claw skills --output-format json` 确认发现的 skill 名。

## 关于全局安装

`--global` 不支持。claw 的用户级 skill 根是 `~/.omc/skills` 和 `~/.claude/skills/omc-learned` —— 前者不是我们的目录约定，后者是 claw 自己学习产物的专用目录，都不适合通用 `--global` 覆盖。

想让所有项目共享，可以给 Claude Code 装全局（`npx superpowers-zh --global --tool claude`），claw 会读 `~/.claude/` 下的相关约定。

## 卸载

```bash
npx superpowers-zh --uninstall
```

删除 `.claw/skills/` 下装过的 skill，并从 `CLAW.md` 精确切除 superpowers-zh 段（保留你自己写的内容）。实测卸载后零残留。

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- Claw Code 仓库：https://github.com/ultraworkers/claw-code
