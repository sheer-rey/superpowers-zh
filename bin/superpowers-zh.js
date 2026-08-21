#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, lstatSync, realpathSync, rmSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// 手动递归复制：跨 Node 版本和操作系统行为一致
// 不使用 cpSync —— 在 Windows + npx 缓存（含 junction）+ Node 16.7-18 下不稳定
function copyDirSync(src, dest) {
  // 解析 junction/symlink，避免 Windows npx 缓存路径下 readdir 返回空
  let realSrc = src;
  try { realSrc = realpathSync(src); } catch {}

  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(realSrc, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const srcPath = join(realSrc, entry.name);
    const destPath = join(dest, entry.name);
    let stat;
    try { stat = lstatSync(srcPath); } catch { continue; }
    if (stat.isSymbolicLink()) {
      // 取消引用后按实际类型处理
      try {
        const real = realpathSync(srcPath);
        const realStat = lstatSync(real);
        if (realStat.isDirectory()) copyDirSync(real, destPath);
        else copyFileSync(real, destPath);
      } catch {}
    } else if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (stat.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));
const SKILLS_SRC = resolve(__dirname, '..', 'skills');
const PROJECT_DIR = process.cwd();

// 历史遗留 agent 文件名 — 用于 --uninstall 清理已装用户机器上的残留。
// 上游 v5.1.0 把 agents/code-reviewer.md 上升进 requesting-code-review skill，
// agents/ 目录已删，但旧版本装过的用户机器上仍有残留文件需要清理。
const LEGACY_AGENT_FILENAMES = ['code-reviewer.md'];

// 每个工具：项目级 dir（相对 cwd）+ 可选 global 配置。
// global 存在 = 该工具有稳定的「用户级 skills 目录」，可全局安装（所有项目共享）：
//   global.dir     用户级 skills 目录（相对 home）
//   global.detect  home 下用于自动检测该工具是否安装的标记目录
//   global.boot    可选，用户级 bootstrap 文件（相对 home）；无则仅靠 skill 自动发现
// 无 global 的工具（Cursor/Kiro/Trae/Aider/DeerFlow/VS Code/Claw/Cline/Kilo Code）规则是项目级、
// 或存在于应用内设置，没有稳定的用户级 skills 加载路径 —— --global 会明确拒绝而非写无效路径。
const TARGETS = [
  { name: 'Claude Code',   dir: '.claude/skills',           detect: '.claude',                        global: { dir: '.claude/skills',         detect: '.claude',         boot: '.claude/CLAUDE.md' } },
  // Cursor 经官方文档核实（cursor.com/docs/skills）：.cursor/skills/<name>/SKILL.md，
  // 启动时自动发现并交给 Agent 按上下文选用，也可在对话里打 / 手动点名。无需配置。
  { name: 'Cursor',        dir: '.cursor/skills',           detect: ['.cursor', '.cursorrules'] },
  // Codex 各层级扫的都是 .agents/skills，**从不扫 .codex/skills**。官方文档
  // （developers.openai.com/codex/skills，308 跳 learn.chatgpt.com/docs/build-skills）
  // 给出的完整清单只有：
  //   $CWD/.agents/skills、$CWD/../.agents/skills、$REPO_ROOT/.agents/skills
  //   $HOME/.agents/skills、/etc/codex/skills、以及内置 skill
  // 全局一直是对的（~/.agents/skills），但**项目级原来装到 .codex/skills —— Codex
  // 不读那里，等于装了不生效**。v1.7.11 改为 .agents/skills，并清理旧位置。
  // 与 Antigravity 装在同一目录是预期的：两者共用 .agents/skills 这个开放约定。
  { name: 'Codex CLI',     dir: '.agents/skills',           detect: '.codex',                         global: { dir: '.agents/skills',         detect: '.codex' } },
  // Kiro 的 steering 与 Cline / Kilo 的 rules 同性质：**每轮常驻**。官方文档
  // （kiro.dev/docs/steering）明确 `.kiro/steering/` 下的文件默认 inclusion: always，
  // "loaded into every Kiro interaction automatically"。
  // v1.7.9 及更早把 20 个 skill 整个装进 .kiro/steering/ —— 实测 47 个 md、335 KB，
  // 每一轮全量进上下文。改为与 Cline / Kilo 同一套：skills 放 .kiro/skills/（不被
  // 自动加载），只在 steering 里放一份带 inclusion: always 的小索引。
  // 注意 Kiro 的 frontmatter 键是 inclusion / fileMatchPattern，不是 Cursor 系的
  // alwaysApply / globs —— 我们旧文档写错过，见 docs/README.kiro.md。
  { name: 'Kiro',          dir: '.kiro/skills',              detect: '.kiro' },
  // DeerFlow 安装路径 skills/custom/ 经官方文档核实（bytedance-deer-flow.mintlify.app
  // /concepts/skills）：自动扫描 ["skills/public", "skills/custom"] 两个固定目录，
  // custom 默认被 gitignore，无需任何配置。容器内挂到 /mnt/skills/。
  // 但检测标记原来写的是 deer_flow —— DeerFlow 2.0 顶层是 backend/frontend/skills/…，
  // **没有 deer_flow 这个目录**（实测 GitHub API 列目录确认），所以真实的 DeerFlow
  // 检出从来没被自动检测到过。改认 skills/public：它是 skills 机制本身、随仓库版本
  // 控制，任何 DeerFlow 检出都有；deer_flow 保留作 1.x 兼容。
  { name: 'DeerFlow',      dir: 'skills/custom',             detect: ['skills/public', 'deer_flow'] },
  { name: 'Trae',          dir: '.trae/skills',              detect: '.trae' },
  // Antigravity 无 global：其全局 skills 加载路径未在 docs 证实（全局规则走 ~/.gemini/GEMINI.md），
  // 不确认能生效就不写，避免「装了不生效」。用户用项目级安装。
  { name: 'Antigravity',   dir: '.agents/skills',            detect: '.agents' },
  // VS Code Copilot **不认识** .github/superpowers/ —— 官方（code.visualstudio.com
  // /docs/copilot/customization/custom-instructions）只自动读这几处：
  //   .github/copilot-instructions.md、AGENTS.md、CLAUDE.md（always-on）
  //   .github/instructions/*.instructions.md（按 frontmatter 的 applyTo 匹配）
  // v1.7.10 及更早只把 skills 拷进 .github/superpowers/ 且**不写任何引导** ——
  // 20 个文件 Copilot 一个都不会读，纯死重。旧文档甚至写着「建议你自己创建
  // copilot-instructions.md 引用它们」，等于知道需要却不做。
  // 现在写 .github/instructions/superpowers-zh.instructions.md（applyTo: "**" 即
  // 全局生效）—— 用我们自己的文件而不是去改用户的 copilot-instructions.md。
  // 检测标记同时认 .github/instructions（用了 instructions 机制的项目都有）。
  { name: 'VS Code',       dir: '.github/superpowers',       detect: ['.github/copilot-instructions.md', '.github/instructions'] },
  { name: 'OpenClaw',      dir: 'skills',                     detect: '.openclaw',                     global: { dir: '.openclaw/skills',       detect: '.openclaw' } },
  // Windsurf 全局路径与项目级**不同构**，这点反直觉：官方文档（docs.windsurf.com
  // /windsurf/cascade/skills，现 307 跳 docs.devin.ai/desktop/cascade/skills）写明
  //   项目级：.windsurf/skills/<skill-name>/
  //   用户级：~/.codeium/windsurf/skills/<skill-name>/   ← 不是 ~/.windsurf/skills
  // v1.7.10 及更早 --global 装到 ~/.windsurf/skills —— Windsurf 不读那里，装了不生效。
  // 它还会扫 .agents/skills 与 ~/.agents/skills；开了读取 CC 配置时也扫 .claude/skills。
  { name: 'Windsurf',      dir: '.windsurf/skills',          detect: '.windsurf',                      global: { dir: '.codeium/windsurf/skills', detect: '.codeium' } },
  // Gemini 无 global：其全局加载是「扩展目录」~/.gemini/extensions/*/skills/ + gemini-extension.json，
  // 不是简单复制到 ~/.gemini/skills，通用 --global 覆盖不了。见 docs/README.gemini-cli.md。
  { name: 'Gemini CLI',    dir: '.gemini/skills',            detect: 'GEMINI.md' },
  // Aider 两点都跟直觉相反，都是实测确认的：
  // 1) Aider 不创建 `.aider/` 目录，它在项目根留下的是 `.aider.` 前缀的产物
  //    （.aider.conf.yml / .aider.chat.history.md / .aider.tags.cache.v3/）。
  //    原来 detect 写 '.aider' 永远匹配不上 —— 真实 Aider 项目从来没被自动检测到过。
  // 2) CONVENTIONS.md **不会**被 Aider 自动加载。官方文档（aider.chat/docs/usage/
  //    conventions.html）明确要 `aider --read CONVENTIONS.md` 或在 .aider.conf.yml
  //    写 `read: CONVENTIONS.md`。所以装完必须打印激活方式，否则又是「装了不生效」。
  { name: 'Aider',         dir: '.aider/skills',             detect: ['.aider.conf.yml', '.aider.chat.history.md', '.aider.tags.cache.v3', '.aider'] },
  // OpenCode 经官方文档核实（opencode.ai/docs/skills）：项目 .opencode/skills/<name>/SKILL.md、
  // 全局 ~/.config/opencode/skills/<name>/SKILL.md，自动发现（项目级会从 cwd 向上走到
  // git worktree 根）。它同时扫 .claude/skills 与 .agents/skills —— 装过 CC 或
  // Antigravity 的项目它已经能读到，别重复装。
  { name: 'OpenCode',      dir: '.opencode/skills',          detect: '.opencode',                      global: { dir: '.config/opencode/skills', detect: '.config/opencode' } },
  // Qwen Code = QwenLM/qwen-code 这个 CLI（Gemini CLI 的 fork），**不是**通义灵码
  // （通义灵码是阿里的 IDE 插件，另一个产品，路径完全不同）。旧文档写混过。
  // 路径经官方文档核实：项目 .qwen/skills/、用户 ~/.qwen/skills/，自动发现无需配置。
  { name: 'Qwen Code',     dir: '.qwen/skills',             detect: '.qwen',                           global: { dir: '.qwen/skills',           detect: '.qwen' } },
  // Hermes 官方文档：只自动加载 ~/.hermes/skills/（"the primary directory and
  // source of truth"），项目级目录不被自动发现，外部目录必须写进
  // ~/.hermes/config.yaml 的 skills.external_dirs。所以全局才是能直接生效的装法；
  // 项目级仍保留（便于随仓库分发），但装完会打印需要粘贴的 config.yaml 片段。
  { name: 'Hermes Agent',  dir: '.hermes/skills',            detect: ['.hermes', 'HERMES.md', '.hermes.md'], global: { dir: '.hermes/skills',         detect: '.hermes' } },
  // Claw Code 两处都有源码级证据（ultraworkers/claw-code）：
  //   - skills：rust/crates/plugins/src/lib.rs 里明写 "discovers skills from local
  //     roots such as `.claw/skills`, `.omc/skills`, `.agents/skills` …"
  //   - 指令文件：USAGE.md 列出根指令文件 CLAUDE.md / CLAW.md / AGENTS.md，
  //     优先级 CLAUDE.md > CLAW.md > AGENTS.md
  // 注意 claw 也扫 .agents/skills —— 装过 Antigravity 的项目它已经能读到，别重复装。
  { name: 'Claw Code',     dir: '.claw/skills',              detect: ['.claw', 'CLAW.md'] },
  { name: 'Cline',         dir: '.cline/skills',              detect: ['.clinerules', '.cline'] },
  { name: 'Qoder',         dir: '.qoder/skills',             detect: '.qoder',                         global: { dir: '.qoder/skills',          detect: '.qoder' } },
  // CodeBuddy 官方文档（codebuddy.cn/docs/cli/codebuddy-dir）确认全局与项目级同构：
  //   skills  ~/.codebuddy/skills/   与  .codebuddy/skills/
  //   记忆文件 ~/.codebuddy/CODEBUDDY.md 与 项目根 CODEBUDDY.md（两处等价）
  // 优先级 项目级 > 用户级。v1.7.10 及更早文档写「用户级路径尚未验证」而没有
  // --global —— 现已核实，补上。
  { name: 'CodeBuddy',     dir: '.codebuddy/skills',         detect: ['.codebuddy', 'CODEBUDDY.md'], global: { dir: '.codebuddy/skills',      detect: '.codebuddy' } },
  // 华为云码道（CodeArts Doer）。原注释只写「用户在 #20 确认」—— 已补官方出处：
  // support.huaweicloud.com/usermanual-codeartssnap/codeartsdoer_ug_0024.html
  //   项目级：项目根目录的 ./.codeartsdoer/skills/
  //   个人级：%USERPROFILE%/.codeartsdoer/skills   ← 即 ~/.codeartsdoer/skills
  // 每个 skill 目录根必须有 SKILL.md，自动发现、创建后立刻生效、无需配置。
  // 个人级路径既然已证实，v1.7.11 起支持 --global（此前一直在拒绝名单里）。
  // 仍是 skills-only —— 其 bootstrap/指令文件约定未证实，不猜路径。
  { name: 'CodeArts',      dir: '.codeartsdoer/skills',      detect: '.codeartsdoer', global: { dir: '.codeartsdoer/skills',   detect: '.codeartsdoer' } },
  // Cline / Kilo Code 是 VS Code 扩展，加载的是「rules」而非 skills，且 rules 每轮常驻
  // system prompt。因此 skills 放各自的 skills/ 目录（不被自动加载），只在 rules 目录里
  // 放一份小索引 —— 见 generateClineBootstrapRule / generateKiloCodeBootstrapRule。
  // 均无 global：Cline 全局 rules 在 ~/Documents/Cline/Rules（随 OS 变，Linux/WSL 还有
  // ~/Cline/Rules 回退），不是通用 --global 能可靠覆盖的路径；Kilo 全局需改 kilo.jsonc。
  // Crush 遵循 Agent Skills 开放标准，项目级自动发现 .crush/skills、.agents/skills、
  // .claude/skills、.cursor/skills 四个目录（其 repo 文档明示），无需任何配置。
  // 因此若用户已为 Claude Code / Cursor / Codex 装过，Crush 其实已经能读到 ——
  // docs 里写明了别重复装，否则 Crush 会加载两份。
  // 全局：~/.config/crush/skills 是官方 docs 确认的用户级路径。
  { name: 'Crush',         dir: '.crush/skills',             detect: ['.crush', 'crush.json', '.crush.json'], global: { dir: '.config/crush/skills', detect: '.config/crush' } },
  { name: 'Cline',         dir: '.cline/skills',             detect: '.clinerules' },
  { name: 'Kilo Code',     dir: '.kilocode/skills',          detect: ['.kilocode', '.kilo', 'kilo.jsonc'] },
];

function countDirs(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).length;
}

