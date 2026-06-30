---
name: chinese-git-workflow
description: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
version: "1.0.0"
license: MIT
metadata:
  hermes:
    tags: [git, chinese]
---

# 国内 Git 工作流规范

## 概述

国内团队用 Git 经常踩的坑：GitHub 访问不稳定、CI/CD 方案照搬国外水土不服、commit message 中英混杂没有规范。本技能提供一套**完整适配国内平台和团队习惯的 Git 工作流**。

**核心原则：** 工作流服务于团队效率，不是为了流程而流程。选适合团队规模的，别硬套大厂方案。

## 国内 Git 平台适配

### 平台对比

| 特性 | Gitee | Coding.net | 极狐 GitLab | CNB | GitHub |
|------|-------|------------|-------------|-----|--------|
| 国内访问 | 快 | 快 | 快 | 快 | 不稳定 |
| 免费私有仓库 | 有 | 有 | 有 | 有 | 有 |
| CI/CD | Gitee Go | Coding CI | 内置 GitLab CI | 内置（.cnb.yml） | GitHub Actions |
| 代码审查 | PR | MR | MR | MR | PR |
| 制品库 | 有限 | 完整 | 完整 | 完整 | Packages |
| 适合场景 | 开源/小团队 | 中大型团队 | 企业私有化 | 云原生 / Docker 流水线 | 国际项目 |

### Gitee 特有配置

```bash
# 设置 Gitee 远程仓库
git remote add origin https://gitee.com/<org>/<repo>.git

# Gitee 的 SSH 配置
# ~/.ssh/config
Host gitee.com
    HostName gitee.com
    User git
    IdentityFile ~/.ssh/gitee_rsa
    PreferredAuthentications publickey

# 同时推送到 Gitee 和 GitHub（镜像同步）
git remote set-url --add --push origin https://gitee.com/<org>/<repo>.git
git remote set-url --add --push origin https://github.com/<org>/<repo>.git
```

### Coding.net 特有配置

```bash
# Coding 的仓库地址格式
git remote add origin https://e.coding.net/<team>/<project>/<repo>.git

# Coding 支持的 SSH 地址
git remote add origin git@e.coding.net:<team>/<project>/<repo>.git
```

### 极狐 GitLab 特有配置

```bash
# 极狐 GitLab 私有化部署常见地址格式
git remote add origin https://jihulab.com/<group>/<repo>.git

# 或者企业内部部署
git remote add origin https://gitlab.yourcompany.com/<group>/<repo>.git
```

### CNB（Cloud Native Build）特有配置

```bash
# CNB 仓库地址（仅支持 HTTPS，不提供 SSH 协议）
git remote add origin https://cnb.cool/<org>/<repo>.git

# HTTPS 认证：用户名固定为 cnb，密码为个人访问令牌（Access Token）
# 在 CNB 平台 → 个人设置 → 访问令牌 中生成
git config credential.helper store
```

## 工作流选择

### 方案一：主干开发（Trunk-Based Development）

**适合：** 小团队（2-8 人）、迭代速度快、有完善的自动化测试。

```
main ──●──●──●──●──●──●──●──●──●──
        \   /  \   /       \   /
feat/x  ●─●   ●─●    fix/y ●─●
（短命分支，1-2 天内合回）
```

**规则：**
- 主干（main）始终保持可发布状态
- 功能分支生命周期不超过 2 天
- 每天至少合并一次到主干
- 用 Feature Flag 控制未完成功能的可见性

```bash
# 从 main 拉分支
git checkout -b feat/user-login main

# 开发完成后，rebase 到最新 main
git fetch origin
git rebase origin/main

# 提交 PR/MR，合并后删除分支
```

### 方案二：Git Flow（经典分支模型）

**适合：** 中大团队、版本发布节奏固定（如双周迭代）、需要维护多个版本。

```
main     ──●────────────────●────────────── 生产环境
            \              / \
release     ●──●──●──●──●    ●──●──●──●── 发布分支
            \              /
develop  ──●──●──●──●──●──●──●──●──●──●── 开发主线
             \   /  \       /
feat/x       ●─●    ●─────●               功能分支
                      \   /
                  fix/y ●─●                修复分支
```

**分支说明：**
- `main` — 生产环境代码，只接受 release 和 hotfix 的合并
- `develop` — 开发主线，功能分支从这里拉出，合回这里
- `release/*` — 发布分支，从 develop 拉出，只修 bug 不加功能
- `feat/*` — 功能分支
- `hotfix/*` — 紧急修复，从 main 拉出，同时合回 main 和 develop

### 方案三：国内团队常用简化流程

**适合：** 大多数国内中小团队的实际情况。

```
main     ──●──────●──────●──── 生产环境（受保护）
            \    / \    /
dev      ──●──●─●──●──●─●──── 开发/测试环境
             \  /    \  /
feat/x       ●●      ●●       功能分支
```

