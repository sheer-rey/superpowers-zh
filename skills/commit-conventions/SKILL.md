---
name: commit-conventions
description: Commit message and changelog conventions — Conventional Commits guidance, commitlint/husky/commitizen templates, conventional-changelog configuration. Triggered only by /commit-conventions.
version: "1.0.0"
license: MIT
metadata:
  hermes:
    tags: [git, commit]
---

# Commit Conventions

## 1. Conventional Commits adaptation

This document provides guidance on applying the Conventional Commits 1.0.0 specification to team workflows, including commit templates, commitlint and husky configuration, and changelog generation.

### Commit Type Reference

| Emoji | Type       | Description                              | Example                          |
| ----- | ---------- | ---------------------------------------- | -------------------------------- |
| 🎉    | `feat`     | A new feature                            | Add user one-click login         |
| 🛠️    | `fix`      | A bug fix                                | Fix inventory overselling issue  |
| 📜    | `docs`     | Documentation only changes               | Update API documentation         |
| 🪄    | `style`    | Changes that do not affect code meaning  | Fix indentation, add semicolons  |
| 🎊    | `refactor` | Code refactoring (neither feat nor fix)  | Split oversized service class    |
| ✨    | `perf`     | A code change that improves performance  | Optimize home page query         |
| 🔎    | `test`     | Add or fix tests                         | Add user module unit tests       |
| 🌈    | `chore`    | Build process, tools, or libs changes    | Upgrade webpack to v5            |

### Principles

- Commit type is always a lowercase English keyword (e.g., `feat`, `fix`) for tool chain compatibility
- Emoji prefix is optional but recommended for visual clarity
- Scope (in brackets) describes the affected component in English
- Subject line follows format: `<emoji> <type>[scope]: <description>` (max 100 characters)
- Description in English using imperative mood (e.g., "Add", "Fix", "Update")
- Body provides detailed explanation in English when needed

## 2. Commit Message Template

```
🎉 feat[scope]: description
🛠️ fix[scope]: description
📜 docs[scope]: description
🪄 style[scope]: description
🎊 refactor[scope]: description
✨ perf[scope]: description
🔎 test[scope]: description
🌈 chore[scope]: description

Detailed explanation (optional)

1. Details...
2. Details...
```

### Complete Examples

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

## 3. Subject Line Rules

### Format

```
<emoji> <type>[scope]: <description>
```

### Rules

- **emoji**: Optional but recommended for visual clarity at a glance
- **type**: Required. Use exactly one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
- **scope**: Optional. Use English to describe the affected component or module
  - Examples: `auth`, `payment`, `inventory`, `ui-components`
- **description**: Required. English imperative mood, not exceeding 100 characters
  - Use action verbs: "Add", "Fix", "Update", "Optimize", "Remove"
  - No period at the end
  - Avoid vague descriptions like "update code" or "minor fix"

### Good Examples

```
🎉 feat[auth]: Add role-based access control (RBAC)
🛠️ fix[payment]: Fix WeChat payment callback signature verification
✨ perf[list]: Optimize virtual scrolling for large data tables
🎊 refactor[gateway]: Split monolithic gateway into independent microservices
```

### Examples to Avoid

```
# Do not follow these patterns
fix: Fix a bug
feat: Update code
chore: Modify some stuff
```

## 4. Body Writing Guidelines

The body should provide detailed explanation of the change motivation, approach, and impact.

### Key Points

- Explain **why** this change is needed (background/reason)
- Explain **how** it's implemented (technical approach summary)
- Describe **what is affected** (which modules, APIs, services)
- Keep each line under 100 characters
- Separate body from subject with a blank line
- Use clear, concise English

### Body Template

```
<Background and reason for change>

Approach:
- <Key approach point 1>
- <Key approach point 2>

Affected Components: <List affected modules or services>
```

## 5. Breaking Changes

When a commit introduces breaking changes, it must be clearly marked in the footer.

### Method 1: Footer Annotation