function scanSkillEntries(skillsDir) {
  const entries = [];
  if (!existsSync(skillsDir)) return entries;
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = resolve(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const content = readFileSync(skillFile, 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
    const descMatch = fmMatch[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
    if (nameMatch) {
      entries.push({
        name: nameMatch[1].trim(),
        desc: descMatch ? descMatch[1].trim() : '',
      });
    }
  }
  return entries;
}

// 段落哨兵：v1.2.1+ 安装时把追加内容包在两条 HTML 注释之间，
// 让卸载可以精确切除，无需依赖标题层级猜测段尾。
const SENTINEL_BEGIN = '<!-- superpowers-zh:begin (do not edit between these markers) -->';
const SENTINEL_END = '<!-- superpowers-zh:end -->';

// 核心规则 + 编码原则（所有 bootstrap 生成器共享）
const CORE_RULES = `## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令`;

const CODING_PRINCIPLES = `## 编码原则

1. **不要假设** — 不确定时提问，公开说明取舍，发现更简单方案时指出
2. **保持简单** — 只写解决问题所需的最少代码，不添加未请求的功能或推测性抽象
3. **手术式改动** — 只改必须改的地方，不"顺便重构"相邻代码，保留现有风格
4. **定义成功标准** — 明确可验证的目标再动手，不模糊完成任务`;

function wrapWithSentinel(body) {
  return `${SENTINEL_BEGIN}\n${body.replace(/\n+$/, '')}\n${SENTINEL_END}\n`;
}

function generateTraeBootstrapRule(projectDir) {
  const rulesDir = resolve(projectDir, '.trae', 'rules');
  mkdirSync(rulesDir, { recursive: true });

  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillTable = skillEntries.map(s => `| ${s.name} | ${s.desc} |`).join('\n');

  const rule = `---
alwaysApply: true
---

# Superpowers-ZH 中文增强版

你已加载 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

${CORE_RULES}

${CODING_PRINCIPLES}

## 可用 Skills

Skills 位于 \`.trae/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

| Skill | 触发条件 |
|-------|---------|
${skillTable}

## 如何使用

当任务匹配某个 skill 的触发条件时，读取对应的 \`.trae/skills/<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  const rulePath = resolve(rulesDir, 'superpowers-zh.md');
  writeFileSync(rulePath, rule, 'utf8');
  console.log(`  ✅ Trae: bootstrap rule -> ${rulePath}`);
}

// Cline：`.clinerules/` 下所有 .md / .txt 都会被合并进 system prompt（docs.cline.bot
// /customization/cline-rules 明确），是常驻开销 —— 所以 20 个 SKILL.md 绝不能放进去，
// 只放一份小的索引 rule，skills 本体放 .cline/skills/ 由 agent 按需读。
// 不写 YAML frontmatter：Cline 目前只支持 `paths` 一个条件字段，无 frontmatter 即始终生效。
// 子目录是否递归扫描官方没写，因此索引 rule 保持在 .clinerules/ 根层、单文件。
function generateClineBootstrapRule(projectDir) {
  const rulesDir = resolve(projectDir, '.clinerules');
  mkdirSync(rulesDir, { recursive: true });

  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillTable = skillEntries.map(s => `| ${s.name} | ${s.desc} |`).join('\n');

  const rule = `# Superpowers-ZH 中文增强版

你已加载 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.cline/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

| Skill | 触发条件 |
|-------|---------|
${skillTable}

## 如何使用

当任务匹配某个 skill 的触发条件时，用读文件工具打开对应的
\`.cline/skills/<skill-name>/SKILL.md\`，并严格遵循其流程。

**不要**把 skill 正文复制到本文件 —— \`.clinerules/\` 里的内容每轮都进 prompt，
按需读取才能把常驻开销控制在这张索引表。
`;

  const rulePath = resolve(rulesDir, 'superpowers-zh.md');
  writeFileSync(rulePath, rule, 'utf8');
  console.log(`  ✅ Cline: bootstrap rule -> ${rulePath}`);
}

// Kiro：steering 每轮常驻，所以这里只放索引，skill 正文放 .kiro/skills/ 按需读取。
// frontmatter 用 Kiro 自己的 inclusion: always（不是 Cursor 系的 alwaysApply）。
function generateKiroSteeringIndex(projectDir) {
  const steeringDir = resolve(projectDir, '.kiro', 'steering');
  mkdirSync(steeringDir, { recursive: true });

  const skillEntries = scanSkillEntries(SKILLS_SRC);

  // 先清掉旧布局：v1.7.9 及更早把 skill 正文装在 .kiro/steering/<skill>/。
  // 升级的人通常直接重装而不会先卸载，不清的话新旧两份并存，335 KB 的常驻开销
  // 一点没减 —— 这才是本次要修的东西。只删我们自己装过的那些 skill 同名目录。
  const ourSkillNames = new Set(skillEntries.map(s => s.name));
  let legacyRemoved = 0;
  for (const entry of readdirSync(steeringDir, { withFileTypes: true })) {
    if (entry.isDirectory() && ourSkillNames.has(entry.name)) {
      rmSync(resolve(steeringDir, entry.name), { recursive: true, force: true });
      legacyRemoved++;
    }
  }
  if (legacyRemoved > 0) {
    console.log(`  🧹 Kiro: 清理旧布局 ${legacyRemoved} 个 skill 目录 <- .kiro/steering/`);
    console.log(`     （旧版把正文放在这里，而 steering 每轮常驻，会一直进 prompt）`);
  }
  const skillTable = skillEntries.map(s => `| ${s.name} | ${s.desc} |`).join('\n');

  const rule = `---
inclusion: always
---

# Superpowers-ZH 中文增强版

你已加载 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.kiro/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

| Skill | 触发条件 |
|-------|---------|
${skillTable}

## 如何使用

当任务匹配某个 skill 的触发条件时，用读文件工具打开对应的
\`.kiro/skills/<skill-name>/SKILL.md\`，并严格遵循其流程。

**不要**把 skill 正文复制到本文件 —— \`.kiro/steering/\` 里的内容每轮都进 prompt，
按需读取才能把常驻开销控制在这张索引表。
`;

  const rulePath = resolve(steeringDir, 'superpowers-zh.md');
  writeFileSync(rulePath, rule, 'utf8');
  console.log(`  ✅ Kiro: steering 索引 -> ${rulePath}`);
}

// Kilo Code：v7 起官方推荐 .kilo/rules/ + 在 kilo.jsonc 的 instructions 数组里显式登记，
// 但那要改用户的 kilo.jsonc（JSONC 带注释，安全合并困难，且属于侵入用户配置）。
// 官方同时明确 `.kilocode/rules/` 向后兼容且无需配置即生效，故走这条：零配置改动。
// 与 Cline 同理 —— rules 是常驻开销，只放索引，skills 本体放 .kilocode/skills/。
function generateKiloCodeBootstrapRule(projectDir) {
  const rulesDir = resolve(projectDir, '.kilocode', 'rules');
  mkdirSync(rulesDir, { recursive: true });

  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillTable = skillEntries.map(s => `| ${s.name} | ${s.desc} |`).join('\n');

  const rule = `# Superpowers-ZH 中文增强版

你已加载 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.kilocode/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

| Skill | 触发条件 |
|-------|---------|
${skillTable}

## 如何使用

当任务匹配某个 skill 的触发条件时，用读文件工具打开对应的
\`.kilocode/skills/<skill-name>/SKILL.md\`，并严格遵循其流程。

**不要**把 skill 正文复制到本文件 —— rules 每轮都进 prompt，按需读取才能把
常驻开销控制在这张索引表。
`;

  const rulePath = resolve(rulesDir, 'superpowers-zh.md');
  writeFileSync(rulePath, rule, 'utf8');
  console.log(`  ✅ Kilo Code: bootstrap rule -> ${rulePath}`);
}

function generateQoderBootstrap(baseDir, isGlobal) {
  const rulesDir = resolve(baseDir, '.qoder', 'rules');
  mkdirSync(rulesDir, { recursive: true });

  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillTable = skillEntries.map(s => `| ${s.name} | ${s.desc} |`).join('\n');
  const scope = isGlobal ? '你已全局加载 superpowers-zh 技能框架，所有项目共享' : '你已加载 superpowers-zh 技能框架';
  const skillsRef = isGlobal ? '~/.qoder/skills/' : '.qoder/skills/';

  // Qoder rules schema（来源：社区实际样本，docs.qoder.com/zh/user-guide/rules 没公开）
  // trigger: always_on  → "始终生效"，适用于所有智能会话和内联对话
  // trigger: model_decision + description: ...  → 模型按描述自主决定
  // trigger: manual  → 仅 @rule 手动触发
  const rule = `---
trigger: always_on
alwaysApply: true
---

# Superpowers-ZH 中文增强版

${scope}（${skillEntries.length} 个 skills）。

${CORE_RULES}

${CODING_PRINCIPLES}

## 可用 Skills

Skills 位于 \`${skillsRef}\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

| Skill | 触发条件 |
|-------|---------|
${skillTable}

## 如何使用

当任务匹配某个 skill 的触发条件时，读取对应的 \`${skillsRef}<skill-name>/SKILL.md\` 并严格遵循其流程。也可输入 \`/<skill-name>\` 显式调用。
`;

  const rulePath = resolve(rulesDir, 'superpowers-zh.md');
  writeFileSync(rulePath, rule, 'utf8');
  console.log(`  ✅ Qoder: bootstrap rule -> ${rulePath}`);
}

function generateAntigravityBootstrap(baseDir, isGlobal) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');
  const scope = isGlobal ? '已全局安装 superpowers-zh 技能框架，所有项目共享' : '本项目已安装 superpowers-zh 技能框架';
  const skillsRef = isGlobal ? '~/.agents/skills/' : '.agents/skills/';

  const content = `# Superpowers-ZH 中文增强版

${scope}（${skillEntries.length} 个 skills）。

${CORE_RULES}

${CODING_PRINCIPLES}

## 可用 Skills

Skills 位于 \`${skillsRef}\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`${skillsRef}<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  // 写入 .agents/rules.md（不覆盖用户已有的 GEMINI.md / AGENTS.md）；全局装到 ~/.agents/rules.md
  const rulePath = resolve(baseDir, '.agents', 'rules.md');
  writeFileSync(rulePath, content, 'utf8');
  console.log(`  ✅ Antigravity: bootstrap rule -> ${rulePath}`);
}

function generateAiderBootstrap(projectDir) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');

  const content = `# Superpowers-ZH 工作方法论

本项目使用 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

${CORE_RULES}

${CODING_PRINCIPLES}

## 可用 Skills

Skills 位于 \`.aider/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`.aider/skills/<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  // 写入 CONVENTIONS.md。注意：Aider **不会**自动加载这个文件（见 TARGETS 里的
  // Aider 注释），所以写完必须告诉用户怎么激活，否则装了等于没装。
  // 如果已有 CONVENTIONS.md，追加而不覆盖
  const convPath = resolve(projectDir, 'CONVENTIONS.md');
  if (existsSync(convPath)) {
    const existing = readFileSync(convPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(convPath, existing.replace(/\s+$/, '') + '\n\n' + wrapWithSentinel(content), 'utf8');
      console.log(`  ✅ Aider: 追加 skills 引用 -> ${convPath}`);
    } else {
      console.log(`  ✅ Aider: CONVENTIONS.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(convPath, wrapWithSentinel(content), 'utf8');
    console.log(`  ✅ Aider: bootstrap -> ${convPath}`);
  }

  // 激活提示。不替用户改 .aider.conf.yml —— 那是他们的配置文件。
  console.log('');
  console.log('  ⚠️  Aider 不会自动加载 CONVENTIONS.md，还需一步才生效：');
  console.log('');
  console.log('     每次启动时带上：');
  console.log('        aider --read CONVENTIONS.md');
  console.log('');
  console.log('     或写进 .aider.conf.yml 一劳永逸：');
  console.log('');
  console.log('        read: CONVENTIONS.md');
  console.log('');
}

function generateGeminiBootstrap(baseDir, isGlobal) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');
  const scope = isGlobal ? '已全局安装 superpowers-zh 技能框架，所有项目共享' : '本项目已安装 superpowers-zh 技能框架';
  const skillsRef = isGlobal ? '~/.gemini/skills/' : '.gemini/skills/';

  const content = `# Superpowers-ZH 中文增强版

${scope}（${skillEntries.length} 个 skills）。

${CORE_RULES}

${CODING_PRINCIPLES}

## 可用 Skills

Skills 位于 \`${skillsRef}\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`${skillsRef}<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  // 写入 GEMINI.md（如果已存在则追加）；全局装到 ~/.gemini/GEMINI.md
  const geminiPath = isGlobal ? resolve(baseDir, '.gemini', 'GEMINI.md') : resolve(baseDir, 'GEMINI.md');
  mkdirSync(dirname(geminiPath), { recursive: true });
  if (existsSync(geminiPath)) {
    const existing = readFileSync(geminiPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(geminiPath, existing.replace(/\s+$/, '') + '\n\n' + wrapWithSentinel(content), 'utf8');
      console.log(`  ✅ Gemini CLI: 追加 skills 引用 -> ${geminiPath}`);
    } else {
      console.log(`  ✅ Gemini CLI: GEMINI.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(geminiPath, wrapWithSentinel(content), 'utf8');
    console.log(`  ✅ Gemini CLI: bootstrap -> ${geminiPath}`);
  }
}

// Qwen Code 与 Gemini CLI 同源（前者是后者的 fork），两套机制都对得上：
//   - skills：官方文档确认自动发现 .qwen/skills/ 与 ~/.qwen/skills/，无需配置
//     （qwenlm.github.io/qwen-code-docs/en/users/features/skills/）
//   - bootstrap：分层记忆系统的默认上下文文件就是 QWEN.md，从 cwd 逐层向上到项目根
//     发现并拼接（可用 contextFileName 改名，默认 QWEN.md）；全局在 ~/.qwen/QWEN.md
// v1.7.10 及更早只装 skills、不写 bootstrap —— skills 能被发现，但没有引导就不会
// 在恰当时机自动触发，等于死重。
function generateQwenBootstrap(baseDir, isGlobal) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');
  const scope = isGlobal ? '已全局安装 superpowers-zh 技能框架，所有项目共享' : '本项目已安装 superpowers-zh 技能框架';
  const skillsRef = isGlobal ? '~/.qwen/skills/' : '.qwen/skills/';

  const content = `# Superpowers-ZH 中文增强版

${scope}（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`${skillsRef}\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`${skillsRef}<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  const qwenPath = isGlobal ? resolve(baseDir, '.qwen', 'QWEN.md') : resolve(baseDir, 'QWEN.md');
  mkdirSync(dirname(qwenPath), { recursive: true });
  if (existsSync(qwenPath)) {
    const existing = readFileSync(qwenPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(qwenPath, existing.replace(/\s+$/, '') + '\n\n' + wrapWithSentinel(content), 'utf8');
      console.log(`  ✅ Qwen Code: 追加 skills 引用 -> ${qwenPath}`);
    } else {
      console.log(`  ✅ Qwen Code: QWEN.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(qwenPath, wrapWithSentinel(content), 'utf8');
    console.log(`  ✅ Qwen Code: bootstrap -> ${qwenPath}`);
  }
}

// Claw Code：根指令文件是 CLAW.md（优先级 CLAUDE.md > CLAW.md > AGENTS.md，
// 见 ultraworkers/claw-code 的 USAGE.md）。v1.7.10 及更早只装 skills、不写 bootstrap。
// VS Code Copilot：写 .github/instructions/superpowers-zh.instructions.md。
// applyTo: "**" 表示对所有请求生效（省略该字段则只能手动挂载，等于白写）。
// 刻意不动用户的 .github/copilot-instructions.md —— 那是他们的文件。
function generateVSCodeBootstrap(projectDir) {
  const instrDir = resolve(projectDir, '.github', 'instructions');
  mkdirSync(instrDir, { recursive: true });

  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillTable = skillEntries.map(s => `| ${s.name} | ${s.desc} |`).join('\n');

  const rule = `---
applyTo: "**"
name: Superpowers-ZH
description: superpowers-zh 技能框架的索引与触发规则
---

# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.github/superpowers/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

| Skill | 触发条件 |
|-------|---------|
${skillTable}

## 如何使用

当任务匹配某个 skill 的触发条件时，读取对应的
\`.github/superpowers/<skill-name>/SKILL.md\` 并严格遵循其流程。

**不要**把 skill 正文复制到本文件 —— 本文件对每个请求都生效，按需读取才能把
常驻开销控制在这张索引表。
`;

  const rulePath = resolve(instrDir, 'superpowers-zh.instructions.md');
  writeFileSync(rulePath, rule, 'utf8');
  console.log(`  ✅ VS Code: instructions -> ${rulePath}`);
}

function generateClawBootstrap(projectDir) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');
  const scope = isGlobal ? '已全局安装 superpowers-zh 技能框架，所有项目共享' : '本项目已安装 superpowers-zh 技能框架';
  const skillsRef = isGlobal ? '~/.codebuddy/skills/' : '.codebuddy/skills/';

  const content = `# Superpowers-ZH 中文增强版

${scope}（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.claw/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`.claw/skills/<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  const mdPath = resolve(projectDir, 'CLAW.md');
  if (existsSync(mdPath)) {
    const existing = readFileSync(mdPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(mdPath, existing.replace(/\s+$/, '') + '\n\n' + wrapWithSentinel(content), 'utf8');
      console.log(`  ✅ Claw Code: 追加 skills 引用 -> ${mdPath}`);
    } else {
      console.log(`  ✅ Claw Code: CLAW.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(mdPath, wrapWithSentinel(content), 'utf8');
    console.log(`  ✅ Claw Code: bootstrap -> ${mdPath}`);
  }

  // claw 的根指令文件优先级是 CLAUDE.md > CLAW.md。项目里若已有 CLAUDE.md，
  // 它可能压过 CLAW.md —— 说清楚，别让人以为装了没生效。
  if (existsSync(resolve(projectDir, 'CLAUDE.md'))) {
    console.log('  ℹ️  检测到项目里已有 CLAUDE.md。claw 的根指令文件优先级是');
    console.log('     CLAUDE.md > CLAW.md > AGENTS.md，CLAUDE.md 可能压过刚写的 CLAW.md。');
    console.log('     如果 skill 不触发，跑一次 `npx superpowers-zh --tool claude` 让 CLAUDE.md 也带上引导。');
  }
}

function generateHermesBootstrap(projectDir, isGlobal) {
  // 全局模式不写 bootstrap：Hermes 的用户级指令文件约定未在 docs 证实，
  // 往 $HOME 根目录写 HERMES.md 是猜路径 + 污染主目录。~/.hermes/skills/ 里的
  // skill 靠 name/description 被 skills_list / skill_view 发现，本就不依赖 bootstrap。
  if (isGlobal) {
    console.log('  ℹ️  Hermes 全局安装不写 bootstrap 文件（其用户级指令文件约定未证实）。');
    console.log('     skills 已在 ~/.hermes/skills/，可用 skills_list / skill_view 发现。');
    console.log('     想让它在项目里自动触发，在该项目跑一次项目级安装以生成 HERMES.md。');
    return;
  }

  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');

  const content = `# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

${CORE_RULES}

${CODING_PRINCIPLES}

## 工具映射

技能中引用的 Claude Code 工具名称对应 Hermes Agent 的等价工具：
- \`Read\` → \`read_file\`
- \`Write\` → \`write_file\`
- \`Edit\` → \`patch\`
- \`Bash\` → \`terminal\`
- \`Grep\` / \`Glob\` → \`search_files\`
- \`Skill\` → \`skill_view\`
- \`Task\`（子智能体） → \`delegate_task\`
- \`WebSearch\` → \`web_search\`
- \`WebFetch\` → \`web_extract\`
- \`TodoWrite\` → \`todo\`

## 可用 Skills

Skills 位于 \`.hermes/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，使用 \`skill_view\` 加载对应 skill 并严格遵循其流程。
`;

  // 写入 HERMES.md（如果已存在则追加）
  const hermesPath = resolve(projectDir, 'HERMES.md');
  if (existsSync(hermesPath)) {
    const existing = readFileSync(hermesPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(hermesPath, existing.replace(/\s+$/, '') + '\n\n' + wrapWithSentinel(content), 'utf8');
      console.log(`  ✅ Hermes Agent: 追加 skills 引用 -> ${hermesPath}`);
    } else {
      console.log(`  ✅ Hermes Agent: HERMES.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(hermesPath, wrapWithSentinel(content), 'utf8');
    console.log(`  ✅ Hermes Agent: bootstrap -> ${hermesPath}`);
  }

  // 项目级安装 Hermes 认不到 —— 必须显式登记到 config.yaml。不替用户改配置
  // （那是他们的文件），改为打印可直接粘贴的片段。见 issue #45。
  if (!isGlobal) {
    const abs = resolve(projectDir, '.hermes', 'skills');
    console.log('');
    console.log('  ⚠️  Hermes 只自动扫描 ~/.hermes/skills/，不会发现项目级目录。');
    console.log('     二选一让它生效：');
    console.log('');
    console.log('     A) 改用全局安装（推荐，装完即生效）：');
    console.log('        npx superpowers-zh --global --tool hermes');
    console.log('');
    console.log('     B) 保留项目级，把这段加进 ~/.hermes/config.yaml：');
    console.log('');
    console.log('        skills:');
    console.log('          external_dirs:');
    console.log(`            - ${abs}`);
    console.log('');
  }
}

function generateClaudeCodeBootstrap(baseDir, isGlobal) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');
  const scope = isGlobal ? '已全局安装 superpowers-zh 技能框架，所有项目共享' : '本项目已安装 superpowers-zh 技能框架';
  const skillsRef = isGlobal ? '~/.claude/skills/' : '.claude/skills/';

  const content = `# Superpowers-ZH 中文增强版

${scope}（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`${skillsRef}\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，使用 \`Skill\` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
`;

  const mdPath = isGlobal ? resolve(baseDir, '.claude', 'CLAUDE.md') : resolve(baseDir, 'CLAUDE.md');
  mkdirSync(dirname(mdPath), { recursive: true });
  if (existsSync(mdPath)) {
    const existing = readFileSync(mdPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(mdPath, existing.replace(/\s+$/, '') + '\n\n' + wrapWithSentinel(content), 'utf8');
      console.log(`  ✅ Claude Code: 追加 skills 引用 -> ${mdPath}`);
    } else {
      console.log(`  ✅ Claude Code: CLAUDE.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(mdPath, wrapWithSentinel(content), 'utf8');
    console.log(`  ✅ Claude Code: bootstrap -> ${mdPath}`);
  }
}

// CodeBuddy（腾讯 AI IDE）—— 加载机制类似 Claude Code：项目根 CODEBUDDY.md 作 bootstrap，
// skills 放 .codebuddy/skills/。仅项目级（其用户级 skills 加载路径未证实，暂不做全局）。
function generateCodeBuddyBootstrap(baseDir, isGlobal) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');
  const scope = isGlobal ? '已全局安装 superpowers-zh 技能框架，所有项目共享' : '本项目已安装 superpowers-zh 技能框架';
  const skillsRef = isGlobal ? '~/.codebuddy/skills/' : '.codebuddy/skills/';

  const content = `# Superpowers-ZH 中文增强版

${scope}（${skillEntries.length} 个 skills）。

${CORE_RULES}

${CODING_PRINCIPLES}

## 可用 Skills

Skills 位于 \`${skillsRef}\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`${skillsRef}<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  // 全局记忆文件在 ~/.codebuddy/CODEBUDDY.md；项目级放项目根（官方称两处等价）
  const mdPath = isGlobal ? resolve(baseDir, '.codebuddy', 'CODEBUDDY.md') : resolve(baseDir, 'CODEBUDDY.md');
  mkdirSync(dirname(mdPath), { recursive: true });
  if (existsSync(mdPath)) {
    const existing = readFileSync(mdPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(mdPath, existing.replace(/\s+$/, '') + '\n\n' + wrapWithSentinel(content), 'utf8');
      console.log(`  ✅ CodeBuddy: 追加 skills 引用 -> ${mdPath}`);
    } else {
      console.log(`  ✅ CodeBuddy: CODEBUDDY.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(mdPath, wrapWithSentinel(content), 'utf8');
    console.log(`  ✅ CodeBuddy: bootstrap -> ${mdPath}`);
  }
}

// CLI 工具的可执行文件名 —— 用于检测落空时扫 PATH 给出针对性建议（issue #48）。
// 只列 CLI：IDE（Cursor/Trae/Qoder 等）装在应用目录里，PATH 上探不到。
const CLI_PROBES = {
  'Claude Code':  ['claude', 'copilot'],
  'Codex CLI':    ['codex'],
  'Gemini CLI':   ['gemini'],
  'OpenCode':     ['opencode'],
  'Aider':        ['aider'],
  'Qwen Code':    ['qwen'],
  'OpenClaw':     ['openclaw'],
  'Claw Code':    ['claw'],
  'Crush':        ['crush'],
  'Hermes Agent': ['hermes'],
};

// 在 PATH 里找可执行文件。只查文件是否存在，不 spawn 进程 ——
// 绝不在用户机器上执行探测命令（既慢又有副作用风险）。
function isOnPath(bin) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const dirs = (process.env.PATH || '').split(sep).filter(Boolean);
  const exts = process.platform === 'win32'
    ? ['', ...(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      try { if (existsSync(join(dir, bin + ext))) return true; } catch {}
    }
  }
  return false;
}

// 反查 TARGETS.name -> 最短别名，用于给用户拼出可直接复制的 --tool 命令
function shortestAlias(toolName) {
  return Object.keys(TOOL_ALIASES)
    .filter(a => TOOL_ALIASES[a] === toolName)
    .sort((a, b) => a.length - b.length)[0];
}

// 工具名称别名映射（用户输入 -> TARGETS.name）
const TOOL_ALIASES = {
  'claude':       'Claude Code',
  'claude-code':  'Claude Code',
  'claudecode':   'Claude Code',
  'copilot':      'Claude Code',
  'copilot-cli':  'Claude Code',
  'cursor':       'Cursor',
  'codex':        'Codex CLI',
  'kiro':         'Kiro',
  'deerflow':     'DeerFlow',
  'trae':         'Trae',
  'antigravity':  'Antigravity',
  'vscode':       'VS Code',
  'vs-code':      'VS Code',
  'openclaw':     'OpenClaw',
  'windsurf':     'Windsurf',
  'gemini':       'Gemini CLI',
  'gemini-cli':   'Gemini CLI',
  'aider':        'Aider',
  'opencode':     'OpenCode',
  'qwen':         'Qwen Code',
  'qwen-code':    'Qwen Code',
  'hermes':       'Hermes Agent',
  'hermes-agent': 'Hermes Agent',
  'claw':         'Claw Code',
  'claw-code':    'Claw Code',
  'clawcode':     'Claw Code',
  'qoder':        'Qoder',
  'cline':        'Cline',
  'codebuddy':    'CodeBuddy',
  'codebuddy-code': 'CodeBuddy',
  'codebuddycode': 'CodeBuddy',
  'codebuddy-cn': 'CodeBuddy',
  'codearts':     'CodeArts',
  'codeartsdoer': 'CodeArts',
  'codearts-doer': 'CodeArts',
  'huawei':       'CodeArts',
  'cline':        'Cline',
  'crush':        'Crush',
  'kilocode':     'Kilo Code',
  'kilo':         'Kilo Code',
  'kilo-code':    'Kilo Code',
};

function showHelp() {
  const toolNames = [...new Set(Object.values(TOOL_ALIASES))];
  console.log(`
  superpowers-zh v${PKG.version} — AI 编程超能力中文版

  用法：
    npx superpowers-zh                   项目级：自动检测工具并装到当前目录
    npx superpowers-zh --global          全局：装到 ~/，所有项目共享（推荐多项目用户）
    npx superpowers-zh --tool cursor     指定工具安装（检测不到时使用）
    npx superpowers-zh --global -t claude 全局 + 指定工具
    npx superpowers-zh --uninstall       卸载当前目录（加 --global 卸载全局）
    npx superpowers-zh --force           允许在用户主目录(~)做项目级安装（默认拒绝）
    npx superpowers-zh --help            显示帮助
    npx superpowers-zh --version         显示版本

  支持的工具名：
    ${Object.keys(TOOL_ALIASES).join(', ')}

  支持全局安装的工具（其余工具规则为项目级，--global 会提示改用项目级）：
    ${TARGETS.filter(t => t.global).map(t => t.name).join('、')}

  说明：
    项目级：把 ${countDirs(SKILLS_SRC)} 个 skills 装到当前项目对应目录（如 .claude/skills）。
    全局：把 skills 装到用户级目录（如 ~/.claude/skills），一次安装所有项目可用，
          skills 更新时也只需重装一次。项目级优先、全局兜底，二者可共存。

    卸载：
      npx superpowers-zh --uninstall            清理当前项目
      npx superpowers-zh --global --uninstall   清理全局安装

  项目：https://github.com/jnMetaCode/superpowers-zh
`);
}

function installForTarget(target, baseDir, isGlobal) {
  const relDir = isGlobal ? target.global.dir : target.dir;
  const dest = resolve(baseDir, relDir);
  const srcCount = countDirs(SKILLS_SRC);
  mkdirSync(dest, { recursive: true });
  copyDirSync(SKILLS_SRC, dest);
  const totalAfter = countDirs(dest);
  if (srcCount > 0 && totalAfter === 0) {
    throw new Error(
      `复制 skills 失败：源目录 ${SKILLS_SRC} 有 ${srcCount} 个 skill，但目标 ${dest} 为空。` +
      `\n  这通常是 npx 缓存目录权限或路径问题。请尝试：\n` +
      `    1. 清理缓存后重试: npm cache clean --force && npx superpowers-zh\n` +
      `    2. 或全局安装: npm i -g superpowers-zh && superpowers-zh\n` +
      `    3. 或手动克隆复制: 见 https://github.com/jnMetaCode/superpowers-zh#快速开始`
    );
  }
  const scopeTag = isGlobal ? '[全局]' : '[项目]';
  console.log(`  ✅ ${target.name} ${scopeTag}: ${srcCount} 个 skills -> ${dest}`);

  if (target.name === 'Trae') {
    generateTraeBootstrapRule(baseDir);
  }

  if (target.name === 'Qoder') {
    generateQoderBootstrap(baseDir, isGlobal);
  }

  if (target.name === 'Antigravity') {
    generateAntigravityBootstrap(baseDir, isGlobal);
  }

  if (target.name === 'Aider') {
    generateAiderBootstrap(baseDir);
  }

  if (target.name === 'Gemini CLI') {
    generateGeminiBootstrap(baseDir, isGlobal);
  }

  if (target.name === 'Qwen Code') {
    generateQwenBootstrap(baseDir, isGlobal);
  }

  // Codex 项目级旧位置清理：v1.7.10 及更早装到 .codex/skills，而 Codex 从不扫那里。
  // 升级的人通常直接重装不会先卸载，不清的话旧目录留着白占地方、还让人以为在生效。
  if (target.name === 'Codex CLI' && !isGlobal) {
    const legacy = resolve(baseDir, '.codex', 'skills');
    if (existsSync(legacy)) {
      const ours = new Set(scanSkillEntries(SKILLS_SRC).map(s => s.name));
      let n = 0;
      for (const e of readdirSync(legacy, { withFileTypes: true })) {
        if (e.isDirectory() && ours.has(e.name)) { rmSync(resolve(legacy, e.name), { recursive: true, force: true }); n++; }
      }
      if (n > 0) {
        console.log(`  🧹 Codex: 清理旧位置 ${n} 个 skill 目录 <- .codex/skills/`);
        console.log(`     （Codex 只扫 .agents/skills，旧版装错了地方）`);
      }
      try { if (readdirSync(legacy).filter(x => x !== '.DS_Store').length === 0) rmSync(legacy, { recursive: true, force: true }); } catch {}
    }
  }

  if (target.name === 'VS Code') {
    generateVSCodeBootstrap(baseDir);
  }

  if (target.name === 'Claw Code') {
    generateClawBootstrap(baseDir);
  }

  if (target.name === 'Hermes Agent') {
    generateHermesBootstrap(baseDir, isGlobal);
  }

  if (target.name === 'Claude Code') {
    generateClaudeCodeBootstrap(baseDir, isGlobal);
  }

  if (target.name === 'CodeBuddy') {
    generateCodeBuddyBootstrap(baseDir, isGlobal);
  }

  if (target.name === 'Kiro') {
    generateKiroSteeringIndex(baseDir);
  }

  if (target.name === 'Cline') {
    generateClineBootstrapRule(baseDir);
  }

  if (target.name === 'Kilo Code') {
    generateKiloCodeBootstrapRule(baseDir);
  }

  if (target.name === 'Cline') {
    generateClineBootstrap(PROJECT_DIR);
  }
}

function isHomeDir(p) {
  const home = homedir();
  if (!home) return false;
  try {
    return realpathSync(p) === realpathSync(home);
  } catch { return resolve(p) === resolve(home); }
}

// 卸载支持：完整删除的 bootstrap 文件、需要清理段落的 bootstrap 文件
const BOOTSTRAP_DELETE = [
  '.github/instructions/superpowers-zh.instructions.md',
  '.trae/rules/superpowers-zh.md',
  '.qoder/rules/superpowers-zh.md',
  '.agents/rules.md',
  '.clinerules/superpowers-zh.md',
  '.kilocode/rules/superpowers-zh.md',
  '.kiro/steering/superpowers-zh.md',
];

// v1.7.9 及更早把 skill 正文直接装进 .kiro/steering/<skill>/，而 steering 每轮常驻 ——
// 那 335 KB 会一直进 prompt。升级的用户不会重跑旧版卸载，所以这里按老路径也清一遍，
// 否则新旧两份并存，开销问题原样保留。
const LEGACY_SKILL_DIRS = ['.kiro/steering', '.codex/skills'];
const BOOTSTRAP_CLEAN_SECTION = [
  'CLAUDE.md',
  'GEMINI.md',
  'QWEN.md',
  'CLAW.md',
  'HERMES.md',
  'CONVENTIONS.md',
  'CODEBUDDY.md',
];
const BOOTSTRAP_SECTION_MARKERS = [
  '# Superpowers-ZH 中文增强版',
  '# Superpowers-ZH 工作方法论',
];

// v1.1.x 安装的旧 bootstrap 没有 sentinel，只能凭模板末尾固定句子识别段尾。
// 这些短语必须出现在 superpowers 段最后一行，且足够独特不易在用户内容里重合。
const FALLBACK_TAIL_HINTS = [
  '你必须调用该 skill 检查。',
  '严格遵循其流程。',
];

function writeOrDelete(filePath, head, tail) {
  const headTrim = head.replace(/\s+$/, '');
  const tailTrim = tail.replace(/^\s+/, '');
  let body = headTrim;
  if (headTrim && tailTrim) body += '\n\n' + tailTrim;
  else body += tailTrim;
  body = body.replace(/\s+$/, '');
  if (body.length === 0) {
    rmSync(filePath);
  } else {
    writeFileSync(filePath, body + '\n', 'utf8');
  }
}

function cleanBootstrapSection(filePath) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf8');

  // 1. 哨兵模式（v1.2.1+）— 精确切除
  const sBegin = content.indexOf(SENTINEL_BEGIN);
  if (sBegin !== -1) {
    const sEnd = content.indexOf(SENTINEL_END, sBegin + SENTINEL_BEGIN.length);
    if (sEnd !== -1) {
      writeOrDelete(filePath, content.slice(0, sBegin), content.slice(sEnd + SENTINEL_END.length));
      return true;
    }
  }

  // 2. 标题 marker（v1.1.x 安装的）— 找下一个 \n# 一级标题做段尾
  let idx = -1;
  for (const marker of BOOTSTRAP_SECTION_MARKERS) {
    const i = content.indexOf(marker);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return false;

  let end = -1;
  const nextHeading = content.indexOf('\n# ', idx + 1);
  if (nextHeading !== -1) end = nextHeading + 1;

  // 3. 一级标题找不到 — 用末尾固定短语做兜底
  if (end === -1) {
    for (const hint of FALLBACK_TAIL_HINTS) {
      const i = content.lastIndexOf(hint);
      if (i > idx) {
        const nl = content.indexOf('\n', i + hint.length);
        const after = nl !== -1 ? nl + 1 : content.length;
        if (after > end) end = after;
      }
    }
  }

  // 4. 都找不到 — 数据安全，跳过 + 警告
  if (end === -1) {
    console.warn(`  ⚠️  ${filePath}: 无法可靠识别 superpowers-zh 段尾，已跳过以避免数据丢失。`);
    console.warn(`     请手动编辑此文件并删除以 "${BOOTSTRAP_SECTION_MARKERS[0]}" 开头的整段。`);
    return false;
  }

  writeOrDelete(filePath, content.slice(0, idx), content.slice(end));
  return true;
}

// 全局安装的 bootstrap 文件（相对 home）— 与 install 全局分支写入的路径对应。
// 仅 Claude Code（~/.claude/CLAUDE.md，全局记忆已证实）和 Qoder（~/.qoder/rules/，镜像其项目机制）
// 会写全局 bootstrap；其余全局工具靠 skill 自动发现，无 bootstrap 需清理。
const GLOBAL_BOOTSTRAP_DELETE = ['.qoder/rules/superpowers-zh.md'];
// qwen 在 GLOBAL_OK 里，--global 会写 ~/.qwen/QWEN.md，全局卸载必须清掉它，
// 否则 --global 装卸一轮会在用户主目录留残留。
const GLOBAL_BOOTSTRAP_CLEAN_SECTION = ['.claude/CLAUDE.md', '.qwen/QWEN.md', '.codebuddy/CODEBUDDY.md'];

function uninstallForTarget(target, srcSkillNames, baseDir, isGlobal) {
  const relDir = isGlobal ? (target.global && target.global.dir) : target.dir;
  if (!relDir) return 0;
  const dest = resolve(baseDir, relDir);
  if (!existsSync(dest)) return 0;
  let removed = 0;
  for (const entry of readdirSync(dest, { withFileTypes: true })) {
    if (entry.isDirectory() && srcSkillNames.has(entry.name)) {
      rmSync(resolve(dest, entry.name), { recursive: true, force: true });
      removed++;
    }
  }
  // 如果目录已空（或仅剩 .DS_Store），顺手清掉，避免留下空骨架
  try {
    if (existsSync(dest)) {
      const left = readdirSync(dest).filter(n => n !== '.DS_Store');
      if (left.length === 0) rmSync(dest, { recursive: true, force: true });
    }
  } catch {}
  return removed;
}

function uninstall(isGlobal) {
  const baseDir = isGlobal ? homedir() : PROJECT_DIR;
  console.log(`\n  superpowers-zh v${PKG.version} — 卸载（${isGlobal ? '全局' : '项目级'}）\n`);
  console.log(`  目标: ${baseDir}\n`);

  if (!existsSync(SKILLS_SRC)) {
    console.error('  ❌ 错误：skills 源目录不存在，无法识别要卸载的 skill 名单。');
    process.exit(1);
  }

  const srcSkillNames = new Set(
    readdirSync(SKILLS_SRC, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
  );

  // 旧布局清理：见 LEGACY_SKILL_DIRS 的说明。老用户跑新版卸载也应清干净。
  if (!isGlobal) {
    for (const rel of LEGACY_SKILL_DIRS) {
      const legacyDir = resolve(baseDir, rel);
      if (!existsSync(legacyDir)) continue;
      let n = 0;
      for (const entry of readdirSync(legacyDir, { withFileTypes: true })) {
        if (entry.isDirectory() && srcSkillNames.has(entry.name)) {
          rmSync(resolve(legacyDir, entry.name), { recursive: true, force: true });
          n++;
        }
      }
      if (n > 0) console.log(`  ✅ 清理旧布局: 移除 ${n} 个 skills <- ${legacyDir}`);
    }
  }

  const pool = isGlobal ? GLOBAL_TARGETS : TARGETS;
  let totalSkills = 0;
  for (const target of pool) {
    const removed = uninstallForTarget(target, srcSkillNames, baseDir, isGlobal);
    if (removed > 0) {
      const relDir = isGlobal ? target.global.dir : target.dir;
      console.log(`  ✅ ${target.name}: 移除 ${removed} 个 skills <- ${resolve(baseDir, relDir)}`);
      totalSkills += removed;
    }
  }

  // 清理 .claude/agents 下旧版本装过的 legacy agent（v1.2.x 及之前会装 code-reviewer.md，
  // v1.3.0 起跟随上游 v5.1.0 移除）。即使 agents/ 源目录已删，已装用户跑 --uninstall 仍应能清干净。
  const agentsDest = resolve(baseDir, '.claude', 'agents');
  if (existsSync(agentsDest)) {
    let agentsRemoved = 0;
    for (const entry of readdirSync(agentsDest)) {
      if (LEGACY_AGENT_FILENAMES.includes(entry)) {
        rmSync(resolve(agentsDest, entry), { recursive: true, force: true });
        agentsRemoved++;
      }
    }
    if (agentsRemoved > 0) console.log(`  ✅ Claude Code agents: 移除 ${agentsRemoved} 个旧版残留 -> ${agentsDest}`);
    try {
      const left = readdirSync(agentsDest).filter(n => n !== '.DS_Store');
      if (left.length === 0) rmSync(agentsDest, { recursive: true, force: true });
    } catch {}
  }

  const deleteList = isGlobal ? GLOBAL_BOOTSTRAP_DELETE : BOOTSTRAP_DELETE;
  const cleanList = isGlobal ? GLOBAL_BOOTSTRAP_CLEAN_SECTION : BOOTSTRAP_CLEAN_SECTION;
  let bootstrapsRemoved = 0;
  for (const rel of deleteList) {
    const full = resolve(baseDir, rel);
    if (existsSync(full)) {
      rmSync(full);
      console.log(`  ✅ 删除 bootstrap: ${full}`);
      bootstrapsRemoved++;
    }
  }
  for (const rel of cleanList) {
    const full = resolve(baseDir, rel);
    if (cleanBootstrapSection(full)) {
      console.log(`  ✅ 清理 bootstrap: ${full}`);
      bootstrapsRemoved++;
    }
  }

  if (totalSkills === 0 && bootstrapsRemoved === 0) {
    console.log(`  ⚠️  未在${isGlobal ? '用户主目录' : '当前目录'}找到 superpowers-zh 安装痕迹。`);
  } else {
    console.log(`\n  卸载完成。共移除 ${totalSkills} 个 skill 目录、${bootstrapsRemoved} 个 bootstrap 文件。\n`);
  }
}

// 支持全局安装的工具（有稳定的用户级 skills 目录）
const GLOBAL_TARGETS = TARGETS.filter(t => t.global);

function install(forceToolName, force, isGlobal) {
 try {
  console.log(`\n  superpowers-zh v${PKG.version} — AI 编程超能力中文版\n`);

  if (!existsSync(SKILLS_SRC)) {
    console.error('  ❌ 错误：skills 源目录不存在，请重新安装 superpowers-zh。');
    process.exit(1);
  }

  const baseDir = isGlobal ? homedir() : PROJECT_DIR;

  // 项目级安装（默认）：拒绝在 home 根目录乱装（会污染所有项目）。
  // 全局安装（--global）：本就写到 ~/.claude/skills 等用户级目录，是正当行为，跳过该护栏。
  if (!isGlobal && !force && isHomeDir(PROJECT_DIR)) {
    console.error(
`  ⚠️  当前目录是用户主目录: ${PROJECT_DIR}

  superpowers-zh 项目级安装应该装到具体项目目录，而不是 ~/。
  在主目录安装会把 skills 和 bootstrap 文件（CLAUDE.md / HERMES.md 等）
  写入你的 home，污染所有项目。

  如果你想让 skills 对所有项目生效，用全局安装（推荐）：
    npx superpowers-zh --global            # 自动检测已装工具
    npx superpowers-zh --global --tool claude

  或先 cd 到项目目录做项目级安装：
    cd /path/to/your/project && npx superpowers-zh

  如果你确实要在主目录做项目级安装（不推荐），加 --force：
    npx superpowers-zh --force
`);
    process.exit(1);
  }

  console.log(`  源: ${countDirs(SKILLS_SRC)} 个 skills`);
  console.log(`  模式: ${isGlobal ? '全局（所有项目共享，装到 ~/）' : '项目级'}`);
  console.log(`  目标: ${baseDir}\n`);

  // --tool 指定安装
  if (forceToolName) {
    const target = TARGETS.find(t => t.name === forceToolName);
    if (!target) {
      console.error(`  ❌ 未知工具: ${forceToolName}`);
      process.exit(1);
    }
    if (isGlobal && !target.global) {
      // 部分工具（如 Gemini CLI 的扩展目录）有专属全局方式，但与通用 --global 复制机制不同，
      // 指向对应 docs；其余工具规则为项目级或存于应用内设置，无稳定用户级路径。
      const docSlug = { 'Gemini CLI': 'gemini-cli', 'Antigravity': 'antigravity', 'Trae': 'trae', 'Aider': 'aider', 'Hermes Agent': 'hermes', 'Kiro': 'kiro', 'Cline': 'cline', 'Kilo Code': 'kilocode' }[target.name];
      console.error(
`  ❌ ${target.name} 不支持通用全局安装（--global）。

  该工具没有通用 --global 能覆盖的稳定用户级 skills 路径${docSlug ? `（可能有专属全局方式，见 docs/README.${docSlug}.md）` : '（规则为项目级或存于应用内设置）'}。
  请改用项目级安装：
    cd /path/to/your/project && npx superpowers-zh --tool ${forceToolName.toLowerCase().replace(/ .*/, '')}

  支持通用全局安装的工具：${GLOBAL_TARGETS.map(t => t.name).join('、')}
`);
      process.exit(1);
    }
    installForTarget(target, baseDir, isGlobal);
    console.log('\n  安装完成！重启你的 AI 编程工具即可生效。\n');
    return;
  }

  // 自动检测
  let installed = 0;
  const pool = isGlobal ? GLOBAL_TARGETS : TARGETS;

  // 先把所有工具的检测结果一次性算完，再开始装。
  // 边装边判会有顺序依赖：Codex 装到 .agents/skills 会创建 .agents/，紧接着
  // Antigravity（detect: '.agents'）就被误判为「项目里有」，于是多装一份。
  // 两款共用 .agents/skills 是官方约定，但检测必须基于**安装前**的项目状态。
  const detectedBefore = new Map();
  for (const target of pool) {
    const dm = isGlobal ? target.global.detect : target.detect;
    const ds = Array.isArray(dm) ? dm : [dm];
    detectedBefore.set(target.name, ds.some(d => existsSync(resolve(baseDir, d))));
  }

  for (const target of pool) {
    const found = detectedBefore.get(target.name);
    if (found) {
      installForTarget(target, baseDir, isGlobal);
      installed++;
    }
  }

  if (installed === 0) {
    // 检测落空时不再静默装 Claude Code —— 否则 Antigravity / Trae 等
    // 不会在项目里留下检测目录的工具，会被误装成 Claude（见 issue #33）。
    // 改为明确报错并教用户用 --tool 显式指定。
    const where = isGlobal ? '你的用户主目录(~)' : '当前目录';
    const flag = isGlobal ? '--global ' : '';
    console.log(`  ⚠️  未在${where}检测到任何已知 AI 编程工具的标记。\n`);

    // issue #48：用户明明装了 opencode / codex，但项目里没留下标记目录（没跑过、
    // 或配置在别处），只报「未检测到」很让人懵。扫 PATH 找已装的 CLI，直接给出
    // 可复制的命令。注意：只提示，绝不自动安装 —— 自动装错工具正是 issue #33。
    const onPath = Object.entries(CLI_PROBES)
      .filter(([toolName]) => !isGlobal || pool.some(t => t.name === toolName))
      .filter(([, bins]) => bins.some(isOnPath));

    if (onPath.length) {
      // 探到了具体工具就不再列通用示例 —— 直接给可复制的命令，别让用户在一堆
      // 无关工具名里自己挑。
      console.log('  不过在 PATH 里找到了这些已安装的 CLI，你要装的应该是其中之一：\n');
      for (const [toolName] of onPath) {
        console.log(`    npx superpowers-zh ${flag}--tool ${shortestAlias(toolName).padEnd(13)}# ${toolName}`);
      }
      console.log('\n  为避免装错，未自动安装 —— PATH 上装了不代表这个项目要用它。');
      console.log('  用上面任一条命令显式指定即可。\n');
    } else {
      console.log('  为避免装错工具，未做任何安装。请用 --tool 显式指定你的工具，例如：\n');
      console.log(`    npx superpowers-zh ${flag}--tool claude        # Claude Code / Copilot CLI`);
      if (isGlobal) {
        console.log(`    npx superpowers-zh ${flag}--tool codex         # Codex CLI`);
        console.log(`    npx superpowers-zh ${flag}--tool qoder         # Qoder\n`);
      } else {
        console.log(`    npx superpowers-zh ${flag}--tool antigravity   # Google Antigravity`);
        console.log(`    npx superpowers-zh ${flag}--tool trae          # Trae`);
        console.log(`    npx superpowers-zh ${flag}--tool cursor        # Cursor\n`);
      }
    }

    if (isGlobal) {
      console.log(`  支持全局安装的工具：${GLOBAL_TARGETS.map(t => t.name).join('、')}\n`);
    } else {
      console.log(`  全部可用别名：${Object.keys(TOOL_ALIASES).join(', ')}\n`);
    }
    process.exit(1);
  }

  console.log('\n  安装完成！重启你的 AI 编程工具即可生效。\n');
 } catch (err) {
    console.error(`  ❌ 安装失败：${err.message}`);
    process.exit(1);
 }
}

const args = process.argv.slice(2);
const helpIdx = args.findIndex(a => a === '--help' || a === '-h');
const versionIdx = args.findIndex(a => a === '--version' || a === '-v');
const toolIdx = args.findIndex(a => a === '--tool' || a === '-t');
const uninstallIdx = args.findIndex(a => a === '--uninstall' || a === '-u');
const forceIdx = args.findIndex(a => a === '--force' || a === '-f');
const globalIdx = args.findIndex(a => a === '--global' || a === '-g');
const force = forceIdx !== -1;
const isGlobal = globalIdx !== -1;

// 已知无参数值的开关，用于校验未知参数（--tool 后面跟工具名不算未知参数）
const KNOWN_FLAGS = new Set(['--help', '-h', '--version', '-v', '--uninstall', '-u', '--force', '-f', '--global', '-g', '--tool', '-t']);

if (helpIdx !== -1) {
  showHelp();
} else if (versionIdx !== -1) {
  console.log(PKG.version);
} else if (uninstallIdx !== -1) {
  uninstall(isGlobal);
} else if (toolIdx !== -1) {
  const toolArg = args[toolIdx + 1];
  if (!toolArg) {
    console.error('  ❌ --tool 需要指定工具名，例如: --tool cursor\n');
    showHelp();
    process.exit(1);
  }
  const toolName = TOOL_ALIASES[toolArg.toLowerCase()];
  if (!toolName) {
    console.error(`  ❌ 未知工具: ${toolArg}`);
    console.error(`  支持的工具: ${Object.keys(TOOL_ALIASES).join(', ')}\n`);
    process.exit(1);
  }
  install(toolName, force, isGlobal);
} else {
  // 校验未知参数（--tool 的值已在上面分支处理，走到这里说明没有 --tool）
  const unknown = args.find(a => a.startsWith('-') && !KNOWN_FLAGS.has(a));
  if (unknown) {
    console.warn(`  未知参数: ${unknown}\n`);
    showHelp();
    process.exit(1);
  }
  install(undefined, force, isGlobal);
}
