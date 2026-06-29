---
name: commit-conventions
description: 提供提交信息和 changelog 规范指南 — 包括 Conventional Commits 适配、commitlint/husky/commitizen 模板以及 conventional-changelog 配置。仅在用户显式 /commit-conventions 时调用，不要根据上下文自动触发。
version: "1.0.0"
license: MIT
metadata:
  hermes:
    tags: [git, commit]
---

# Commit Conventions

## 1. Conventional Commits 适配

本文档为团队工作流提供 Conventional Commits 1.0.0 规范的实践指导，涵盖提交模板、commitlint 和 husky 配置，以及自动生成 changelog 的方案。

### 提交类型参考

| Emoji | 类型        | 说明                                    | 示例                              |
| ----- | ---------- | ---------------------------------------- | -------------------------------- |
| 🎉    | `feat`     | 新功能                                   | Add user one-click login         |
| 🛠️    | `fix`      | 修复缺陷                                 | Fix inventory overselling issue  |
| 📜    | `docs`     | 仅文档变更                               | Update API documentation         |
| 🪄    | `style`    | 不影响代码行为的格式或风格调整             | Fix indentation, add semicolons  |
| 🎊    | `refactor` | 重构代码（非 feat、非 fix）               | Split oversized service class    |
| ✨    | `perf`     | 提升性能的代码改进                        | Optimize home page query         |
| 🔎    | `test`     | 添加或修复测试                           | Add user module unit tests        |
| 🌈    | `chore`    | 构建流程、工具或库相关变更                | Upgrade webpack to v5             |
| 🔄    | `ci`       | 持续集成配置变更                          | Update GitHub Actions workflow   |
| ⏪    | `revert`   | 回滚提交                                 | Revert previous feature commit   |

### 基本原则

- 提交类型必须使用小写英文关键词（例如 `feat`、`fix`），以确保工具链兼容
- emoji 前缀可选，但建议用于提升视觉识别度
- scope（括号内内容）用英文描述受影响的组件
- 标题行格式为 `<emoji> <type>[scope]: <description>`（最长 100 字符）
- 主体描述建议使用英文祈使句（例如 "Add"、"Fix"、"Update"）
- 如需补充说明，正文需提供英文详细解释

## 2. 提交信息模板

```
🎉 feat[scope]: description
🛠️ fix[scope]: description
📜 docs[scope]: description
🪄 style[scope]: description
🎊 refactor[scope]: description
✨ perf[scope]: description
🔎 test[scope]: description
🌈 chore[scope]: description
🔄 ci[scope]: description
⏪ revert[scope]: description

Detailed explanation (optional)

1. Details...
2. Details...
```

### 完整示例

```
🎉 feat[auth]: Add one-click login via carrier operators

Integrate carrier one-click login SDK to support:
- China Mobile, China Unicom, China Telecom networks
- Automatic fallback to SMS verification if login fails
- Support for both iOS and Android

Closes #128
```

```
🛠️ fix[order]: Fix inventory overselling in concurrent orders

The original inventory deduction logic had a race condition under high concurrency.
Implemented double guarantee using Redis distributed lock + database optimistic lock.

Tested with 500 concurrent load test to verify fix.

Closes #256
```

## 3. 标题行规则

### 格式

```
<emoji> <type>[scope]: <description>
```

### 规则

- **emoji**：可选，但建议用于快速识别
- **type**：必填，必须为下列之一：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`
- **scope**：可选，建议使用英文描述受影响的组件或模块
  - 示例：`auth`、`payment`、`inventory`、`ui-components`
- **description**：必填。建议使用英文祈使语气，且不超过 100 字符
  - 使用动词："Add"、"Fix"、"Update"、"Optimize"、"Remove"
  - 不要在末尾加句号
  - 避免模糊表达，例如 "update code" 或 "minor fix"

### 好的示例

```
🎉 feat[auth]: Add role-based access control (RBAC)
🛠️ fix[payment]: Fix WeChat payment callback signature verification
✨ perf[list]: Optimize virtual scrolling for large data tables
🎊 refactor[gateway]: Split monolithic gateway into independent microservices
```

### 不推荐的示例

```
# Do not follow these patterns
fix: Fix a bug
feat: Update code
chore: Modify some stuff
```

## 4. 正文编写指南

正文应详细说明变更的动机、实现方式和影响范围。

### 关键点

- 说明为什么需要这次变更（背景/原因）
- 说明如何实现（技术方案概要）
- 描述受影响的内容（哪些模块、API、服务）
- 每行长度保持在 100 字符以内
- 标题行与正文之间留空行
- 使用清晰、简洁的英文（如果正文为英文）

### 正文模板

```
<Background and reason for change>

Approach:
- <Key approach point 1>
- <Key approach point 2>

Affected Components: <List affected modules or services>
```

## 5. 破坏性变更

当提交包含破坏性变更时，必须在 footer 位置明确标记。

### 方法一：footer 注释

```
🎉 feat[api]: Restructure user info response

Change the user API response from flat structure to nested structure.
Frontend teams need to update field access paths accordingly.

BREAKING CHANGE: /api/user/info response structure changed
- avatar field moved into profile object
- Removed deprecated nickname field, use displayName instead
```

### 方法二：type 后加感叹号

```
🎉 feat[api]!: Restructure user info response
```

### 方法三：footer 注释 + type 后感叹号（推荐）

同时使用 `!` 和 `BREAKING CHANGE` footer，兼顾工具链解析与人类可读性。
这是**默认推荐方法**。

```
🎉 feat[api]!: Restructure user info response

Change the user API response from flat structure to nested structure.
Frontend teams need to update field access paths accordingly.