**规则：**
- `main` 分支受保护，只能通过 PR/MR 合并
- `dev` 分支对应测试环境，自动部署
- 功能分支从 `dev` 拉出，合回 `dev`
- `dev` 测试通过后，合并到 `main` 进行发布

## 分支命名规范

### 国内团队常用命名

```bash
# 功能分支
feat/user-login              # 新功能
feat/JIRA-1234-order-refund  # 关联任务编号

# 修复分支
fix/payment-callback         # Bug 修复
fix/JIRA-5678-null-pointer   # 关联 Bug 编号

# 发布分支
release/v2.1.0               # 版本发布
release/2024-03-sprint       # 按迭代命名

# 紧急修复
hotfix/v2.0.1                # 线上紧急修复
hotfix/fix-login-crash       # 描述性命名

# 个人分支（部分团队使用）
dev/zhangsan/feat-login      # 个人开发分支
```

### 命名规则

1. 全部小写，用 `-` 连接单词（不用下划线或驼峰）
2. 前缀明确分支类型：`feat/`、`fix/`、`hotfix/`、`release/`
3. 关联任务管理平台的编号（如有）：`feat/TAPD-12345-description`
4. 长度适中，能看出分支目的即可

## Commit Message 规范

本项目使用 `commit-conventions` skill 定义完整的提交规范。核心要点如下：

### 提交格式

```
<emoji> <type>[scope]: <description>
```

- **emoji**：可选，但建议用于快速识别
- **type**：必填，小写英文关键词
- **scope**：可选，英文描述受影响的组件
- **description**：必填，英文祈使语气，不超过 100 字符

### 提交类型参考

| Emoji | 类型 | 说明 | 示例 |
| ----- | ---------- | ---------------------------------------- | -------------------------------- |
| 🎉 | `feat` | 新功能 | Add user one-click login |
| 🛠️ | `fix` | 修复缺陷 | Fix inventory overselling issue |
| 📜 | `docs` | 仅文档变更 | Update API documentation |
| 🪄 | `style` | 不影响代码行为的格式调整 | Fix indentation, add semicolons |
| 🎊 | `refactor` | 重构代码 | Split oversized service class |
| ✨ | `perf` | 提升性能的代码改进 | Optimize home page query |
| 🔎 | `test` | 添加或修复测试 | Add user module unit tests |
| 🌈 | `chore` | 构建流程、工具或库变更 | Upgrade webpack to v5 |
| ♻️ | `ci` | 持续集成配置变更 | Update GitHub Actions workflow |
| 🔙 | `revert` | 回滚提交 | Revert previous feature commit |

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

### 正文编写

正文应详细说明变更的动机、实现方式和影响范围：

```
<Background and reason for change>

Approach:
- <Key approach point 1>
- <Key approach point 2>

Affected Components: <List affected modules or services>
```

### Revert 提交

格式固定为 `revert: <回退的提交标题>`，正文需说明回滚原因，footer 可添加引用：

```
🔙 revert[scope]: Revert "<回退的提交标题>"

<回滚原因>

Refs: <原始提交的 hash 或 issue>
```

### 破坏性变更

推荐使用**方法三**：同时使用 `!` 和 `BREAKING CHANGE` footer

```
🎉 feat[api]!: Restructure user info response

Change the user API response from flat structure to nested structure.
Frontend teams need to update field access paths accordingly.

BREAKING CHANGE: /api/user/info response structure changed
- avatar field moved into profile object
- Removed deprecated nickname field, use displayName instead
```

### Issue 引用

```
Closes #128
Refs #129, #130
Resolves #131
```

> **完整规范**：运行 `/commit-conventions` 获取详细说明，包括 commitlint 配置、husky 集成、changelog 自动生成等。

## CI/CD 平台适配

### Gitee Go

```yaml
# .gitee/pipelines/pipeline.yml
name: 构建与测试
displayName: '构建与测试流水线'

triggers:
  push:
    branches:
      include:
        - main
        - dev

stages:
  - name: 测试
    jobs:
      - name: 单元测试
        steps:
          - step: npmbuild@1
            name: install_and_test
            displayName: '安装依赖并执行测试'
            inputs:
              nodeVersion: 20
              commands:
                - npm ci
                - npm test
```

### Coding CI

```groovy
// Jenkinsfile（Coding CI 支持 Jenkinsfile 语法）
pipeline {
    agent any

    stages {
        stage('安装依赖') {
            steps {
                sh 'npm ci'
            }
        }

        stage('单元测试') {
            steps {
                sh 'npm test'
            }
        }

        stage('构建') {
            steps {
                sh 'npm run build'
            }
        }

        stage('部署到测试环境') {
            when {
                branch 'dev'
            }
            steps {
                sh './scripts/deploy-staging.sh'
            }
        }

        stage('部署到生产环境') {
            when {
                branch 'main'
            }
            steps {
                sh './scripts/deploy-production.sh'
            }
        }
    }

    post {
        failure {
            // 企业微信/钉钉通知
            sh './scripts/notify-failure.sh'
        }
    }
}
```

