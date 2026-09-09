# Superpowers 中文版 — TRAE CN（国内版）安装指南

TRAE 分**国际版**（[trae.ai](https://www.trae.ai)）与**国内版 TRAE CN**（[trae.cn](https://www.trae.cn)）。两版的**项目级**技能目录相同，**全局**目录不同 —— 这份文档讲的是差异部分。

## 一句话

| 想要什么 | 命令 | 装到哪 |
|---|---|---|
| 项目级（两版通用） | `npx superpowers-zh --tool trae` | `.trae/skills/` |
| 全局（**仅国内版**） | `npx superpowers-zh --global --tool traecn` | `~/.trae-cn/skills/` |

## 为什么全局要单独一条命令

[TRAE CN 官方文档「技能所在目录」](https://docs.trae.cn/ide/skills) 写明：

> 全局技能：macOS/Linux `~/.trae-cn/skills`，Windows `%userprofile%/.trae-cn/skills`
>
> 项目技能：项目所在路径下的 `.trae/skills/` 目录

注意全局目录是 **`.trae-cn`**，不是 `.trae` —— 差这一个后缀，装进去 TRAE 就永远不会扫到。

而[国际版文档](https://docs.trae.ai/ide/skills)**没有给出全局技能的磁盘路径**。按本项目一贯口径：**没有一手出处就不猜路径**，所以国际版不提供全局安装，请用项目级。

（`%userprofile%` 就是用户主目录，所以 Windows 与 macOS/Linux 在「主目录下的 `.trae-cn/skills`」这一点上是同构的，安装器不需要为它单独处理平台差异。）

## 项目级为什么两版共用一条命令

两版的项目级路径都是 `.trae/skills/`，所以 `--tool trae` 一条覆盖两版。

如果你对 `TRAE CN` 用项目级安装，安装器会**明确拒绝**并告诉你该用哪条命令，而不是装到一个可能不生效的地方：

```
❌ TRAE CN 不支持项目级安装。

  TRAE CN 的项目级技能目录与国际版 TRAE 相同（.trae/skills/），
  已经由 Trae 这一条覆盖，请直接用：
    npx superpowers-zh --tool trae
  本条目只用于 TRAE CN 独有的**全局**目录（~/.trae-cn/skills）。
```

## 自动触发

- **项目级**安装会同时写 `.trae/rules/superpowers-zh.md`，skill 因此能自动触发。
- **全局**安装只放 skill 文件，不写规则文件 —— TRAE CN 文档没有给出全局规则文件的确切路径，不确认就不写。所以全局装完需要在对话里显式点名 skill，或者改用项目级安装。

## 卸载

```bash
npx superpowers-zh --global --uninstall --tool traecn   # 清 ~/.trae-cn/skills
npx superpowers-zh --uninstall --tool trae              # 清 .trae/skills + .trae/rules
```

## 别名

`traecn`、`trae-cn`、`trae-china` 三个都指向同一个目标。

## 来源

- [TRAE CN 技能文档 · docs.trae.cn/ide/skills](https://docs.trae.cn/ide/skills) —— 全局与项目级路径（核对日期 2026-09-08）
- [TRAE 国际版技能文档 · docs.trae.ai/ide/skills](https://docs.trae.ai/ide/skills) —— 只给出 `.trae/skills/`，无全局路径

相关 issue：[#35 建议支持 Trae CN](https://github.com/jnMetaCode/superpowers-zh/issues/35)