```
🎉 feat[api]: Restructure user info response

Change the user API response from flat structure to nested structure.
Frontend teams need to update field access paths accordingly.

BREAKING CHANGE: /api/user/info response structure changed
- avatar field moved into profile object
- Removed deprecated nickname field, use displayName instead
```

### Method 2: Add Exclamation Mark After Type

```
🎉 feat[api]!: Restructure user info response
```

### Team Guidelines

- **Database schema changes** → Must mark as BREAKING CHANGE
- **Public API parameter/return value changes** → Must mark
- **Configuration file format changes** → Must mark
- When marking, provide migration path or upgrade instructions

## 6. Issue References

### GitHub Format

```
Closes #128
Refs #129, #130
Resolves #131
```

### Gitee Format

```
Closes #I5ABC1
Related Issue: https://gitee.com/org/repo/issues/I5ABC1
```

### Coding Format

```
Linked to Coding issue #12345
fixed=project-2024/issues/678
```

### Multiple Platforms

```
# Reference issues across multiple platforms
Closes #128
Jira: PROJ-456
Zentao: #789
```

## 7. Auto-Generate Changelog

### Install conventional-changelog

```bash
npm install -D conventional-changelog-cli conventional-changelog-conventionalcommits
```

### package.json Scripts

```json
{
  "scripts": {
    "changelog": "conventional-changelog -p conventionalcommits -i CHANGELOG.md -s",
    "changelog:all": "conventional-changelog -p conventionalcommits -i CHANGELOG.md -s -r 0",
    "release": "standard-version"
  }
}
```

### .versionrc.js Configuration

```javascript
module.exports = {
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'perf', section: 'Performance' },
    { type: 'refactor', section: 'Code Refactoring' },
    { type: 'docs', section: 'Documentation' },
    { type: 'test', section: 'Tests' },
    { type: 'chore', section: 'Build/Tools', hidden: true },
    { type: 'ci', section: 'CI/CD', hidden: true },
    { type: 'style', section: 'Code Style', hidden: true }
  ],
  commitUrlFormat: '{{host}}/{{owner}}/{{repository}}/commit/{{hash}}',
  compareUrlFormat: '{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}'
}
```

## 8. commitlint Configuration

### Install

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

## 9. husky + lint-staged Integration

### Install and Initialize

```bash
npm install -D husky lint-staged
npx husky init
```

### Configure commit-msg Hook

```bash
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

### Configure pre-commit Hook

```bash
# .husky/pre-commit
npx lint-staged
```

### lint-staged Configuration (package.json)

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

### Interactive Commit (Optional)

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

## 10. Team Checklist

### Pre-Commit Verification

- [ ] Is commit type correctly selected (feat/fix/docs/...)?  
- [ ] Does scope accurately describe the affected component?
- [ ] Is subject line using imperative mood and under 100 characters?
- [ ] Is there no period at the end of subject line?
- [ ] Does body explain the reason and approach for changes?
- [ ] Are breaking changes marked with BREAKING CHANGE?
- [ ] Are related issues linked?
- [ ] Does commit represent a single logical change (atomicity)?

### Team Implementation Steps

1. **Configure toolchain**: Set up commitlint + husky as described above
2. **Share templates**: Commit `.commitlintrc`, `.husky/` configs to repository
3. **Team training**: Hold 15-minute session to explain rules and demo tools
4. **Code review**: Check commit message quality during review
5. **Continuous improvement**: Quarterly review of convention compliance, adjust based on feedback

### FAQ

**Q: How to handle spacing between English and code references?**
A: Add one space between content and English/technical terms, e.g., "Upgrade Node.js to v20".

**Q: Should scope be in English or follow locale?**
A: Use consistent English for scope to maintain compatibility with tool chains and automated systems.

**Q: How to ensure consistency across multiple collaborators?**
A: Rely on automated tooling rather than manual discipline. Configure husky + commitlint to reject non-compliant commits.