### 极狐 GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  NODE_IMAGE: node:20-alpine
  # 使用国内镜像加速
  NPM_REGISTRY: https://registry.npmmirror.com

单元测试:
  stage: test
  image: $NODE_IMAGE
  script:
    - npm config set registry $NPM_REGISTRY
    - npm ci
    - npm test
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'

构建:
  stage: build
  image: $NODE_IMAGE
  script:
    - npm config set registry $NPM_REGISTRY
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/

部署测试环境:
  stage: deploy
  script:
    - ./scripts/deploy-staging.sh
  only:
    - dev
  environment:
    name: staging

部署生产环境:
  stage: deploy
  script:
    - ./scripts/deploy-production.sh
  only:
    - main
  environment:
    name: production
  when: manual  # 生产环境手动触发
```

### CNB（Cloud Native Build）

```yaml
# .cnb.yml — branch-first 结构，直接指定 Docker 镜像跑流水线
main:
  push:
    - docker:
        image: node:20
      stages:
        - npm ci
        - npm test
        - npm run build
  pull_request:
    - docker:
        image: node:20
      stages:
        - npm run lint
        - npm test
```

**特点：**
- 每个流水线独立指定 Docker 镜像，天然云原生
- 支持 `push` / `pull_request` 触发
- 同一事件可并行多条流水线
- `stages` 也支持 `- name: xxx` + `script:` 的展开形式，复杂场景见官方文档

### GitHub Actions 国内替代方案对照

| GitHub Actions 功能 | Gitee Go | Coding CI | 极狐 GitLab CI | CNB |
|---------------------|----------|-----------|----------------|-----|
| 触发条件 | triggers | Jenkinsfile triggers | only/rules | push / pull_request |
| 缓存依赖 | cache step | stash/unstash | cache | 见官方文档 |
| 制品存储 | artifacts | 制品库 | artifacts | 见官方文档 |
| 环境变量 | env | environment | variables | env |
| 密钥管理 | 环境变量配置 | 凭据管理 | CI/CD Variables | Access Token |
| 手动触发 | 手动运行 | 手动触发 | when: manual | 页面手动运行 |

## PR/MR 描述模板

### 中文模板

在仓库中创建 PR/MR 模板文件：

**Gitee：** `.gitee/PULL_REQUEST_TEMPLATE.md`

**Coding / GitLab：** `.gitlab/merge_request_templates/default.md`

```markdown
## 变更说明

<!-- 简要描述这次改动做了什么，解决了什么问题 -->

## 变更类型

- [ ] 新功能（feat）
- [ ] Bug 修复（fix）
- [ ] 重构（refactor）
- [ ] 性能优化（perf）
- [ ] 文档更新（docs）
- [ ] 其他：

## 关联信息

- 需求/Bug 链接：
- 设计文档：

## 改动范围

<!-- 列出主要改动的模块和文件 -->

## 测试情况

- [ ] 单元测试通过
- [ ] 手动测试通过
- [ ] 相关模块回归测试通过

## 测试方法

<!-- 描述如何验证这次改动 -->

## 影响范围

<!-- 这次改动可能影响哪些功能？是否需要通知其他团队？ -->

## 部署注意事项

- [ ] 需要执行数据库迁移
- [ ] 需要更新配置文件
- [ ] 需要更新环境变量
- [ ] 无特殊注意事项

## 截图/录屏

<!-- 如果涉及 UI 变更，贴截图或录屏 -->
```

## 常用 Git 配置

### 国内环境优化

```bash
# 设置用户信息
git config --global user.name "张三"
git config --global user.email "zhangsan@company.com"

# commit message 编辑器设置为 VS Code
git config --global core.editor "code --wait"

# 解决中文文件名显示为转义字符的问题
git config --global core.quotepath false

# 设置默认分支名
git config --global init.defaultBranch main

# 代理设置（如果需要同时使用 GitHub）
git config --global http.https://github.com.proxy socks5://127.0.0.1:7890

# NPM 使用国内镜像
npm config set registry https://registry.npmmirror.com
```

### .gitignore 国内项目常见配置

```gitignore
# IDE
.idea/
.vscode/
*.swp

# 依赖
node_modules/
vendor/

# 构建产物
dist/
build/
*.exe

# 环境配置
.env
.env.local
.env.*.local

# 系统文件
.DS_Store
Thumbs.db
desktop.ini

# 国内平台特有
.coding/
```

## 检查清单

在推送代码前，确认：

- [ ] 分支命名符合团队规范
- [ ] commit message 格式正确，类型和范围准确
- [ ] 关联了对应的需求/Bug 编号
- [ ] PR/MR 描述填写完整
- [ ] CI 流水线通过
- [ ] 已请求相关同事 Review