BREAKING CHANGE: /api/user/info response structure changed
- avatar field moved into profile object
- Removed deprecated nickname field, use displayName instead
```

### 团队指南

- **数据库 schema 变更** → 必须标记为 BREAKING CHANGE
- **公共 API 参数/返回值变更** → 必须标记
- **配置文件格式变更** → 必须标记
- 标记时应提供迁移路径或升级说明

## 6. Revert 提交规范

Revert 提交用于回滚之前的提交。格式固定为 `revert: <回退的提交标题>`，正文需说明回滚原因，footer 可添加引用信息。

### 格式

```
⏪ revert[scope]: Revert "<回退的提交标题>"

<回滚原因>

Refs: <原始提交的 hash 或 issue>
```

### 示例

```
⏪ revert[auth]: Revert "feat[auth]: Add one-click login via carrier operators"

The carrier SDK integration introduced a critical bug where SMS fallback
failed silently on iOS devices, blocking users from logging in.

Refs: abc1234
Closes #129
```

```
⏪ revert[order]: Revert "fix[order]: Fix inventory overselling in concurrent orders"

The Redis distributed lock implementation caused deadlocks under
production load, resulting in order processing failures.

Refs: def5678
```

### 团队指南

- **必须回滚** → 使用 revert 类型，不要直接修改回滚
- **正文** → 清晰说明回滚原因（什么 bug、什么影响）
- **footer** → 使用 `Refs:` 引用原始提交的 hash 或 issue
- **scope** → 与原始提交保持一致

## 7. Issue 引用

### GitHub 格式

```
Closes #128
Refs #129, #130
Resolves #131
```

### Gitee 格式

```
Closes #I5ABC1
Related Issue: https://gitee.com/org/repo/issues/I5ABC1
```

### Coding 格式

```
Linked to Coding issue #12345
fixed=project-2024/issues/678
```

### 多平台引用

```
# Reference issues across multiple platforms
Closes #128
Jira: PROJ-456
Zentao: #789
```

## 8. 自动生成 Changelog

### 安装 conventional-changelog

```bash
npm install -D conventional-changelog-cli conventional-changelog-conventionalcommits
```

### package.json 脚本

```json
{
  "scripts": {
    "changelog": "conventional-changelog -p conventionalcommits -i CHANGELOG.md -s",
    "changelog:all": "conventional-changelog -p conventionalcommits -i CHANGELOG.md -s -r 0",
    "release": "standard-version"
  }
}
```

### .versionrc.js 配置

```javascript
module.exports = {
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'docs', section: 'Documentation' },
    { type: 'style', section: 'Code Style', hidden: true },
    { type: 'refactor', section: 'Code Refactoring' },
    { type: 'perf', section: 'Performance' },
    { type: 'test', section: 'Tests' },
    { type: 'chore', section: 'Build/Tools', hidden: true },
    { type: 'ci', section: 'CI/CD', hidden: true },
    { type: 'revert', section: 'Reverts', hidden: false }
  ],
  commitUrlFormat: '{{host}}/{{owner}}/{{repository}}/commit/{{hash}}',
  compareUrlFormat: '{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}'
}
```

## 9. commitlint 配置

### 安装

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

### commitlint.config.js

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'ci', 'revert'
    ]],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-max-length': [2, 'always', 100],
    'subject-case': [0],
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [1, 'always', 200],
    'footer-max-line-length': [1, 'always', 200]
  },
  prompt: {
    messages: {
      type: 'Select commit type:',
      scope: 'Enter affected scope (optional):',
      subject: 'Enter short description:',
      body: 'Enter detailed description (optional, use "|" for line breaks):',
      breaking: 'List breaking changes (optional):',
      footer: 'Link to issues (optional, e.g., #123):',
      confirmCommit: 'Confirm commit above?'
    }
  }
}
```

## 10. husky + lint-staged 集成

### 安装与初始化

```bash
npm install -D husky lint-staged
npx husky init
```

### 配置 commit-msg 钩子

```bash
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

### 配置 pre-commit 钩子

```bash
# .husky/pre-commit
npx lint-staged
```

### lint-staged 配置（package.json）

```json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx,vue}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,scss,less}": [
      "stylelint --fix",
      "prettier --write"
    ],
    "*.md": [
      "prettier --write"
    ]
  }
}
```

### 交互式提交（可选）

```bash
npm install -D commitizen cz-conventional-changelog

# Add to package.json
{
  "config": {
    "commitizen": {
      "path": "cz-conventional-changelog"
    }
  },
  "scripts": {
    "commit": "cz"
  }
}
```

Run `npm run commit` to start interactive commit guide.

## 11. 团队检查清单

### 提交前检查

- [ ] 提交类型是否正确选择（feat/fix/docs/...）？
- [ ] scope 是否准确描述受影响的组件？
- [ ] 标题行是否使用祈使语气且不超过 100 字符？
- [ ] 标题行末尾是否没有句号？
- [ ] 正文是否解释了变更的原因与实现方案？
- [ ] 是否将破坏性变更标注为 BREAKING CHANGE？
- [ ] 是否关联了相关问题？
- [ ] 提交是否为单一逻辑变更（具备原子性）？

### 团队实施步骤

1. **配置工具链**：按照上述说明配置 commitlint + husky
2. **共享模板**：将 `.commitlintrc`、`.husky/` 配置提交到仓库
3. **团队培训**：举行 15 分钟会议讲解规范并演示工具
4. **代码评审**：在评审时检查提交信息质量
5. **持续改进**：每季度审查规范遵从情况，并根据反馈调整

### 常见问题

**Q: scope 应该使用英文还是本地化？**
A: 为了与工具链和自动化系统兼容，建议统一使用英文作为 scope。

**Q: 如何确保多人协作时的一致性？**
A: 借助自动化工具而非手动约束。配置 husky + commitlint 拒绝不合规的提交。
