# Superpowers 中文版 — Kilo Code 安装指南

在 [Kilo Code](https://kilo.ai)（VS Code AI 编程扩展 / CLI）中使用 superpowers-zh 的完整指南。

## 快速安装

```bash
cd /your/project
npx superpowers-zh --tool kilocode
```

自动检测：项目里存在 `.kilocode/`、`.kilo/` 或 `kilo.jsonc` 任一时会自动装 Kilo Code。

装完会得到：

```
.kilocode/skills/         # 20 个 skill 本体，按需读取
.kilocode/rules/
└── superpowers-zh.md     # 一份小索引，自动生效
```

## 工作原理

Kilo Code 加载的是 **Rules**（规则会并入 system prompt），不是懒加载的 skills。所以和 Cline 同理：**不能把 20 个 SKILL.md 直接塞进 rules 目录**，否则每轮对话都背着巨大的常驻开销。

superpowers-zh 的做法：

| 放哪 | 内容 | 何时进 prompt |
|------|------|--------------|
| `.kilocode/rules/superpowers-zh.md` | 核心规则 + 20 个 skill 的索引表 | 常驻（很小） |
| `.kilocode/skills/<name>/SKILL.md` | skill 完整流程正文 | 仅当任务匹配、Kilo 主动读取时 |

## 为什么用 `.kilocode/rules/` 而不是新版的 `kilo.jsonc`

Kilo Code 从 Roo 衍生的 v5 迁到了基于 OpenCode 的 v7，配置方式变了：

| | 旧（v5 及兼容路径） | 新（v7 推荐） |
|---|---|---|
| 规则目录 | `.kilocode/rules/` | `.kilo/rules/` |
| 是否需要登记 | **不需要，自动生效** | **需要**，要把路径写进 `kilo.jsonc` 的 `instructions` 数组 |

我们选 `.kilocode/rules/`，原因是**不改你的 `kilo.jsonc`**：

1. 官方明确 `.kilocode/rules/` 向后兼容，无需任何配置即生效；
2. `kilo.jsonc` 是带注释的 JSONC，安装脚本要安全合并它很容易把你的配置改坏；
3. 那是你的配置文件，装个 skills 框架不该动它。

### 如果你想迁到 v7 的方式

手动加一行即可（把现有规则文件挪到 `.kilo/rules/` 并登记）：

```jsonc
{
  "instructions": [".kilo/rules/superpowers-zh.md"]
}
```

改完 `kilo.jsonc` 后**新开一个会话**才会生效。

> ⚠️ 需要说明的是：`.kilocode/rules/` 的兼容性来自官方文档中「现有规则会继续工作」的表述。若你在 v7 上装完发现索引 rule 没被加载，按上面的方式迁到 `.kilo/rules/` + `kilo.jsonc`，并欢迎来 issue 里反馈，我们会据此调整默认路径。

## 手动安装

```bash
git clone https://github.com/jnMetaCode/superpowers-zh.git
mkdir -p /your/project/.kilocode/skills /your/project/.kilocode/rules
cp -r superpowers-zh/skills/* /your/project/.kilocode/skills/
```

索引 rule 建议交给 `npx` 生成 —— 它是按 skills 的 frontmatter 自动拼的，手写容易漏。

## 关于全局安装

`--global` 对 Kilo Code **不支持**：它的全局规则同样要走 `kilo.jsonc` 登记，没有「复制到某个用户级目录就生效」的通用路径。请用项目级安装。

## 更新 / 卸载

```bash
npx superpowers-zh --tool kilocode   # 更新（覆盖式，幂等）
npx superpowers-zh --uninstall       # 卸载，同时清掉 .kilocode/rules/superpowers-zh.md
```

## 获取帮助

- 提交 Issue：https://github.com/jnMetaCode/superpowers-zh/issues
- Kilo Code 自定义规则文档：https://kilo.ai/docs/customize/custom-rules
