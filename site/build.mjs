#!/usr/bin/env node
// superpowers-zh 官网生成器 —— 零依赖。
// 服务端生成中/英两套静态页 + 每个 skill 的详情(操作文档)页。
// skill 卡片与详情正文均直接读取 ../skills/*/SKILL.md，与源文件同步、不漂移。

import {
  readFileSync, writeFileSync, mkdirSync, readdirSync,
  existsSync, copyFileSync, rmSync,
} from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { renderMarkdown } from './md.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');
const DIST = join(__dirname, 'dist');
const TEMPLATE = join(__dirname, 'template');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// 内容 hash 版本号：styles.css / app.js 内容变化时 URL 自动变（?v=hash），
// 绕过 Cloudflare 边缘缓存，确保 CSS/JS 改动立即生效；内容不变则继续命中缓存。
const cssVer = createHash('sha256').update(readFileSync(join(TEMPLATE, 'styles.css'))).digest('hex').slice(0, 10);
const jsVer = createHash('sha256').update(readFileSync(join(TEMPLATE, 'app.js'))).digest('hex').slice(0, 10);
// og 图的内容 hash：社交平台会长期缓存分享图，URL 不变就永远抓不到新图
const ogVer = createHash('sha256').update(readFileSync(join(ROOT, 'assets', 'og-image.jpg'))).digest('hex').slice(0, 10);

// sitemap 的 lastmod 取「这一页对应的源文件最后一次提交的日期」，而不是构建当天。
// 原来 66 条 URL 共用构建日期：页面几个月没动过也天天报「今天改的」。Google 明确
// 说过 lastmod 长期不可靠就会被忽略 —— 那这个字段等于白写。顺带它还让构建不可复现。
//
// 浅克隆（fetch-depth:1）里 git 只有一个提交，按路径查会全部返回同一天；因此部署
// workflow 已改为 fetch-depth: 0。拿不到 git 时回退到构建日期，不让构建失败。
const BUILD_DATE = new Date().toISOString().slice(0, 10);
function lastCommitDate(paths) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...paths],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : BUILD_DATE;
  } catch { return BUILD_DATE; }
}

// 从 RELEASE-NOTES.zh.md 读最新版本条目。
// 动机：v1.7.11 的全部意义是「六款工具此前装了不生效，请重装」，而官网此前
// 一个字都没提 —— 上周装过的用户来站上看不到任何提示。版本号不手写，从
// release notes 解析，再与 package.json 交叉校验，两边漂了就构建失败。
function latestRelease() {
  const md = readFileSync(join(ROOT, 'RELEASE-NOTES.zh.md'), 'utf8');
  const m = md.match(/^## v(\d+\.\d+\.\d+)\s*\(([\d-]+)\)/m);
  if (!m) throw new Error('RELEASE-NOTES.zh.md 里找不到形如「## v1.2.3 (2026-01-01)」的最新条目');
  return { version: m[1], date: m[2] };
}
const LATEST = latestRelease();
if (LATEST.version !== PKG.version) {
  throw new Error(`版本漂移：package.json 是 ${PKG.version}，RELEASE-NOTES.zh.md 最新条目是 v${LATEST.version} —— 发版时漏改了一边`);
}

// 本版需要重装的工具（三语共用；产品名不翻译）。改这里时同步改 release notes 正文。
const REINSTALL_TOOLS = ['Claude Code 插件市场安装', 'Crush（Windows）'];

// 页脚二维码的真实像素尺寸，构建时从文件读取（见 imageSize 的注释）
const QR = {
  wechat: imageSize(join(TEMPLATE, 'assets', 'qr-wechat.jpg')),
  douyin: imageSize(join(TEMPLATE, 'assets', 'qr-douyin.png')),
  x:      imageSize(join(TEMPLATE, 'assets', 'qr-x.png')),
};

// SEO：站点根 URL（用于 canonical / hreflang / og:url / sitemap）
const SITE_URL = 'https://sp.aiolaola.com';
// 仓库源码基址（skill 详情页的相对链接解析到这里）
const GH_BLOB = 'https://github.com/jnMetaCode/superpowers-zh/blob/main';

// 读 PNG / JPEG 的真实像素尺寸（零依赖）。
// 用途：<img> 必须带 width+height，浏览器才能在图加载前按宽高比预留位置，
// 否则图一到位就把下面的内容顶下去（CLS）。页脚三个二维码此前只有 width。
// 不写死数字而是读文件：换二维码时属性自动跟着变，不会悄悄变回错的比例。
function imageSize(file) {
  const b = readFileSync(file);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {          // PNG: IHDR 定长在头部
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {                            // JPEG: 逐段找 SOFn
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      // SOF0-SOF3 / SOF5-SOF7 / SOF9-SOF11 / SOF13-SOF15 都带尺寸；DHT(c4)/JPG(c8)/DAC(cc) 不是
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  throw new Error(`无法解析图片尺寸：${file}`);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- frontmatter 解析 ----
function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[kv[1]] = val;
  }
  return out;
}

// ---- skill 展示元数据：中/英标题 + 英文简介 + 分组 ----
const SKILL_META = {
  'using-superpowers':            { group: 'meta',    title: '使用 Superpowers · 引导', titleEn: 'Using Superpowers · Bootstrap', descEn: 'The bootstrap skill — establishes how to discover and invoke skills at the start of every conversation.' },
  'brainstorming':                { group: 'flow',    title: '头脑风暴',           titleEn: 'Brainstorming',            descEn: 'Explore intent, requirements and design before any creative work — feature, component or behavior change.' },
  'writing-plans':                { group: 'flow',    title: '编写实现计划',       titleEn: 'Writing Plans',            descEn: 'Turn a spec into a step-by-step implementation plan before writing any code.' },
  'executing-plans':              { group: 'flow',    title: '执行计划',           titleEn: 'Executing Plans',          descEn: 'Execute a written plan in a separate session with review checkpoints.' },
  'subagent-driven-development':  { group: 'flow',    title: '子代理驱动开发',     titleEn: 'Subagent-Driven Dev',      descEn: 'Run a plan of independent tasks within the current session via subagents.' },
  'dispatching-parallel-agents':  { group: 'flow',    title: '并行代理调度',       titleEn: 'Dispatching Parallel Agents', descEn: 'Fan out 2+ independent tasks with no shared state or ordering dependency.' },
  'workflow-runner':              { group: 'flow',    title: '工作流运行器',       titleEn: 'Workflow Runner',          descEn: 'Run agency-orchestrator YAML workflows directly using the current session LLM — no API key.' },
  'test-driven-development':      { group: 'quality', title: '测试驱动开发 · TDD', titleEn: 'Test-Driven Development',   descEn: 'Write the test before the implementation, for every feature and bug fix.' },
  'systematic-debugging':         { group: 'quality', title: '系统化调试',         titleEn: 'Systematic Debugging',     descEn: 'Reproduce and locate the root cause before proposing any fix.' },
  'verification-before-completion':{ group: 'quality', title: '完成前验证',        titleEn: 'Verification Before Completion', descEn: 'Run verification and back every claim with evidence before saying it is done.' },
  'requesting-code-review':       { group: 'review',  title: '发起代码审查',       titleEn: 'Requesting Code Review',   descEn: 'Validate work against requirements before merging or shipping.' },
  'receiving-code-review':        { group: 'review',  title: '接收代码审查',       titleEn: 'Receiving Code Review',    descEn: 'Apply review feedback with technical rigor — verify, don\'t blindly comply.' },
  'using-git-worktrees':          { group: 'git',     title: 'Git Worktree 隔离',  titleEn: 'Using Git Worktrees',      descEn: 'Start isolated feature work in a dedicated git worktree.' },
  'finishing-a-development-branch':{ group: 'git',    title: '收尾开发分支',       titleEn: 'Finishing a Branch',       descEn: 'Wrap up finished work via structured merge / PR / cleanup options.' },
  'writing-skills':               { group: 'meta',    title: '编写 Skill',         titleEn: 'Writing Skills',           descEn: 'Create, edit and validate skills before deploying them.' },
  'mcp-builder':                  { group: 'meta',    title: 'MCP 服务器构建',     titleEn: 'MCP Builder',              descEn: 'Methodology for building production-grade MCP servers that connect AI to external tools.' },
  'chinese-code-review':          { group: 'china',   title: '中文代码审查',       titleEn: 'Chinese Code Review',      descEn: 'Chinese review phrasing, severity tiers, and common anti-patterns in domestic teams.' },
  'chinese-commit-conventions':   { group: 'china',   title: '中文提交规范',       titleEn: 'Chinese Commit Conventions', descEn: 'Conventional Commits adapted for Chinese, with commitlint / husky / changelog templates.' },
  'chinese-documentation':        { group: 'china',   title: '中文文档排版',       titleEn: 'Chinese Documentation',    descEn: 'CN/EN spacing, punctuation, term preservation and Chinese typography conventions.' },
  'chinese-git-workflow':         { group: 'china',   title: '国内 Git 平台',       titleEn: 'Chinese Git Workflow',     descEn: 'Gitee / Coding.net / JiHu GitLab / CNB access, credentials, CI and mirror sync.' },
};

const GROUPS = [
  { id: 'all',     zh: '全部',          en: 'All' },
  { id: 'flow',    zh: '工作流程',      en: 'Workflow' },
  { id: 'quality', zh: '质量 · 测试 · 调试', en: 'Quality' },
  { id: 'review',  zh: '代码审查',      en: 'Code Review' },
  { id: 'git',     zh: 'Git · 分支',    en: 'Git' },
  { id: 'meta',    zh: '元 · 构建',     en: 'Meta' },
  { id: 'china',   zh: '🇨🇳 中国原创',  en: '🇨🇳 China-native' },
];

// ---- 支持的工具（与 bin/superpowers-zh.js 的 TARGETS 对齐） ----
// mode 决定安装命令与说明文案：
//   auto   —— installer 有该工具的检测标记，`npx superpowers-zh` 直接识别
//   manual —— 无检测标记（或与别的工具共用目录），必须 --tool 指定
//   global —— 项目级目录不被工具自动加载，只有 --global 装到用户级才生效（Hermes）
// 条目数必须等于对外宣称的工具数（TARGETS 22 条 + Copilot CLI 单独计数 = 23），
// scripts/audit.sh 会卡这一点。
const TOOLS = [
  { name: 'Claude Code',    type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto' },
  { name: 'Cursor',         type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto' },
  { name: 'Windsurf',       type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'windsurf' },
  { name: 'Codex CLI',      type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'codex' },
  { name: 'Gemini CLI',     type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'gemini-cli' },
  { name: 'Kiro',           type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'kiro' },
  { name: 'Trae',           type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'trae' },
  { name: 'Qoder',          type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'qoder' },
  { name: 'Aider',          type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'aider' },
  { name: 'OpenCode',       type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'opencode' },
  // Qwen Code = QwenLM/qwen-code 这个命令行工具（Gemini CLI 的 fork），不是通义灵码。
  { name: 'Qwen Code',      type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'qwen' },
  // Antigravity 是 Google 的 AI IDE（antigravity.google），见 docs/README.antigravity.md。
  { name: 'Antigravity',    type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'antigravity' },
  { name: 'DeerFlow 2.0',   type: 'Agent',  cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'deerflow' },
  { name: 'VS Code · Copilot', type: 'IDE', cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'vscode' },
  // Copilot CLI 与 Claude Code 共用 .claude/skills，别名 copilot -> Claude Code，
  // 它自己没有检测标记，所以必须 --tool 指定。
  { name: 'Copilot CLI',    type: 'CLI',    cmd: 'npx superpowers-zh --tool copilot',           mode: 'manual' },
  // Hermes 官方只自动加载 ~/.hermes/skills/，项目级目录要手写 config.yaml 才被发现，
  // 所以这里给的是 --global 的装法（与 README 的一键安装列一致）。
  { name: 'Hermes Agent',   type: 'CLI',    cmd: 'npx superpowers-zh --global --tool hermes',   mode: 'global', doc: 'hermes' },
  { name: 'Claw Code',      type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'claw' },
  { name: 'OpenClaw',       type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'openclaw' },
  { name: 'CodeBuddy',      type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'codebuddy' },
  { name: 'CodeArts',       type: 'IDE',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'codearts' },
  // Cline / Kilo Code 的检测标记是 rules 目录（.clinerules / .kilocode），没建过规则的
  // 项目检测不到，与 README 一致给显式 --tool。
  { name: 'Cline',          type: 'IDE',    cmd: 'npx superpowers-zh --tool cline',             mode: 'manual', doc: 'cline' },
  { name: 'Kilo Code',      type: 'IDE',    cmd: 'npx superpowers-zh --tool kilocode',          mode: 'manual', doc: 'kilocode' },
  { name: 'Crush',          type: 'CLI',    cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'crush' },
  // ZCode（智谱）只有用户级路径有官方出处（zcode.z.ai/docs/skill），项目级不猜 —— 见 installer 注释
  { name: 'ZCode',          type: 'IDE',    cmd: 'npx superpowers-zh --global --tool zcode',    mode: 'global', doc: 'zcode' },
  { name: 'DeepSeek Harness', type: 'CLI', cmd: 'npx superpowers-zh',                          mode: 'auto', doc: 'deepseek-harness' },
];

// ---- 双语文案 ----
// ---- 赞助商（与 README / README.zh-Hant 的赞助商区块同源；改这里也要同步改 README） ----
// 注意：链接是赞助方的推广链接，外链一律带 rel="sponsored nofollow noopener"。
const SPONSORS = [
  {
    // 旗舰位：赞助商页顶部整块大图 + 两版 README 顶部优先展示。
    // 旗舰卡读 img（大 banner），不读 logo —— 见下方 assertSponsors 的校验。
    tier: 'flagship',
    img: 'infistar.jpg', w: 1269, h: 337, code: '',
    url: 'https://www.infistar.cc/register?aff=PDVTM2VS&ref_source=link',
    name: { zh: 'Infistar.cc 无限星河', en: 'Infistar.cc', zht: 'Infistar.cc 無限星河' },
    tagline: {
      zh: '全模型 API · 一个 Key 接入 Claude / GPT / Gemini，低至官方 1 折',
      en: 'All-model API · one key for Claude / GPT / Gemini, from 10% of list price',
      zht: '全模型 API · 一個 Key 接入 Claude / GPT / Gemini，低至官方 1 折',
    },
    alt: {
      zh: 'Infistar.cc 无限星河 —— 全模型 API 服务，一个 API Key 接入 Claude、ChatGPT、Gemini、Kimi、GLM、DeepSeek，价格低至官方渠道 1 折',
      en: 'Infistar.cc — all-model API service: one API key for Claude, ChatGPT, Gemini, Kimi, GLM and DeepSeek, from 10% of official pricing',
      zht: 'Infistar.cc 無限星河 —— 全模型 API 服務，一個 API Key 接入 Claude、ChatGPT、Gemini、Kimi、GLM、DeepSeek，價格低至官方渠道 1 折',
    },
    // 旗舰卡按赞助商原文的三条要点分段展示（常规卡才用整段 desc）。
    // 压成一整段会把人家文案的骨架揉掉，也不好扫读 —— 付费展位按原结构呈现。
    points: {
      zh: [
        { icon: '⚡', t: '稳定承载复杂开发任务', d: '高可用模型通道与多节点冗余，价格低至官方渠道 1 折，稳定支持需求分析、方案规划、TDD、调试及代码审查等长任务。' },
        { icon: '🧠', t: '一个 API Key 接入主流模型', d: '全面支持 Claude、ChatGPT、Gemini、Kimi、GLM、DeepSeek 等模型，适配 Claude Code、Codex、Cursor、Windsurf、Kiro 等 AI 编程工具。' },
        { icon: '🛠️', t: '赋能完整开发工作流', d: '结合 superpowers-zh 的系统化 Skills，让 AI 更好地完成头脑风暴、计划执行、问题排查和质量检查。' },
      ],
      en: [
        { icon: '⚡', t: 'Built for long-running dev tasks', d: 'High-availability model channels with multi-node redundancy, from 10% of official pricing — steady across requirements analysis, planning, TDD, debugging and code review.' },
        { icon: '🧠', t: 'One API key, every major model', d: 'Full support for Claude, ChatGPT, Gemini, Kimi, GLM and DeepSeek, wired for Claude Code, Codex, Cursor, Windsurf and Kiro.' },
        { icon: '🛠️', t: 'Powers the whole workflow', d: 'Paired with the systematic skills in superpowers-zh, so the AI holds up through brainstorming, plan execution, troubleshooting and quality checks.' },
      ],
      zht: [
        { icon: '⚡', t: '穩定承載複雜開發任務', d: '高可用模型通道與多節點冗餘，價格低至官方渠道 1 折，穩定支援需求分析、方案規劃、TDD、除錯及程式碼審查等長任務。' },
        { icon: '🧠', t: '一個 API Key 接入主流模型', d: '全面支援 Claude、ChatGPT、Gemini、Kimi、GLM、DeepSeek 等模型，適配 Claude Code、Codex、Cursor、Windsurf、Kiro 等 AI 編程工具。' },
        { icon: '🛠️', t: '賦能完整開發工作流', d: '結合 superpowers-zh 的系統化 Skills，讓 AI 更好地完成頭腦風暴、計畫執行、問題排查和品質檢查。' },
      ],
    },
    perk: {
      zh: '🎁 通过本页链接注册并完成首次调用，即可领取 5 美元等值测试额度',
      en: '🎁 Sign up via this link and make your first call to claim $5 in test credit',
      zht: '🎁 透過本頁連結註冊並完成首次呼叫，即可領取 5 美元等值測試額度',
    },
    perkShort: {
      zh: '注册并完成首次调用领 5 美元等值测试额度',
      en: '$5 test credit after your first call',
      zht: '註冊並完成首次呼叫領 5 美元等值測試額度',
    },
  },
  {
    tier: 'standard',
    img: 'compshare.jpg', w: 800, h: 368, code: '',
    logo: 'logo-compshare-icon.png',
    url: 'https://passport.compshare.cn/register?referral_code=ETD3L5JBM13CtKARkMORot&ytag=GPU_YY_YX_git_superpowers-zh',
    name: { zh: '优云智算', en: 'CompShare by UCloud', zht: '優雲智算' },
    tagline: {
      zh: 'UCloud 旗下 AI 云平台 · 国产模型 Agent Plan 套餐低至 49 元/月',
      en: 'UCloud\u2019s AI cloud · Agent Plans for Chinese models from ¥49/month',
      zht: 'UCloud 旗下 AI 雲平台 · 國產模型 Agent Plan 套餐低至 49 元/月',
    },
    alt: {
      zh: '优云智算 by UCloud — 热门国产模型按次调用套餐包，低至 49 元/月起',
      en: 'CompShare by UCloud — pay-per-call plans for popular Chinese models, from ¥49/month',
      zht: '優雲智算 by UCloud — 熱門國產模型按次調用套餐包，低至 49 元/月起',
    },
    desc: {
      zh: 'UCloud 旗下 AI 云平台，主打包月 / 按次的高性价比国模 Agent Plan 套餐，支持 GLM-5.2，低至 49 元/月起。同时提供官转稳定海外模型，支持接入 Claude Code、Codex 及 API 调用；企业高并发、7×24 技术支持、自助开票。',
      en: 'UCloud\u2019s AI cloud platform. Cost-effective monthly / pay-per-call Agent Plans for Chinese models (incl. GLM-5.2) from ¥49/month, plus stable access to overseas models. Works with Claude Code, Codex and direct API calls; enterprise concurrency, 24/7 support, self-service invoicing.',
      zht: 'UCloud 旗下 AI 雲平台，主打包月 / 按次的高性價比國模 Agent Plan 套餐，支援 GLM-5.2，低至 49 元/月起。同時提供官轉穩定海外模型，支援接入 Claude Code、Codex 及 API 呼叫；企業高併發、7×24 技術支援、自助開票。',
    },
    perk: {
      zh: '🎁 通过本页链接注册，可得免费 5 元平台体验金',
      en: '🎁 Sign up via this link to get ¥5 free platform credit',
      zht: '🎁 透過本頁連結註冊，可得免費 5 元平台體驗金',
    },
    perkShort: { zh: '新用户注册立得 5 元平台体验金', en: '¥5 free platform credit on sign-up', zht: '新使用者註冊立得 5 元平台體驗金' },
  },
  {
    tier: 'standard',
    img: 'cubence.jpg', w: 800, h: 333, code: 'AGENCY',
    logo: 'logo-cubence-icon.png',
    url: 'https://cubence.com/signup?code=SCW29JP9',
    name: { zh: 'Cubence', en: 'Cubence', zht: 'Cubence' },
    tagline: {
      zh: '专业 AI API 网关 · 支持 Claude Code / Codex / Gemini',
      en: 'AI API gateway · Claude Code / Codex / Gemini',
      zht: '專業 AI API 閘道 · 支援 Claude Code / Codex / Gemini',
    },
    alt: {
      zh: 'Cubence — 专业 AI API 网关，稳定高效的 API 中转服务，支持 Claude Code、Codex、Gemini 等多种模型',
      en: 'Cubence — AI API gateway with stable relay service for Claude Code, Codex, Gemini and more',
      zht: 'Cubence — 專業 AI API 閘道，穩定高效的 API 中轉服務，支援 Claude Code、Codex、Gemini 等多種模型',
    },
    desc: {
      zh: '专业 AI API 网关，致力于提供稳定、高效的 API 中转服务。自 2025 年 9 月运营至今，支持 Claude Code、Codex、Gemini 等多种模型。',
      en: 'A professional AI API gateway focused on stable, efficient relay service. Running since September 2025, with support for Claude Code, Codex, Gemini and more.',
      zht: '專業 AI API 閘道，致力於提供穩定、高效的 API 中轉服務。自 2025 年 9 月營運至今，支援 Claude Code、Codex、Gemini 等多種模型。',
    },
    perk: {
      zh: '🎁 本项目用户专属优惠码 AGENCY，通过本页链接注册首次购买 9 折',
      en: '🎁 Code AGENCY for this project\u2019s users — 10% off your first purchase via this link',
      zht: '🎁 本專案使用者專屬優惠碼 AGENCY，透過本頁連結註冊首次購買 9 折',
    },
    perkShort: { zh: '首次购买 9 折优惠', en: '10% off your first purchase', zht: '首次購買 9 折優惠' },
  },
  {
    tier: 'standard',
    img: 'apimart.jpg', w: 2172, h: 724, code: '',
    logo: 'logo-apimart-icon.png',
    url: 'https://go.apimart.ai/gh-superpowers-zh',
    name: { zh: 'APIMart', en: 'APIMart', zht: 'APIMart' },
    alt: {
      zh: 'APIMart —— 专注 AI 图片/视频生成的低价 API 平台，GPT-Image-2 低至 $0.006/张，1 美元可出图 160+ 张',
      en: 'APIMart — low-cost API platform for AI image & video generation, GPT-Image-2 from $0.006 per image, 160+ images per dollar',
      zht: 'APIMart —— 專注 AI 圖片/影片生成的低價 API 平台，GPT-Image-2 低至 $0.006/張，1 美元可出圖 160+ 張',
    },
    desc: {
      zh: '专注 AI 图片/视频生成的低价 API 平台，GPT-Image-2 低至 $0.006/张，1 美元可出图 160+ 张。图片、视频一套异步 API 通吃，提交任务拿 ID、回调取结果，跑批万张不超时、换模型不改代码。按量付费、无月费。',
      en: 'A low-cost API platform for AI image & video generation — GPT-Image-2 from $0.006/image, 160+ images per dollar. One async API covers both image and video: submit a task, get an ID, fetch results via polling or callback. Batch tens of thousands of images without timeouts, switch models without changing code. Pay-as-you-go with no monthly fee.',
      zht: '專注 AI 圖片/影片生成的低價 API 平台，GPT-Image-2 低至 $0.006/張，1 美元可出圖 160+ 張。圖片、影片一套非同步 API 通吃，提交任務拿 ID、回呼取結果，跑批萬張不逾時、換模型不改程式碼。按量付費、無月費。',
    },
    perk: {
      zh: '🎁 通过本页链接注册即可开用：按量付费、无月费，GPT-Image-2 低至 $0.006/张',
      en: '🎁 Sign up via this link to start: pay-as-you-go, no monthly fee, GPT-Image-2 from $0.006/image',
      zht: '🎁 透過本頁連結註冊即可開用：按量付費、無月費，GPT-Image-2 低至 $0.006/張',
    },
    perkShort: {
      zh: '按量付费无月费，GPT-Image-2 低至 $0.006/张',
      en: 'Pay-as-you-go, no monthly fee, from $0.006/image',
      zht: '按量付費無月費，GPT-Image-2 低至 $0.006/張',
    },
  },
];

// 赞助位是付费展示位，图挂了就是事故。旗舰卡读 img、常规卡读 logo，两条路径
// 各自需要的字段不同 —— 把 tier 从 flagship 改成 standard 而忘了配 logo，
// 页面上就是一个静默的碎图。构建时直接拦下来，不让它上线。
// 工具墙上挂的每个文档链接都必须真的存在 —— 官网链到 GitHub 上一个不存在的
// docs/README.*.md，就是又一条「编造出处」，而这正是本仓已经栽过的坑。
function assertToolDocs() {
  for (const x of TOOLS) {
    if (!x.doc) continue;
    const f = join(ROOT, 'docs', `README.${x.doc}.md`);
    if (!existsSync(f)) throw new Error(`工具 ${x.name} 的文档不存在：docs/README.${x.doc}.md`);
  }
}
assertToolDocs();

function assertSponsors() {
  for (const s of SPONSORS) {
    const need = s.tier === 'flagship' ? ['img', 'w', 'h', 'points'] : ['logo', 'desc'];
    const missing = need.filter(k => !s[k]);
    if (missing.length) {
      throw new Error(`赞助商 ${s.name?.zh || '?'}（tier: ${s.tier}）缺字段：${missing.join(', ')}`);
    }
    for (const f of [s.img, s.logo].filter(Boolean)) {
      if (!existsSync(join(ROOT, 'assets', 'sponsors', f))) {
        throw new Error(`赞助商 ${s.name?.zh || '?'} 的素材不存在：assets/sponsors/${f}`);
      }
      // 声明的 w/h 必须与素材真实尺寸一致 —— 换了图忘了改数字，页面就按错的宽高比预留位置
      if (f === s.img) {
        const real = imageSize(join(ROOT, 'assets', 'sponsors', f));
        if (real.w !== s.w || real.h !== s.h) {
          throw new Error(`赞助商 ${s.name?.zh || '?'} 的 banner 尺寸对不上：声明 ${s.w}×${s.h}，实际 ${real.w}×${real.h}`);
        }
      }
    }
    const textKeys = s.tier === 'flagship'
      ? ['name', 'tagline', 'alt', 'perk', 'perkShort']
      : ['name', 'alt', 'desc', 'perk', 'perkShort'];   // 常规卡不展示 tagline
    for (const k of textKeys) {
      for (const lang of ['zh', 'en', 'zht']) {
        if (!s[k]?.[lang]) throw new Error(`赞助商 ${s.name?.zh || '?'} 的 ${k} 缺 ${lang} 文案`);
      }
    }
    // 旗舰的要点分段：三语条数必须一致，少一条就是某个语言漏翻了
    if (s.tier === 'flagship') {
      const counts = ['zh', 'en', 'zht'].map(l => s.points?.[l]?.length || 0);
      if (counts.some(n => n === 0) || new Set(counts).size > 1) {
        throw new Error(`赞助商 ${s.name?.zh || '?'} 的 points 三语条数不一致：zh/en/zht = ${counts.join('/')}`);
      }
      for (const l of ['zh', 'en', 'zht']) {
        for (const pt of s.points[l]) {
          if (!pt.icon || !pt.t || !pt.d) throw new Error(`赞助商 ${s.name?.zh || '?'} 的 ${l} 要点缺 icon/t/d`);
        }
      }
    }
  }
}
assertSponsors();

const T = {
  zh: {
    htmlLang: 'zh-CN',
    title: 'superpowers-zh · AI 编程超能力中文增强版',
    desc: 'superpowers（250k+ ⭐）完整汉化 + 4 个中国原创 skills，一条 npx 命令为 25 款 AI 编程工具装上系统化工作方法论。',
    nav: { why: '特性', install: '安装', skills: 'Skills', tools: '支持工具', faq: 'FAQ', sponsors: '赞助商', learn: '学习 ↗', github: 'GitHub ↗' },
    heroBadge: 'superpowers 250k+ ⭐ · 完整汉化 + 中国原创',
    heroH1: '给你的 AI 编程工具<br>装上<span class="grad">真正会干活</span>的超能力',
    heroLead: '{n} 个经过实战验证的工作方法论 skill —— 从头脑风暴到 TDD，从系统化调试到代码审查。<br>一条命令，自动识别项目里的工具并安装。',
    heroBtn1: '查看安装命令', heroBtn2: 'GitHub 源码',
    stats: ['Skills', '中国原创', '支持工具', '当前版本'],
    skipToMain: '跳到主要内容',
    ogAlt: 'superpowers-zh —— AI 编程超能力中文增强版，一条 npx 命令为 25 款 AI 编程工具装上系统化工作方法论',
    ogLocale: 'zh_CN',
    releaseNote: '{tools} 的用户请更新 —— 此前版本里技能之间互相调用会失败。查看完整更新说明',
    toolDocHint: '{name} 的专属安装指南',
    whyTitle: '为什么选择 superpowers-zh？',
    whySub: '不是又一套提示词模板 —— 是让 AI 真正按工程方法干活的系统化能力。',
    plTitle: '一条龙工作流，每一步都有 skill 把关',
    plSub: 'skill 之间彼此衔接，AI 会在合适的节点自动触发对应方法论。',
    cmpTitle: '装上之后，AI 不再"上来就写"',
    cmpBad: '❌ 没装', cmpGood: '✅ 装了 superpowers-zh',
    cmpBadPre: '你：给用户模块加个批量导出功能\nAI：好的，我来实现……（直接开写）\n    export async function exportUsers() { … }\n你：等等，格式不对，没分页，\n    大数据量会 OOM……',
    cmpGoodPre: '你：给用户模块加个批量导出功能\nAI：先理清需求 —— 导出格式？数据量级？\n    要分页/流式吗？要权限校验吗？\n    （触发 brainstorming）\n    → 写计划 → TDD → 验证 → 审查',
    instTitle: '选你的工具，拿到安装命令',
    instSub: '大多数工具 <code>npx superpowers-zh</code> 会自动识别项目目录并安装；识别不出的用 <code>--tool</code> 指定。',
    instLabel: '我用的是',
    instNoteAuto: '在你的项目根目录运行，<b>自动识别 {name}</b> 并安装。安装后重启工具即可生效。',
    instNoteManual: '{name} 无法自动识别，需用 <code>--tool</code> 显式指定。在项目根目录运行，安装后重启工具即可生效。',
    instNoteGlobal: '{name} 只会自动加载用户级目录，项目级要手写配置才生效 —— 所以直接用 <code>--global</code> 装到用户级，在任意目录运行即可。',
    skTitle: '{n} 个 Skill，覆盖开发全流程',
    skSub: '点击任意卡片查看完整操作文档。',
    skSearch: '搜索 skill…（如 调试 / review / TDD）',
    skEmpty: '没有匹配的 skill。',
    skDetail: '查看文档 →',
    tagCn: '中国原创',
    ucTitle: '典型使用场景', ucSub: '每个场景背后都是一组协同工作的 skill。',
    toolsTitle: '一套 skill，25 款工具通用', toolsSub: '换工具不用换习惯，方法论跟着你走。',
    faqTitle: '常见问题',
    sponsorCta: '了解详情 ↗',
    sponsorNote: '以上为赞助商推广链接。',
    sp: {
      nav: '赞助商',
      title: '赞助商 · superpowers-zh',
      desc: 'superpowers-zh 免费开源、零依赖，由社区赞助商共同支持。本页列出全部赞助商及其为本项目用户提供的专属福利。',
      badge: '开源 · 社区支持',
      h1: '感谢每一位支持者',
      lead: 'superpowers-zh 是一个面向中文开发者的开源项目 —— 永久免费、MIT 协议、零依赖，不设付费墙。它由社区与赞助商共同支撑：本页的赞助位是付费展示位，也正是它们让项目能持续维护下去。我们把每一份支持，都视作让项目走得更远的力量。',
      becomeBtn: '♡ 成为赞助商',
      backBtn: '← 返回首页',
      expand: '展开全部 ∨',
      collapse: '收起 ∧',
      emptyTitle: '旗舰位虚位以待',
      emptyDesc: '本页顶部整块大图展位 + 专属行动按钮，同时在两版 README 顶部优先展示。长期合作可谈，邮件聊聊。',
      emptyBtn: '申请旗舰位 →',
      flagTitle: '旗舰赞助商',
      flagSub: '深度合作伙伴，长期为项目提供关键支持。旗舰位虚位以待，欢迎申请。',
      moreTitle: '更多赞助商',
      moreSub: '感谢这些持续支持本项目、并为用户提供专属优惠的赞助商。',
      visitFlag: '使用专属优惠访问 →',
      copyHint: '点击优惠码一键复制。',
      faqTitle: '常见问题',
      faq: [
        { q: '如何成为 superpowers-zh 的赞助商？', a: '邮件联系 jnMetaCode@qq.com，说明你的产品、目标人群和想要的展位形式。我们会回复可选方案、素材要求和上线时间。' },
        { q: '有哪些合作方案？', a: '分旗舰位与常规位两档：旗舰位在本页顶部单独成块展示，常规位在「更多赞助商」卡片区。两档都含 GitHub 简繁双版 README 展位与官网三语站点露出。具体以邮件沟通为准。' },
        { q: '谈完多久可以上线？', a: '素材齐全后改动会随下一次站点构建发布 —— 本站接的是仓库自动部署，推送即上线，通常当天可见。' },
        { q: '需要准备哪些素材？', a: '一张横版 banner（旗舰位约 1269×337，常规位约 800×368，JPG / PNG）、一句话定位、一段 100 字左右的介绍、落地链接，以及给本项目用户的专属优惠码或福利（可选）。常规位还需一枚方形小图标（约 36×36 显示）。' },
      ],
      listTitle: '当前赞助商',
      listSub: '感谢他们持续支持本项目，并为本项目用户提供专属福利。',
      perkTitle: '专属福利汇总',
      perkSub: '通过本页链接注册即可享受下列福利。',
      thSponsor: '赞助商', thPerk: '专属福利', thCode: '优惠码', thGo: '前往',
      goto: '前往 ↗', noCode: '—',
      benefitTitle: '成为赞助商可以获得什么',
      benefitSub: '面向 AI 编程开发者的精准展位 —— GitHub + 官网双通道曝光。',
      benefits: [
        { icon: '📖', t: 'GitHub README 展位', d: '在简体 / 繁体两版 README 顶部展示 banner + 介绍文案，覆盖 GitHub 上的全部访客。' },
        { icon: '🌐', t: '官网赞助商页展示', d: '官网赞助商页展示，导航栏常驻入口，中文 / EN / 繁體三语站点全部覆盖。' },
        { icon: '🎯', t: '精准开发者受众', d: '本项目用户是正在用 Claude Code / Cursor / Codex 等 25 款 AI 编程工具的开发者 —— 模型与 API 服务的直接买家。' },
        { icon: '🎁', t: '专属优惠码展示', d: '你的专属优惠码 / 福利会在赞助商页的「福利汇总」表里单独列出，方便用户直接使用。' },
      ],
      ctaTitle: '想出现在这里？',
      ctaDesc: '欢迎邮件联系，我们会把展位形式、素材要求和上线时间一次说清。',
      ctaBtn: '✉ jnMetaCode@qq.com',
    },
    bookTitle: '装好之后，配上方法论效率翻倍',
    bookDesc: '《AI 编程实战 · 方法论三卷书》—— 10 个 AI 编程工具完整教程 + 真实踩坑。在线书 + PDF，永久免费。',
    bookBtn: '免费阅读 ↗',
    aiolaolaBtn: '免费学 AI 编程 · aiOlaOla ↗',
    ctaTitle: '准备好让 AI 真正会干活了吗？',
    ctaDesc: '一条命令，{n} 个实战方法论装进你的工具。免费、开源、零依赖。',
    ctaBtn1: '查看安装命令', ctaBtn2: '⭐ Star on GitHub',
    footCols: [
      { h: '产品', links: [['特性', '#why'], ['Skills', '#skills'], ['支持工具', '#tools'], ['FAQ', '#faq'], ['赞助商', 'sponsors.html']] },
      { h: '资源', links: [['GitHub', 'https://github.com/jnMetaCode/superpowers-zh'], ['npm', 'https://www.npmjs.com/package/superpowers-zh'], ['方法论三卷书', 'https://book.aibuzhiyu.com/']] },
      { h: '生态', links: [['aiOlaOla · 从零学会 AI 编程', 'https://aiolaola.com/?utm_source=sp1'], ['X / Twitter', 'https://x.com/jnMetaCode'], ['公众号 AI不止语', 'https://aiolaola.com/'], ['姐妹项目', 'https://github.com/jnMetaCode']] },
      { h: '社区', links: [['提交 Issue', 'https://github.com/jnMetaCode/superpowers-zh/issues'], ['贡献指南', 'https://github.com/jnMetaCode/superpowers-zh/blob/main/CLAUDE.md'], ['联系邮箱', 'mailto:jnMetaCode@qq.com']] },
    ],
    footTag: 'AI 编程超能力 · 中文增强版 · MIT License',
    copyright: '© 2026 superpowers-zh · MIT License',
    followUs: '扫码关注', qrWechat: '公众号 · AI不止语', qrDouyin: '抖音 · @AI不止语（AIBZY）', qrX: 'X / Twitter · @jnMetaCode',
    copy: '复制', copied: '已复制 ✓',
    backToSkills: '← 返回全部 Skill',
    detailInstall: '安装此 skill',
    detailSource: '在 GitHub 查看源文件 ↗',
    features: [
      { icon: '🧠', t: '20 个实战方法论', d: '不是 prompt 模板，是经过跨会话对抗式压力测试调优的工作方法论 —— 从头脑风暴到 TDD、调试、代码审查。' },
      { icon: '🔌', t: '25 款工具通用', d: '一套 skill，Claude Code / Cursor / Codex / Gemini CLI / Windsurf… 全适配，换工具不用换习惯。' },
      { icon: '⚡', t: '一条命令安装', d: 'npx superpowers-zh 自动识别项目里用的是哪款工具并安装，零配置，装完重启即生效。' },
      { icon: '🇨🇳', t: '中国原创 Skills', d: '中文代码审查话术、中文提交规范、中文文档排版、国内 Git 平台（Gitee/Coding/极狐）配置 —— 上游没有。' },
      { icon: '📖', t: '完整汉化上游', d: '同步 obra/superpowers（250k+ ⭐），核心 skill 全部中文母语化，不是机翻，是逐条校准。' },
      { icon: '🔓', t: '零依赖 · MIT 开源', d: '纯 Markdown skill，不引入任何外部依赖、不联网、不上传代码，按需触发零运行时开销。' },
    ],
    pipeline: [
      { n: '头脑风暴', d: '动手前先理清意图与需求' },
      { n: '写计划', d: '把需求拆成可执行步骤' },
      { n: 'TDD', d: '先写测试再写实现' },
      { n: '系统化调试', d: '先复现定位再改' },
      { n: '代码审查', d: '合并前严谨验收' },
      { n: '完成前验证', d: '用证据证明真的好了' },
    ],
    usecases: [
      { tag: '开发新功能', skills: 'brainstorming → writing-plans → TDD', desc: 'AI 先反问需求、写出实现计划，再用测试驱动落地，而不是上来就糊一坨代码。' },
      { tag: '修 Bug', skills: 'systematic-debugging', desc: '强制先复现、定位根因，再提修复方案 —— 杜绝"猜一个改一下"的瞎试循环。' },
      { tag: '提交 / 合并前', skills: 'verification-before-completion → code-review', desc: '必须跑验证命令、拿证据说话，再走一轮代码审查，才允许声称"完成"。' },
      { tag: '国内团队协作', skills: 'chinese-commit-conventions → chinese-code-review', desc: '中文 commit 规范 + 分级 review 话术，配 Gitee / Coding / 极狐 GitLab 工作流。' },
    ],
    faq: [
      { q: 'superpowers-zh 是免费的吗？', a: '完全免费。MIT 协议开源，永久免费，不含任何付费墙或订阅。' },
      { q: '支持哪些 AI 编程工具？', a: '共 25 款：Claude Code、Cursor、Windsurf、Codex CLI、Gemini CLI、Kiro、Trae、Qoder、CodeBuddy（腾讯）、CodeArts（华为云码道）、Aider、OpenCode、Qwen Code、Antigravity、DeerFlow、VS Code(Copilot)、Copilot CLI、Hermes Agent、Claw Code、OpenClaw、Cline、Kilo Code、Crush、ZCode（智谱）、DeepSeek Harness。' },
      { q: 'superpowers-zh 有哪些独特价值？', a: '一套完整中文化的系统工作方法论：从头脑风暴、规划、TDD 到调试、代码审查，每个 skill 都是实战验证的工作流；并叠加 4 个面向中国开发者的原创 skill（中文代码审查 / Git 工作流 / 文档规范 / 提交规范），适配 25 款 AI 编程工具。MIT 协议开源，永久免费。' },
      { q: '安装后怎么生效？', a: 'npx 会把 skill 文件装到你项目对应工具的目录（如 .claude/skills/），重启 AI 工具后，它会在恰当时机自动触发相应 skill —— 无需你每次手动调用。' },
      { q: '能一次装好、所有项目都用吗？（全局安装）', a: '能。npx superpowers-zh --global 装到工具的用户级目录（如 ~/.claude/skills），所有项目自动共享，更新时只需重装一次。项目级优先、全局兜底，二者可共存。支持全局的工具（13 款，均为各工具文档确认的加载路径）：Claude Code / Codex CLI / Qoder / Windsurf / Qwen Code / OpenClaw / OpenCode / Hermes Agent / CodeBuddy / CodeArts / Crush / ZCode / DeepSeek Harness；其余工具（含 Gemini / Antigravity，有各自专属全局方式）请在项目内安装或参考对应文档。' },
      { q: '会拖慢我的 AI 吗？会上传代码吗？', a: '不会。skill 是按需触发的纯 Markdown，零运行时、不联网、不上传任何代码或数据，全程在本地。' },
      { q: '怎么更新或卸载？', a: '更新：重新运行 npx superpowers-zh 覆盖即可。卸载：npx superpowers-zh --uninstall 清理当前项目；全局安装用 npx superpowers-zh --global --uninstall 清理。' },
    ],
  },
  en: {
    htmlLang: 'en',
    title: 'superpowers-zh · Battle-tested AI coding skills (CN-enhanced)',
    desc: 'Full Chinese localization of superpowers (250k+ ⭐) plus 4 China-native skills. One npx command installs systematic workflow methodology into 25 AI coding tools.',
    nav: { why: 'Features', install: 'Install', skills: 'Skills', tools: 'Tools', faq: 'FAQ', sponsors: 'Sponsors', learn: 'Learn ↗', github: 'GitHub ↗' },
    heroBadge: 'superpowers 250k+ ⭐ · Full CN localization + China-native skills',
    heroH1: 'Give your AI coding tools<br>superpowers that <span class="grad">actually ship</span>',
    heroLead: '{n} battle-tested workflow skills — from brainstorming to TDD, systematic debugging to code review.<br>One command auto-detects your tool and installs.',
    heroBtn1: 'Get the command', heroBtn2: 'GitHub',
    stats: ['Skills', 'China-native', 'Tools', 'Version'],
    skipToMain: 'Skip to main content',
    ogAlt: 'superpowers-zh — battle-tested AI coding skills, Chinese-enhanced; one npx command for 25 AI coding tools',
    ogLocale: 'en_US',
    releaseNote: 'Using {tools}? Update — in earlier versions skills could not invoke one another. Read the full release notes',
    toolDocHint: 'Install guide for {name}',
    whyTitle: 'Why superpowers-zh?',
    whySub: 'Not another prompt-template pack — real engineering methodology that makes AI work properly.',
    plTitle: 'An end-to-end workflow, every step guarded by a skill',
    plSub: 'Skills chain together; the AI triggers the right methodology at the right moment.',
    cmpTitle: 'After install, AI stops "coding before thinking"',
    cmpBad: '❌ Without', cmpGood: '✅ With superpowers-zh',
    cmpBadPre: 'You: Add bulk export to the users module\nAI: Sure, implementing… (starts coding)\n    export async function exportUsers() { … }\nYou: Wait — wrong format, no paging,\n    it OOMs on large data…',
    cmpGoodPre: 'You: Add bulk export to the users module\nAI: First, the requirements — what format?\n    What data volume? Paging/streaming?\n    Permission checks? (triggers brainstorming)\n    → plan → TDD → verify → review',
    instTitle: 'Pick your tool, get the command',
    instSub: 'For most tools <code>npx superpowers-zh</code> auto-detects the project and installs; otherwise pass <code>--tool</code>.',
    instLabel: "I'm using",
    instNoteAuto: 'Run it in your project root — it <b>auto-detects {name}</b> and installs. Restart the tool to take effect.',
    instNoteManual: '{name} can\'t be auto-detected; pass <code>--tool</code> explicitly. Run in the project root, then restart the tool.',
    instNoteGlobal: '{name} only auto-loads its user-level directory — a project-level install needs manual config. Install with <code>--global</code> instead; run it from anywhere.',
    skTitle: '{n} skills, covering the whole dev workflow',
    skSub: 'Click any card for the full operating doc.',
    skSearch: 'Search skills… (e.g. debug / review / TDD)',
    skEmpty: 'No matching skills.',
    skDetail: 'Read docs →',
    tagCn: 'China-native',
    ucTitle: 'Typical use cases', ucSub: 'Each scenario is backed by a set of cooperating skills.',
    toolsTitle: 'One skill set, 25 tools', toolsSub: 'Switch tools without switching habits — the methodology follows you.',
    faqTitle: 'FAQ',
    sponsorCta: 'Learn more ↗',
    sponsorNote: 'Links above are sponsored links.',
    sp: {
      nav: 'Sponsors',
      title: 'Sponsors · superpowers-zh',
      desc: 'superpowers-zh is free, open source and dependency-free, supported by community sponsors. This page lists every sponsor and the perks they offer to users of this project.',
      badge: 'Open source · Community backed',
      h1: 'Thanks to everyone who backs this project',
      lead: 'superpowers-zh is an open source project for Chinese-speaking developers — free forever, MIT licensed, dependency-free, no paywall. It is kept going by its community and its sponsors: the slots on this page are paid placements, and they are what makes continued maintenance possible. Every bit of support takes the project further.',
      becomeBtn: '♡ Become a sponsor',
      backBtn: '← Back to home',
      expand: 'Read more ∨',
      collapse: 'Show less ∧',
      emptyTitle: 'The flagship slot is open',
      emptyDesc: 'A full-width banner block at the top of this page with its own call-to-action button, plus priority placement at the top of both READMEs. Long-term partnerships welcome — drop us an email.',
      emptyBtn: 'Apply for the flagship slot →',
      flagTitle: 'Flagship sponsor',
      flagSub: 'A long-term partner backing this project. The flagship slot is open — get in touch.',
      moreTitle: 'More sponsors',
      moreSub: 'Thanks to everyone backing this project and offering perks to its users.',
      visitFlag: 'Claim the offer →',
      copyHint: 'Click a code to copy it.',
      faqTitle: 'FAQ',
      faq: [
        { q: 'How do I become a sponsor?', a: 'Email jnMetaCode@qq.com with your product, target audience and the placement you have in mind. We will reply with options, asset specs and timing.' },
        { q: 'What tiers are there?', a: 'Two: flagship, which gets its own block at the top of this page, and standard, which appears in the sponsor card grid. Both include placement in the Simplified and Traditional Chinese READMEs on GitHub and across all three site locales. Exact terms are settled over email.' },
        { q: 'How soon does it go live?', a: 'Once assets are in, the change ships with the next site build — the site deploys straight from the repo, so it is usually live the same day.' },
        { q: 'What assets do you need?', a: 'A landscape banner (around 1269×337 for the flagship slot, 800×368 for standard, JPG / PNG), a one-line positioning statement, a short paragraph of copy, a landing URL, and optionally a promo code or perk for this project\u2019s users. Standard slots also need a square icon (shown at 36×36).' },
      ],
      listTitle: 'Current sponsors',
      listSub: 'Thanks for backing this project — and for the perks they offer to its users.',
      perkTitle: 'All perks at a glance',
      perkSub: 'Sign up through the links on this page to claim them.',
      thSponsor: 'Sponsor', thPerk: 'Perk', thCode: 'Code', thGo: 'Go',
      goto: 'Visit ↗', noCode: '—',
      benefitTitle: 'What sponsors get',
      benefitSub: 'A focused placement in front of AI-coding developers — on GitHub and on the site.',
      benefits: [
        { icon: '📖', t: 'GitHub README placement', d: 'Banner plus copy at the top of both the Simplified and Traditional Chinese READMEs, seen by every GitHub visitor.' },
        { icon: '🌐', t: 'Website placement', d: 'Listed on the sponsors page, reachable from the main nav on every page, across all three locales (CN / EN / TW).' },
        { icon: '🎯', t: 'A developer audience', d: 'Our users are developers running Claude Code, Cursor, Codex and 22 other AI coding tools — direct buyers of model and API services.' },
        { icon: '🎁', t: 'Your promo code, listed', d: 'Your code or offer gets its own row in the perks table on this page, ready for users to copy.' },
      ],
      ctaTitle: 'Want your logo here?',
      ctaDesc: 'Drop us an email and we will walk you through placements, assets and timing in one go.',
      ctaBtn: '✉ jnMetaCode@qq.com',
    },
    bookTitle: 'Pair it with the methodology for 2× efficiency',
    bookDesc: '"AI Coding in Practice · The Three-Volume Methodology" — full tutorials for 10 AI coding tools plus real-world pitfalls. Online book + PDF, free forever.',
    bookBtn: 'Read free ↗',
    aiolaolaBtn: 'Learn AI coding free · aiOlaOla ↗',
    ctaTitle: 'Ready to make your AI actually ship?',
    ctaDesc: 'One command installs {n} battle-tested skills into your tool. Free, open-source, zero-dependency.',
    ctaBtn1: 'Get the command', ctaBtn2: '⭐ Star on GitHub',
    footCols: [
      { h: 'Product', links: [['Features', '#why'], ['Skills', '#skills'], ['Tools', '#tools'], ['FAQ', '#faq'], ['Sponsors', 'sponsors.html']] },
      { h: 'Resources', links: [['GitHub', 'https://github.com/jnMetaCode/superpowers-zh'], ['npm', 'https://www.npmjs.com/package/superpowers-zh'], ['Methodology book', 'https://book.aibuzhiyu.com/']] },
      { h: 'Ecosystem', links: [['aiOlaOla', 'https://aiolaola.com/?utm_source=sp1'], ['X / Twitter', 'https://x.com/jnMetaCode'], ['Sister projects', 'https://github.com/jnMetaCode']] },
      { h: 'Community', links: [['Open an Issue', 'https://github.com/jnMetaCode/superpowers-zh/issues'], ['Contributing', 'https://github.com/jnMetaCode/superpowers-zh/blob/main/CLAUDE.md'], ['Contact', 'mailto:jnMetaCode@qq.com']] },
    ],
    footTag: 'AI coding superpowers · Chinese-enhanced · MIT License',
    copyright: '© 2026 superpowers-zh · MIT License',
    followUs: 'Follow us', qrWechat: 'WeChat · AI不止语', qrDouyin: 'Douyin · @AI不止语 (AIBZY)', qrX: 'X / Twitter · @jnMetaCode',
    copy: 'Copy', copied: 'Copied ✓',
    backToSkills: '← Back to all skills',
    detailInstall: 'Install this skill set',
    detailSource: 'View source on GitHub ↗',
    features: [
      { icon: '🧠', t: '20 battle-tested methods', d: 'Not prompt templates — workflow methodology hardened by cross-session adversarial testing, from brainstorming to TDD, debugging and review.' },
      { icon: '🔌', t: 'Works in 25 tools', d: 'One skill set for Claude Code / Cursor / Codex / Gemini CLI / Windsurf and more. Switch tools, keep your habits.' },
      { icon: '⚡', t: 'One-command install', d: 'npx superpowers-zh auto-detects your tool and installs. Zero config; restart to take effect.' },
      { icon: '🇨🇳', t: 'China-native skills', d: 'Chinese code-review phrasing, commit conventions, doc typography, and domestic Git platforms (Gitee/Coding/JiHu) — not in upstream.' },
      { icon: '📖', t: 'Fully localized upstream', d: 'Tracks obra/superpowers (250k+ ⭐); every core skill localized into native Chinese — calibrated, not machine-translated.' },
      { icon: '🔓', t: 'Zero-dep · MIT', d: 'Pure Markdown skills. No external deps, no network, no code upload. Triggered on demand with zero runtime cost.' },
    ],
    pipeline: [
      { n: 'Brainstorm', d: 'Clarify intent before coding' },
      { n: 'Plan', d: 'Break work into steps' },
      { n: 'TDD', d: 'Test first, then implement' },
      { n: 'Debug', d: 'Reproduce & locate first' },
      { n: 'Review', d: 'Rigorous pre-merge check' },
      { n: 'Verify', d: 'Prove it with evidence' },
    ],
    usecases: [
      { tag: 'New feature', skills: 'brainstorming → writing-plans → TDD', desc: 'AI questions the requirements, writes a plan, then builds test-first — instead of dumping code immediately.' },
      { tag: 'Fixing a bug', skills: 'systematic-debugging', desc: 'Forces reproduce-and-locate-root-cause before any fix — no more "guess and tweak" loops.' },
      { tag: 'Before merge', skills: 'verification-before-completion → code-review', desc: 'Must run verification with evidence, then a review pass, before claiming "done".' },
      { tag: 'CN team workflow', skills: 'chinese-commit-conventions → chinese-code-review', desc: 'Chinese commit conventions + tiered review phrasing, wired for Gitee / Coding / JiHu GitLab.' },
    ],
    faq: [
      { q: 'Is superpowers-zh free?', a: 'Completely free. MIT-licensed open source, forever, with no paywall or subscription.' },
      { q: 'Which AI coding tools are supported?', a: '25 tools: Claude Code, Cursor, Windsurf, Codex CLI, Gemini CLI, Kiro, Trae, Qoder, CodeBuddy (Tencent), CodeArts (Huawei), Aider, OpenCode, Qwen Code, Antigravity, DeerFlow, VS Code (Copilot), Copilot CLI, Hermes Agent, Claw Code, OpenClaw, Cline, Kilo Code, Crush, ZCode (Zhipu), DeepSeek Harness.' },
      { q: 'What makes superpowers-zh unique?', a: 'A fully localized, battle-tested methodology framework for Chinese developers: brainstorming, planning, TDD, debugging, and code-review skills, plus 4 China-native skills (code review / Git workflow / docs / commit conventions), adapted for 25 AI coding tools. MIT-licensed and free forever.' },
      { q: 'How does it take effect after install?', a: 'npx installs skill files into your tool\'s directory (e.g. .claude/skills/). After restarting your AI tool, it auto-triggers the right skill at the right moment — no manual invocation needed.' },
      { q: 'Can I install once for all projects? (global install)', a: 'Yes. npx superpowers-zh --global installs into the tool\'s user-level directory (e.g. ~/.claude/skills), shared across all projects; you only re-install once to update. Project-level takes precedence, global is the fallback — they coexist. Tools with global support (13 in total, all verified load paths per each tool\'s docs): Claude Code / Codex CLI / Qoder / Windsurf / Qwen Code / OpenClaw / OpenCode / Hermes Agent / CodeBuddy / CodeArts / Crush / ZCode / DeepSeek Harness; other tools (incl. Gemini / Antigravity, which have their own global methods) should be installed per-project or via their docs.' },
      { q: 'Will it slow my AI down or upload my code?', a: 'No. Skills are on-demand Markdown: zero runtime, no network, no code or data upload — everything stays local.' },
      { q: 'How do I update or uninstall?', a: 'Update: re-run npx superpowers-zh to overwrite. Uninstall: npx superpowers-zh --uninstall for the current project; npx superpowers-zh --global --uninstall for a global install.' },
    ],
  },
  zht: {
    htmlLang: 'zh-Hant',
    title: 'superpowers-zh · AI 編程超能力中文增強版',
    desc: 'superpowers（250k+ ⭐）完整漢化 + 4 個中國原創 skills，一條 npx 命令為 25 款 AI 編程工具裝上系統化工作方法論。',
    nav: { why: '特性', install: '安裝', skills: 'Skills', tools: '支援工具', faq: 'FAQ', sponsors: '贊助商', learn: '學習 ↗', github: 'GitHub ↗' },
    heroBadge: 'superpowers 250k+ ⭐ · 完整漢化 + 中國原創',
    heroH1: '給你的 AI 編程工具<br>裝上<span class="grad">真正會幹活</span>的超能力',
    heroLead: '{n} 個經過實戰驗證的工作方法論 skill —— 從頭腦風暴到 TDD，從系統化除錯到程式碼審查。<br>一條命令，自動識別專案裡的工具並安裝。',
    heroBtn1: '查看安裝命令', heroBtn2: 'GitHub 原始碼',
    stats: ['Skills', '中國原創', '支援工具', '目前版本'],
    skipToMain: '跳到主要內容',
    ogAlt: 'superpowers-zh —— AI 編程超能力中文增強版，一條 npx 命令為 25 款 AI 編程工具裝上系統化工作方法論',
    ogLocale: 'zh_TW',
    releaseNote: '{tools} 的使用者請更新 —— 此前版本裡技能之間互相呼叫會失敗。檢視完整更新說明',
    toolDocHint: '{name} 的專屬安裝指南',
    whyTitle: '為什麼選擇 superpowers-zh？',
    whySub: '不是又一套提示詞範本 —— 是讓 AI 真正按工程方法幹活的系統化能力。',
    plTitle: '一條龍工作流，每一步都有 skill 把關',
    plSub: 'skill 之間彼此銜接，AI 會在合適的節點自動觸發對應方法論。',
    cmpTitle: '裝上之後，AI 不再「上來就寫」',
    cmpBad: '❌ 沒裝', cmpGood: '✅ 裝了 superpowers-zh',
    cmpBadPre: '你：給使用者模組加個批次匯出功能\nAI：好的，我來實作……（直接開寫）\n    export async function exportUsers() { … }\n你：等等，格式不對，沒分頁，\n    大量資料會 OOM……',
    cmpGoodPre: '你：給使用者模組加個批次匯出功能\nAI：先理清需求 —— 匯出格式？資料量級？\n    要分頁/串流嗎？要權限校驗嗎？\n    （觸發 brainstorming）\n    → 寫計畫 → TDD → 驗證 → 審查',
    instTitle: '選你的工具，拿到安裝命令',
    instSub: '大多數工具 <code>npx superpowers-zh</code> 會自動識別專案目錄並安裝；識別不出的用 <code>--tool</code> 指定。',
    instLabel: '我用的是',
    instNoteAuto: '在你的專案根目錄執行，<b>自動識別 {name}</b> 並安裝。安裝後重啟工具即可生效。',
    instNoteManual: '{name} 無法自動識別，需用 <code>--tool</code> 顯式指定。在專案根目錄執行，安裝後重啟工具即可生效。',
    instNoteGlobal: '{name} 只會自動載入使用者級目錄，專案級要手寫設定才生效 —— 所以直接用 <code>--global</code> 裝到使用者級，在任意目錄執行即可。',
    skTitle: '{n} 個 Skill，覆蓋開發全流程',
    skSub: '點擊任意卡片查看完整操作文件。',
    skSearch: '搜尋 skill…（如 除錯 / review / TDD）',
    skEmpty: '沒有符合的 skill。',
    skDetail: '查看文件 →',
    tagCn: '中國原創',
    ucTitle: '典型使用場景', ucSub: '每個場景背後都是一組協同工作的 skill。',
    toolsTitle: '一套 skill，25 款工具通用', toolsSub: '換工具不用換習慣，方法論跟著你走。',
    faqTitle: '常見問題',
    sponsorCta: '了解詳情 ↗',
    sponsorNote: '以上為贊助商推廣連結。',
    sp: {
      nav: '贊助商',
      title: '贊助商 · superpowers-zh',
      desc: 'superpowers-zh 免費開源、零依賴，由社群贊助商共同支持。本頁列出全部贊助商及其為本專案使用者提供的專屬福利。',
      badge: '開源 · 社群支持',
      h1: '感謝每一位支持者',
      lead: 'superpowers-zh 是一個面向中文開發者的開源專案 —— 永久免費、MIT 協議、零依賴，不設付費牆。它由社群與贊助商共同支撐：本頁的贊助位是付費展示位，也正是它們讓專案能持續維護下去。我們把每一份支持，都視作讓專案走得更遠的力量。',
      becomeBtn: '♡ 成為贊助商',
      backBtn: '← 返回首頁',
      expand: '展開全部 ∨',
      collapse: '收起 ∧',
      emptyTitle: '旗艦位虛位以待',
      emptyDesc: '本頁頂部整塊大圖展位 + 專屬行動按鈕，同時在兩版 README 頂部優先展示。長期合作可談，郵件聊聊。',
      emptyBtn: '申請旗艦位 →',
      flagTitle: '旗艦贊助商',
      flagSub: '深度合作夥伴，長期為專案提供關鍵支持。旗艦位虛位以待，歡迎申請。',
      moreTitle: '更多贊助商',
      moreSub: '感謝這些持續支持本專案、並為使用者提供專屬優惠的贊助商。',
      visitFlag: '使用專屬優惠訪問 →',
      copyHint: '點選優惠碼一鍵複製。',
      faqTitle: '常見問題',
      faq: [
        { q: '如何成為 superpowers-zh 的贊助商？', a: '郵件聯絡 jnMetaCode@qq.com，說明你的產品、目標人群和想要的展位形式。我們會回覆可選方案、素材要求和上線時間。' },
        { q: '有哪些合作方案？', a: '分旗艦位與常規位兩檔：旗艦位在本頁頂部單獨成塊展示，常規位在「更多贊助商」卡片區。兩檔都含 GitHub 簡繁雙版 README 展位與官網三語站點露出。具體以郵件溝通為準。' },
        { q: '談完多久可以上線？', a: '素材齊全後改動會隨下一次站點構建釋出 —— 本站接的是倉庫自動部署，推送即上線，通常當天可見。' },
        { q: '需要準備哪些素材？', a: '一張橫版 banner（旗艦位約 1269×337，常規位約 800×368，JPG / PNG）、一句話定位、一段 100 字左右的介紹、落地連結，以及給本專案使用者的專屬優惠碼或福利（可選）。常規位還需一枚方形小圖示（約 36×36 顯示）。' },
      ],
      listTitle: '目前贊助商',
      listSub: '感謝他們持續支持本專案，並為本專案使用者提供專屬福利。',
      perkTitle: '專屬福利彙總',
      perkSub: '透過本頁連結註冊即可享受下列福利。',
      thSponsor: '贊助商', thPerk: '專屬福利', thCode: '優惠碼', thGo: '前往',
      goto: '前往 ↗', noCode: '—',
      benefitTitle: '成為贊助商可以獲得什麼',
      benefitSub: '面向 AI 編程開發者的精準展位 —— GitHub + 官網雙通道曝光。',
      benefits: [
        { icon: '📖', t: 'GitHub README 展位', d: '在簡體 / 繁體兩版 README 頂部展示 banner + 介紹文案，覆蓋 GitHub 上的全部訪客。' },
        { icon: '🌐', t: '官網贊助商頁展示', d: '官網贊助商頁展示，導覽列常駐入口，中文 / EN / 繁體三語站點全部覆蓋。' },
        { icon: '🎯', t: '精準開發者受眾', d: '本專案使用者是正在用 Claude Code / Cursor / Codex 等 25 款 AI 編程工具的開發者 —— 模型與 API 服務的直接買家。' },
        { icon: '🎁', t: '專屬優惠碼展示', d: '你的專屬優惠碼 / 福利會在贊助商頁的「福利彙總」表裡單獨列出，方便使用者直接使用。' },
      ],
      ctaTitle: '想出現在這裡？',
      ctaDesc: '歡迎郵件聯絡，我們會把展位形式、素材要求和上線時間一次說清。',
      ctaBtn: '✉ jnMetaCode@qq.com',
    },
    bookTitle: '裝好之後，配上方法論效率翻倍',
    bookDesc: '《AI 編程實戰 · 方法論三卷書》—— 10 個 AI 編程工具完整教程 + 真實踩坑。線上書 + PDF，永久免費。',
    bookBtn: '免費閱讀 ↗',
    aiolaolaBtn: '免費學 AI 編程 · aiOlaOla ↗',
    ctaTitle: '準備好讓 AI 真正會幹活了嗎？',
    ctaDesc: '一條命令，{n} 個實戰方法論裝進你的工具。免費、開源、零依賴。',
    ctaBtn1: '查看安裝命令', ctaBtn2: '⭐ Star on GitHub',
    footCols: [
      { h: '產品', links: [['特性', '#why'], ['Skills', '#skills'], ['支援工具', '#tools'], ['FAQ', '#faq'], ['贊助商', 'sponsors.html']] },
      { h: '資源', links: [['GitHub', 'https://github.com/jnMetaCode/superpowers-zh'], ['npm', 'https://www.npmjs.com/package/superpowers-zh'], ['方法論三卷書', 'https://book.aibuzhiyu.com/']] },
      { h: '生態', links: [['aiOlaOla · 從零學會 AI 編程', 'https://aiolaola.com/?utm_source=sp1'], ['X / Twitter', 'https://x.com/jnMetaCode'], ['公眾號 AI不止語', 'https://aiolaola.com/'], ['姊妹專案', 'https://github.com/jnMetaCode']] },
      { h: '社群', links: [['提交 Issue', 'https://github.com/jnMetaCode/superpowers-zh/issues'], ['貢獻指南', 'https://github.com/jnMetaCode/superpowers-zh/blob/main/CLAUDE.md'], ['聯絡信箱', 'mailto:jnMetaCode@qq.com']] },
    ],
    footTag: 'AI 編程超能力 · 中文增強版 · MIT License',
    copyright: '© 2026 superpowers-zh · MIT License',
    followUs: '掃碼關注', qrWechat: '公眾號 · AI不止語', qrDouyin: '抖音 · @AI不止語（AIBZY）', qrX: 'X / Twitter · @jnMetaCode',
    copy: '複製', copied: '已複製 ✓',
    backToSkills: '← 返回全部 Skill',
    detailInstall: '安裝此 skill',
    detailSource: '在 GitHub 查看原始檔 ↗',
    features: [
      { icon: '🧠', t: '20 個實戰方法論', d: '不是 prompt 範本，是經過跨會話對抗式壓力測試調優的工作方法論 —— 從頭腦風暴到 TDD、除錯、程式碼審查。' },
      { icon: '🔌', t: '25 款工具通用', d: '一套 skill，Claude Code / Cursor / Codex / Gemini CLI / Windsurf… 全適配，換工具不用換習慣。' },
      { icon: '⚡', t: '一條命令安裝', d: 'npx superpowers-zh 自動識別專案裡用的是哪款工具並安裝，零設定，裝完重啟即生效。' },
      { icon: '🇨🇳', t: '中國原創 Skills', d: '中文程式碼審查話術、中文提交規範、中文文件排版、國內 Git 平台（Gitee/Coding/極狐）設定 —— 上游沒有。' },
      { icon: '📖', t: '完整漢化上游', d: '同步 obra/superpowers（250k+ ⭐），核心 skill 全部中文母語化，不是機翻，是逐條校準。' },
      { icon: '🔓', t: '零依賴 · MIT 開源', d: '純 Markdown skill，不引入任何外部依賴、不連網、不上傳程式碼，按需觸發零執行時開銷。' },
    ],
    pipeline: [
      { n: '頭腦風暴', d: '動手前先理清意圖與需求' },
      { n: '寫計畫', d: '把需求拆成可執行步驟' },
      { n: 'TDD', d: '先寫測試再寫實作' },
      { n: '系統化除錯', d: '先重現定位再改' },
      { n: '程式碼審查', d: '合併前嚴謹驗收' },
      { n: '完成前驗證', d: '用證據證明真的好了' },
    ],
    usecases: [
      { tag: '開發新功能', skills: 'brainstorming → writing-plans → TDD', desc: 'AI 先反問需求、寫出實作計畫，再用測試驅動落地，而不是上來就糊一坨程式碼。' },
      { tag: '修 Bug', skills: 'systematic-debugging', desc: '強制先重現、定位根因，再提修復方案 —— 杜絕「猜一個改一下」的瞎試迴圈。' },
      { tag: '提交 / 合併前', skills: 'verification-before-completion → code-review', desc: '必須跑驗證命令、拿證據說話，再走一輪程式碼審查，才允許聲稱「完成」。' },
      { tag: '國內團隊協作', skills: 'chinese-commit-conventions → chinese-code-review', desc: '中文 commit 規範 + 分級 review 話術，配 Gitee / Coding / 極狐 GitLab 工作流。' },
    ],
    faq: [
      { q: 'superpowers-zh 是免費的嗎？', a: '完全免費。MIT 協議開源，永久免費，不含任何付費牆或訂閱。' },
      { q: '支援哪些 AI 編程工具？', a: '共 25 款：Claude Code、Cursor、Windsurf、Codex CLI、Gemini CLI、Kiro、Trae、Qoder、CodeBuddy（騰訊）、CodeArts（華為雲碼道）、Aider、OpenCode、Qwen Code、Antigravity、DeerFlow、VS Code(Copilot)、Copilot CLI、Hermes Agent、Claw Code、OpenClaw、Cline、Kilo Code、Crush、ZCode（智谱）、DeepSeek Harness。' },
      { q: 'superpowers-zh 有哪些獨特價值？', a: '一套完整中文化的系統工作方法論：從頭腦風暴、規劃、TDD 到除錯、程式碼審查，每個 skill 都是實戰驗證的工作流；並疊加 4 個面向中國開發者的原創 skill（中文程式碼審查 / Git 工作流 / 文件規範 / 提交規範），適配 25 款 AI 編程工具。MIT 協議開源，永久免費。' },
      { q: '安裝後怎麼生效？', a: 'npx 會把 skill 檔案裝到你專案對應工具的目錄（如 .claude/skills/），重啟 AI 工具後，它會在恰當時機自動觸發相應 skill —— 無需你每次手動呼叫。' },
      { q: '能一次裝好、所有專案都用嗎？（全域安裝）', a: '能。npx superpowers-zh --global 裝到工具的使用者級目錄（如 ~/.claude/skills），所有專案自動共享，更新時只需重裝一次。專案級優先、全域兜底，二者可共存。支援全域的工具（13 款，均為各工具文件確認的載入路徑）：Claude Code / Codex CLI / Qoder / Windsurf / Qwen Code / OpenClaw / OpenCode / Hermes Agent / CodeBuddy / CodeArts / Crush / ZCode / DeepSeek Harness；其餘工具（含 Gemini / Antigravity，有各自專屬全域方式）請在專案內安裝或參考對應文件。' },
      { q: '會拖慢我的 AI 嗎？會上傳程式碼嗎？', a: '不會。skill 是按需觸發的純 Markdown，零執行時、不連網、不上傳任何程式碼或資料，全程在本機。' },
      { q: '怎麼更新或解除安裝？', a: '更新：重新執行 npx superpowers-zh 覆蓋即可。解除安裝：npx superpowers-zh --uninstall 清理目前專案；全域安裝用 npx superpowers-zh --global --uninstall 清理。' },
    ],
  },
};

// ---- 读取 skills（含正文） ----
function loadSkills() {
  const skills = [];
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(raw);
    const meta = SKILL_META[entry.name] || { title: entry.name, titleEn: entry.name, descEn: '', group: 'flow' };
    skills.push({
      name: fm.name || entry.name,
      title: meta.title, titleEn: meta.titleEn,
      group: meta.group,
      desc: (fm.description || '').trim(),
      descEn: meta.descEn || '',
      china: meta.group === 'china',
      raw,
    });
  }
  const order = GROUPS.map(g => g.id);
  skills.sort((a, b) => {
    if (a.name === 'using-superpowers') return -1;
    if (b.name === 'using-superpowers') return 1;
    return order.indexOf(a.group) - order.indexOf(b.group);
  });
  return skills;
}

// ---- 多语言配置：新增语言只需往这里加一项 + 写一个 T.<code> 翻译对象 ----
// dir: 该语言站点子目录（根语言为 ''）；hreflang: SEO 语言标记；label: 语言切换器显示名
const LANGS = [
  { code: 'zh',  dir: '',          label: '中文', hreflang: 'zh-CN' },
  { code: 'en',  dir: 'en/',       label: 'EN',   hreflang: 'en' },
  { code: 'zht', dir: 'zh-Hant/',  label: '繁體', hreflang: 'zh-Hant' },
];
const DEFAULT_DIR = LANGS[0].dir; // 根语言（zh）用于 x-default

// ---- 公共布局 ----
// pageClean: 语言无关的 canonical 后缀（首页 ''；skill 页 'skills/<name>'）
// pageFile:  语言无关的文件后缀，用于语言切换链接（首页 ''；skill 页 'skills/<name>.html'）
// base: 资源相对前缀（'' / '../' / '../../'），仅用于品牌链接等相对引用
function layout({ lang, base, title, desc, body, pageClean = '', pageFile = '', extraHead = '' }) {
  const t = T[lang];
  const curDir = LANGS.find(l => l.code === lang).dir;
  const canonical = `/${curDir}${pageClean}`;
  const altLinks = LANGS
    .map(l => `<link rel="alternate" hreflang="${l.hreflang}" href="${SITE_URL}/${l.dir}${pageClean}">`)
    .join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${SITE_URL}/${DEFAULT_DIR}${pageClean}">`;
  const langSwitch = LANGS
    .filter(l => l.code !== lang)
    .map(l => `<a class="lang-switch" href="/${l.dir}${pageFile}">${l.label}</a>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="baidu-site-verification" content="codeva-5WLzyP9gcN">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-L02QK4EVDL"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-L02QK4EVDL');</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE_URL}${canonical}">
${altLinks}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}${canonical}">
<meta property="og:image" content="${SITE_URL}/assets/og-image.jpg?v=${ogVer}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.ogAlt)}">
<meta property="og:site_name" content="superpowers-zh">
<meta property="og:locale" content="${t.ogLocale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE_URL}/assets/og-image.jpg?v=${ogVer}">
<meta name="theme-color" content="#0a0b10">
<link rel="icon" href="/assets/app-icon.png">
<link rel="stylesheet" href="/styles.css?v=${cssVer}">
<script>(function(){try{var m=localStorage.getItem('sp-theme');if(m==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();</script>
${extraHead}</head>
<body>
<a class="skip-link" href="#main">${t.skipToMain}</a>
<header class="nav">
  <a class="brand" href="${base}index.html">
    <img src="/assets/superpowers-small.svg" alt="" width="26" height="26">
    <span>superpowers<b>-zh</b></span>
  </a>
  <nav>
    <a href="${base}index.html#why">${t.nav.why}</a>
    <a href="${base}index.html#install">${t.nav.install}</a>
    <a href="${base}index.html#skills">${t.nav.skills}</a>
    <a href="${base}index.html#tools">${t.nav.tools}</a>
    <a href="${base}index.html#faq">${t.nav.faq}</a>
    <a href="${base}sponsors.html"${pageClean === 'sponsors' ? ' class="active" aria-current="page"' : ''}>${t.nav.sponsors}</a>
    <a href="https://aiolaola.com/?utm_source=sp1" target="_blank" rel="noopener">${t.nav.learn}</a>
    <a href="https://github.com/jnMetaCode/superpowers-zh" target="_blank" rel="noopener">${t.nav.github}</a>
    ${langSwitch}
    <button class="theme-btn" id="themeBtn" aria-label="theme" title="切换主题">◐</button>
  </nav>
</header>
${body}
<footer>
  <div class="foot-qr">
    <h4 class="qr-title">${t.followUs}</h4>
    <div class="qr-row">
      <figure class="qr-card"><img src="/assets/qr-wechat.jpg" alt="${esc(t.qrWechat)}" width="${QR.wechat.w}" height="${QR.wechat.h}" loading="lazy"><figcaption>${t.qrWechat}</figcaption></figure>
      <figure class="qr-card"><img src="/assets/qr-douyin.png" alt="${esc(t.qrDouyin)}" width="${QR.douyin.w}" height="${QR.douyin.h}" loading="lazy"><figcaption>${t.qrDouyin}</figcaption></figure>
      <figure class="qr-card"><a href="https://x.com/jnMetaCode" target="_blank" rel="noopener"><img src="/assets/qr-x.png" alt="${esc(t.qrX)}" width="${QR.x.w}" height="${QR.x.h}" loading="lazy"></a><figcaption><a href="https://x.com/jnMetaCode" target="_blank" rel="noopener">${t.qrX}</a></figcaption></figure>
    </div>
  </div>
  <div class="foot-inner foot-cols">
    <div class="foot-brand">
      <strong>superpowers<b>-zh</b></strong>
      <span>${t.footTag}</span>
    </div>
    ${t.footCols.map(col => `<div class="foot-col"><h4>${col.h}</h4>${col.links.map(l => {
      const ext = l[1].startsWith('http');
      // 站内相对链接（如 sponsors.html）要按当前页面深度补 base；'#' 锚点与外链原样
      const href = (ext || l[1].startsWith('#') || l[1].startsWith('mailto:')) ? l[1] : base + l[1];
      return `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${l[0]}</a>`;
    }).join('')}</div>`).join('')}
  </div>
  <p class="copyright">${t.copyright}</p>
</footer>
<script src="/app.js?v=${jsVer}"></script>
</body>
</html>`;
}

// ---- 首页正文 ----
function renderLanding(skills, lang) {
  const t = T[lang];
  const total = skills.length;
  const cnCount = skills.filter(s => s.china).length;
  const toolData = JSON.stringify(TOOLS.map(x => ({ name: x.name, cmd: x.cmd, mode: x.mode })));
  const fill = (s, map) => s.replace(/\{(\w+)\}/g, (_, k) => map[k]);

  const cards = skills.map(s => {
    const title = lang === 'en' ? s.titleEn : s.title;
    const d = lang === 'en' ? (s.descEn || s.desc) : s.desc;
    return `
      <a class="card" href="skills/${esc(s.name)}.html" data-group="${s.group}" data-name="${esc(s.name)}" data-title="${esc(title)}">
        <div class="card-head"><h3>${esc(title)}</h3>${s.china ? `<span class="tag tag-cn">${t.tagCn}</span>` : ''}</div>
        <code class="card-id">${esc(s.name)}</code>
        <p>${esc(d)}</p>
        <span class="card-more">${t.skDetail}</span>
      </a>`;
  }).join('');

  const filters = GROUPS.map((g, i) =>
    `<button class="chip${i === 0 ? ' active' : ''}" data-filter="${g.id}">${lang === 'zh' ? g.zh : g.en}</button>`).join('');
  const modeTag = { auto: '', manual: '（--tool）', global: '（--global）' };
  const toolOpts = TOOLS.map((x, i) => `<option value="${i}">${esc(x.name)}${modeTag[x.mode] || ''}</option>`).join('');
  // 有专属安装文档的工具，pill 直接链过去 —— docs/ 里 22 份指南此前在官网零暴露，
  // 而「为什么要重装 / 旧布局怎么清 / 该不该用 --global」的答案全在那里。
  const toolWall = TOOLS.map(x => {
    const inner = `<span class="tool-name">${esc(x.name)}</span><span class="tool-type">${esc(x.type)}</span>`;
    return x.doc
      ? `<a class="tool-pill has-doc" href="${GH_BLOB}/docs/README.${x.doc}.md" target="_blank" rel="noopener" title="${esc(fill(t.toolDocHint, { name: x.name }))}">${inner}<span class="tool-doc" aria-hidden="true">↗</span></a>`
      : `<div class="tool-pill">${inner}</div>`;
  }).join('');
  const feats = t.features.map(f => `<article class="feat"><div class="feat-icon">${f.icon}</div><h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></article>`).join('');
  const pipe = t.pipeline.map((p, i) => `<div class="pl-step"><div class="pl-num">${i + 1}</div><div class="pl-body"><b>${esc(p.n)}</b><span>${esc(p.d)}</span></div></div>${i < t.pipeline.length - 1 ? '<div class="pl-arrow">→</div>' : ''}`).join('');
  const ucs = t.usecases.map(u => `<article class="usecase"><span class="uc-tag">${esc(u.tag)}</span><code class="uc-skills">${esc(u.skills)}</code><p>${esc(u.desc)}</p></article>`).join('');
  const faqs = t.faq.map(f => `<details class="faq-item"><summary>${esc(f.q)}</summary><div class="faq-a">${esc(f.a)}</div></details>`).join('');

  return `
<main id="main">
  <section class="hero">
    <div class="badge">${t.heroBadge}</div>
    <h1>${t.heroH1}</h1>
    <p class="lead">${fill(t.heroLead, { n: total })}</p>
    <div class="cmd-hero" data-copy="npx superpowers-zh"><code>$ npx superpowers-zh</code><button class="copy-btn">${t.copy}</button></div>
    <div class="hero-cta">
      <a class="btn btn-primary" href="#install">${t.heroBtn1}</a>
      <a class="btn btn-ghost" href="https://github.com/jnMetaCode/superpowers-zh" target="_blank" rel="noopener">${t.heroBtn2}</a>
    </div>
    <a class="release-note" href="${GH_BLOB}/RELEASE-NOTES.zh.md" target="_blank" rel="noopener">
      <span class="rn-ver">v${LATEST.version}</span>
      <span class="rn-text">${fill(t.releaseNote, { tools: REINSTALL_TOOLS.join(' / ') })}</span>
      <span class="rn-go" aria-hidden="true">→</span>
    </a>
    <div class="stats">
      <div><b>${total}</b><span>${t.stats[0]}</span></div>
      <div><b>${cnCount}</b><span>${t.stats[1]}</span></div>
      <div><b>${TOOLS.length}</b><span>${t.stats[2]}</span></div>
      <div><b>v${PKG.version}</b><span>${t.stats[3]}</span></div>
    </div>
  </section>

  <section id="why" class="why">
    <h2 class="section-title">${t.whyTitle}</h2>
    <p class="section-sub">${t.whySub}</p>
    <div class="feat-grid">${feats}</div>
  </section>

  <section class="pipeline">
    <h2 class="section-title">${t.plTitle}</h2>
    <p class="section-sub">${t.plSub}</p>
    <div class="pl-track">${pipe}</div>
  </section>

  <section class="compare">
    <h2 class="section-title">${t.cmpTitle}</h2>
    <div class="compare-grid">
      <div class="compare-col bad"><div class="compare-label">${t.cmpBad}</div><pre>${esc(t.cmpBadPre)}</pre></div>
      <div class="compare-col good"><div class="compare-label">${t.cmpGood}</div><pre>${esc(t.cmpGoodPre)}</pre></div>
    </div>
  </section>

  <section id="install" class="install">
    <h2 class="section-title">${t.instTitle}</h2>
    <p class="section-sub">${t.instSub}</p>
    <div class="install-box">
      <label for="toolSel">${t.instLabel}</label>
      <select id="toolSel">${toolOpts}</select>
      <div class="cmd-out" data-copy="npx superpowers-zh"><code id="cmdText">npx superpowers-zh</code><button class="copy-btn">${t.copy}</button></div>
      <p class="install-note" id="installNote"></p>
    </div>
  </section>

  <section id="skills" class="skills">
    <h2 class="section-title">${fill(t.skTitle, { n: total })}</h2>
    <p class="section-sub">${t.skSub}</p>
    <div class="skill-controls">
      <input id="search" type="search" placeholder="${esc(t.skSearch)}" autocomplete="off">
      <div class="chips">${filters}</div>
    </div>
    <div class="grid" id="grid">${cards}</div>
    <p class="empty" id="empty" hidden>${t.skEmpty}</p>
  </section>

  <section class="usecases">
    <h2 class="section-title">${t.ucTitle}</h2>
    <p class="section-sub">${t.ucSub}</p>
    <div class="uc-grid">${ucs}</div>
  </section>

  <section id="tools" class="tools">
    <h2 class="section-title">${t.toolsTitle}</h2>
    <p class="section-sub">${t.toolsSub}</p>
    <div class="tool-wall">${toolWall}</div>
  </section>

  <section id="faq" class="faq">
    <h2 class="section-title">${t.faqTitle}</h2>
    <div class="faq-list">${faqs}</div>
  </section>

  <section class="book"><div class="book-inner"><div>
    <h2>${t.bookTitle}</h2><p>${t.bookDesc}</p>
    <a class="btn btn-primary" href="https://aiolaola.com/?utm_source=sp1" target="_blank" rel="noopener">${t.aiolaolaBtn}</a>
    <a class="btn btn-ghost" href="https://book.aibuzhiyu.com/" target="_blank" rel="noopener">${t.bookBtn}</a>
  </div></div></section>

  <section class="cta"><div class="cta-inner">
    <h2>${t.ctaTitle}</h2><p>${fill(t.ctaDesc, { n: total })}</p>
    <div class="cta-cmd" data-copy="npx superpowers-zh"><code>$ npx superpowers-zh</code><button class="copy-btn">${t.copy}</button></div>
    <div class="hero-cta">
      <a class="btn btn-primary" href="#install">${t.ctaBtn1}</a>
      <a class="btn btn-ghost" href="https://github.com/jnMetaCode/superpowers-zh" target="_blank" rel="noopener">${t.ctaBtn2}</a>
    </div>
  </div></section>
</main>
<script>window.__TOOLS__=${toolData};window.__I18N__={auto:${JSON.stringify(t.instNoteAuto)},manual:${JSON.stringify(t.instNoteManual)},global:${JSON.stringify(t.instNoteGlobal)},copy:${JSON.stringify(t.copy)},copied:${JSON.stringify(t.copied)}};</script>`;
}

// ---- 赞助商独立页 ----
// 首页不放任何赞助内容，全部收敛到这一页：旗舰位 → 常规位 → 福利汇总 → FAQ → 赞助权益。
// tier: 'flagship' 的赞助商单独成块；没有 flagship 时该区块整体不渲染。
function renderSponsors(lang) {
  const t = T[lang];
  const sp = t.sp;
  const flagship = SPONSORS.filter(x => x.tier === 'flagship');
  const standard = SPONSORS.filter(x => x.tier !== 'flagship');

  const flagCards = flagship.map(s => `
    <article class="sponsor sponsor-flag">
      <a class="sponsor-shot" href="${esc(s.url)}" target="_blank" rel="sponsored nofollow noopener">
        <img src="/assets/sponsors/${s.img}" alt="${esc(s.alt[lang])}" width="${s.w}" height="${s.h}" loading="lazy">
      </a>
      <div class="flag-body">
        <h3>${esc(s.name[lang])}</h3>
        <p class="flag-tag">${esc(s.tagline[lang])}</p>
        <ul class="flag-points">${s.points[lang].map(pt => `
          <li><span class="fp-icon" aria-hidden="true">${pt.icon}</span><div><b>${esc(pt.t)}</b><span>${esc(pt.d)}</span></div></li>`).join('')}
        </ul>
        <div class="flag-foot">
          <span class="sponsor-perk">${esc(s.perk[lang])}</span>
          <a class="btn btn-primary" href="${esc(s.url)}" target="_blank" rel="sponsored nofollow noopener">${esc(sp.visitFlag)}</a>
        </div>
      </div>
    </article>`).join('');

  const cards = standard.map(s => `
    <article class="sponsor-card">
      <a class="sc-head" href="${esc(s.url)}" target="_blank" rel="sponsored nofollow noopener">
        <span class="sc-logo"><img src="/assets/sponsors/${s.logo}" alt="" width="36" height="36" loading="lazy"></span>
        <b>${esc(s.name[lang])}</b>
        <span class="sc-ext" aria-hidden="true">↗</span>
      </a>
      <p class="sc-desc">${esc(s.desc[lang])}</p>
      <button class="sc-toggle" type="button" aria-expanded="false" hidden>${esc(sp.expand)}</button>
      <p class="sc-perk">${esc(s.perk[lang])}</p>
      <a class="sc-go" href="${esc(s.url)}" target="_blank" rel="sponsored nofollow noopener">${esc(sp.goto)}</a>
    </article>`).join('');

  const rows = SPONSORS.map(s => `
      <tr>
        <td><b>${esc(s.name[lang])}</b></td>
        <td>${esc(s.perkShort[lang])}</td>
        <td>${s.code
          ? `<span class="code-chip" data-copy="${esc(s.code)}"><code>${esc(s.code)}</code><button class="copy-btn" aria-label="${t.copy}">\u29c9</button></span>`
          : sp.noCode}</td>
        <td><a href="${esc(s.url)}" target="_blank" rel="sponsored nofollow noopener">${sp.goto}</a></td>
      </tr>`).join('');

  const faqs = sp.faq.map(f =>
    `<details class="faq-item"><summary>${esc(f.q)}</summary><div class="faq-a">${esc(f.a)}</div></details>`).join('');

  const benefits = sp.benefits.map(b =>
    `<article class="feat"><div class="feat-icon">${b.icon}</div><h3>${esc(b.t)}</h3><p>${esc(b.d)}</p></article>`).join('');

  // 没有 flagship 时不留白，改渲染一张「虚位以待」招商卡
  const flagSection = `
  <section class="sp-tier">
    <h2 class="tier-title">${esc(sp.flagTitle)}</h2>
    <p class="tier-sub">${esc(sp.flagSub)}</p>
    ${flagship.length ? flagCards : `
    <div class="flag-empty">
      <h3>${esc(sp.emptyTitle)}</h3>
      <p>${esc(sp.emptyDesc)}</p>
      <a class="btn btn-primary" href="mailto:jnMetaCode@qq.com">${esc(sp.emptyBtn)}</a>
    </div>`}
  </section>
`;

  const moreSection = standard.length ? `
  <section class="sp-tier">
    <h2 class="tier-title">${esc(flagship.length ? sp.moreTitle : sp.listTitle)}</h2>
    <p class="tier-sub">${esc(flagship.length ? sp.moreSub : sp.listSub)}</p>
    <div class="sponsor-cards">${cards}</div>
  </section>
` : '';

  return `
<main id="main">
  <section class="hero sp-hero">
    <div class="badge">${sp.badge}</div>
    <h1>${esc(sp.h1)}</h1>
    <p class="lead">${esc(sp.lead)}</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="mailto:jnMetaCode@qq.com">${esc(sp.becomeBtn)}</a>
      <a class="btn btn-ghost" href="index.html">${esc(sp.backBtn)}</a>
    </div>
  </section>
${flagSection}${moreSection}
  <section class="sp-perks">
    <h2 class="section-title">${esc(sp.perkTitle)}</h2>
    <p class="section-sub">${esc(sp.perkSub)}${sp.copyHint ? ' ' + esc(sp.copyHint) : ''}</p>
    <div class="sp-table-wrap">
      <table class="sp-table">
        <thead><tr><th>${esc(sp.thSponsor)}</th><th>${esc(sp.thPerk)}</th><th>${esc(sp.thCode)}</th><th>${esc(sp.thGo)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="sponsor-note">${t.sponsorNote}</p>
  </section>

  <section class="faq">
    <h2 class="section-title">${esc(sp.faqTitle)}</h2>
    <div class="faq-list">${faqs}</div>
  </section>

  <section class="why sp-benefits">
    <h2 class="section-title">${esc(sp.benefitTitle)}</h2>
    <p class="section-sub">${esc(sp.benefitSub)}</p>
    <div class="feat-grid">${benefits}</div>
  </section>

  <section class="cta"><div class="cta-inner">
    <h2>${esc(sp.ctaTitle)}</h2><p>${esc(sp.ctaDesc)}</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="mailto:jnMetaCode@qq.com">${esc(sp.ctaBtn)}</a>
      <a class="btn btn-ghost" href="index.html">${esc(sp.backBtn)}</a>
    </div>
  </div></section>
</main>
<script>window.__I18N__={copy:${JSON.stringify(t.copy)},copied:${JSON.stringify(t.copied)},expand:${JSON.stringify(sp.expand)},collapse:${JSON.stringify(sp.collapse)}};</script>`;
}

// ---- JSON-LD 结构化数据 ----
// 站上有 7 条 FAQ、完整的软件信息与 20 个 skill 文档页，却没有任何结构化标记：
// 搜索引擎拿不到富摘要，AI 抓取时只能从正文里猜。
//
// 关于 CSP：ld+json 是**数据块不是可执行脚本**，浏览器不会执行它，爬虫读的也是
// HTML 源码而非执行结果 —— 所以不需要进 script-src 的 hash 白名单。
//
// 关于 </script> 逃逸：JSON.stringify 不转义 '<'，正文里若出现 </script> 就会
// 提前闭合标签。统一把 < 转成 \u003c，这是 JSON 字符串里的合法写法。
function ldJson(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function homeSchema(lang, t, skills) {
  const url = SITE_URL + (lang === 'zh' ? '/' : lang === 'en' ? '/en/' : '/zh-Hant/');
  return ldJson({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite', '@id': url + '#website', url, name: 'superpowers-zh',
        description: t.desc, inLanguage: t.htmlLang,
      },
      {
        '@type': 'SoftwareApplication', '@id': url + '#software',
        name: 'superpowers-zh', description: t.desc, url,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'macOS, Windows, Linux',
        softwareVersion: PKG.version,
        image: `${SITE_URL}/assets/og-image.jpg`,
        license: 'https://opensource.org/licenses/MIT',
        codeRepository: 'https://github.com/jnMetaCode/superpowers-zh',
        downloadUrl: 'https://www.npmjs.com/package/superpowers-zh',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Person', name: 'jnMetaCode', url: 'https://github.com/jnMetaCode' },
      },
      {
        '@type': 'FAQPage', '@id': url + '#faq',
        mainEntity: t.faq.map(f => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  });
}

function skillSchema(skill, lang, t) {
  const base = SITE_URL + (lang === 'zh' ? '' : lang === 'en' ? '/en' : '/zh-Hant');
  return ldJson({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: lang === 'en' ? skill.titleEn : skill.title,
        description: lang === 'zh' ? skill.desc : (skill.descEn || skill.desc),
        url: `${base}/skills/${skill.name}`,
        inLanguage: 'zh-CN',                       // 正文一律中文，英文站也是（页面顶部有提示）
        isPartOf: { '@id': base + '/#website' },
        license: 'https://opensource.org/licenses/MIT',
        author: { '@type': 'Person', name: 'jnMetaCode' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'superpowers-zh', item: base + '/' },
          { '@type': 'ListItem', position: 2, name: t.nav.skills, item: base + '/#skills' },
          { '@type': 'ListItem', position: 3, name: lang === 'en' ? skill.titleEn : skill.title },
        ],
      },
    ],
  });
}

// ---- skill 详情(操作文档)页正文 ----
function renderDetail(skill, lang) {
  const t = T[lang];
  const title = lang === 'en' ? skill.titleEn : skill.title;
  // 传入该 skill 在仓库里的目录 URL：SKILL.md 里指向兄弟文件的相对链接
  // （implementer-prompt.md、../requesting-code-review/code-reviewer.md 等）
  // 站点上并不存在，必须解析成 GitHub 地址，否则全是死链。
  const bodyHtml = renderMarkdown(skill.raw, `${GH_BLOB}/skills/${skill.name}/`, 1);
  const cnNotice = lang === 'en'
    ? '<div class="doc-notice">📖 This skill\'s content is written in Chinese — superpowers-zh is a Chinese-localized toolkit.</div>'
    : '';
  const srcUrl = `${GH_BLOB}/skills/${skill.name}/SKILL.md`;
  return `
<main id="main" class="doc">
  <a class="doc-back" href="../index.html#skills">${t.backToSkills}</a>
  <header class="doc-head">
    <div class="doc-titles">
      <h1>${esc(title)}</h1>
      <code>${esc(skill.name)}</code>
      ${skill.china ? `<span class="tag tag-cn">${t.tagCn}</span>` : ''}
    </div>
    <p class="doc-lead">${esc(lang === 'zh' ? skill.desc : (skill.descEn || skill.desc))}</p>
    <div class="doc-actions">
      <div class="cmd-out doc-cmd" data-copy="npx superpowers-zh"><code>$ npx superpowers-zh</code><button class="copy-btn">${t.copy}</button></div>
      <a class="btn btn-ghost" href="${srcUrl}" target="_blank" rel="noopener">${t.detailSource}</a>
    </div>
  </header>
  ${cnNotice}
  <article class="doc-body">${bodyHtml}</article>
  <a class="doc-back" href="../index.html#skills">${t.backToSkills}</a>
</main>
<script>window.__I18N__={copy:${JSON.stringify(t.copy)},copied:${JSON.stringify(t.copied)}};</script>`;
}

// ---- 构建 ----
function build() {
  const skills = loadSkills();
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(join(DIST, 'assets'), { recursive: true });
  mkdirSync(join(DIST, 'skills'), { recursive: true });
  mkdirSync(join(DIST, 'en', 'skills'), { recursive: true });

  // 资源
  copyFileSync(join(TEMPLATE, 'styles.css'), join(DIST, 'styles.css'));
  copyFileSync(join(TEMPLATE, 'app.js'), join(DIST, 'app.js'));
  copyFileSync(join(ROOT, 'assets', 'app-icon.png'), join(DIST, 'assets', 'app-icon.png'));
  copyFileSync(join(ROOT, 'assets', 'og-image.jpg'), join(DIST, 'assets', 'og-image.jpg'));
  copyFileSync(join(ROOT, 'assets', 'superpowers-small.svg'), join(DIST, 'assets', 'superpowers-small.svg'));
  copyFileSync(join(TEMPLATE, 'assets', 'qr-wechat.jpg'), join(DIST, 'assets', 'qr-wechat.jpg'));
  copyFileSync(join(TEMPLATE, 'assets', 'qr-douyin.png'), join(DIST, 'assets', 'qr-douyin.png'));
  copyFileSync(join(TEMPLATE, 'assets', 'qr-x.png'), join(DIST, 'assets', 'qr-x.png'));
  mkdirSync(join(DIST, 'assets', 'sponsors'), { recursive: true });
  for (const s of SPONSORS) {
    for (const f of [s.img, s.logo].filter(Boolean)) {
      copyFileSync(join(ROOT, 'assets', 'sponsors', f), join(DIST, 'assets', 'sponsors', f));
    }
  }

  // ---- 每种语言生成首页 + 全部 skill 详情页 ----
  for (const L of LANGS) {
    const t = T[L.code];
    const dirParts = L.dir ? [L.dir.replace(/\/$/, '')] : [];
    // base = 相对**当前语言根**的前缀：首页 ''、skill 详情页 '../'。
    // （早先写成相对站点根，导致 /en/ 与 /zh-Hant/ 页面的导航/品牌链接全部跳回中文首页）
    const homeBase = '';
    mkdirSync(join(DIST, ...dirParts, 'skills'), { recursive: true });
    // 首页
    writeFileSync(join(DIST, ...dirParts, 'index.html'), layout({
      lang: L.code, base: homeBase, title: t.title, desc: t.desc,
      body: renderLanding(skills, L.code), pageClean: '', pageFile: '',
      extraHead: homeSchema(L.code, t, skills) + '\n',
    }));
    // 赞助商页（每种语言一份，与首页同级）
    writeFileSync(join(DIST, ...dirParts, 'sponsors.html'), layout({
      lang: L.code, base: homeBase, title: t.sp.title, desc: t.sp.desc,
      body: renderSponsors(L.code), pageClean: 'sponsors', pageFile: 'sponsors.html',
    }));
    // skill 详情页
    for (const s of skills) {
      const title = L.code === 'en' ? s.titleEn : s.title;
      const desc = L.code === 'en' ? (s.descEn || s.desc) : s.desc;
      writeFileSync(join(DIST, ...dirParts, 'skills', `${s.name}.html`), layout({
        lang: L.code, base: '../',
        title: `${title} · superpowers-zh`, desc,
        body: renderDetail(s, L.code),
        pageClean: `skills/${s.name}`, pageFile: `skills/${s.name}.html`,
        extraHead: skillSchema(s, L.code, t) + '\n',
      }));
    }
  }

  // ---- 404 页 ----
  // Cloudflare Pages：根目录存在 404.html 时，任何未匹配到静态文件的路径都会
  // 返回它并带 **真正的 HTTP 404**（而非默认把首页当 SPA 兜底返回 200——那会让
  // Google 把无数不存在的 URL 当成首页的重复页/软 404）。noindex 防止 404 页本身被收录。
  // base 用 '/'：这一个文件会被任意深度的路径命中，导航链接必须是绝对路径。
  writeFileSync(join(DIST, '404.html'), layout({
    lang: 'zh', base: '/',
    title: '页面找不到 (404) · superpowers-zh',
    desc: '你访问的页面不存在或已被移动。',
    extraHead: '<meta name="robots" content="noindex">\n',
    pageClean: '', pageFile: '',
    body: `<main id="main" class="doc" style="max-width:640px;margin:0 auto;padding:80px 20px;text-align:center">
  <div style="font-size:64px;font-weight:800;letter-spacing:2px;opacity:.85">404</div>
  <h1 style="margin:12px 0 8px">这个页面找不到了</h1>
  <p style="opacity:.75;margin:0 0 28px">链接可能已过期或被移动。下面几个入口也许是你要找的：</p>
  <p style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
    <a class="btn" href="/">返回首页</a>
    <a class="btn" href="/#skills">浏览全部 Skill</a>
    <a class="btn" href="/#install">安装命令</a>
  </p>
</main>`,
  }));

  // ---- SEO: robots.txt + sitemap.xml ----
  writeFileSync(join(DIST, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: ' + SITE_URL + '/sitemap.xml\n');

  const today = new Date().toISOString().slice(0, 10);
  // 每条 URL 记下它「内容来自哪些源文件」，据此取 lastmod：
  //   skill 详情页 -> 该 skill 目录；首页 / 赞助页 -> 生成器与模板（文案都写在里面）
  const tmplPaths = ['site/build.mjs', 'site/template'];
  const urls = [];
  for (const L of LANGS) {
    urls.push({ u: `/${L.dir}`, src: tmplPaths });
    urls.push({ u: `/${L.dir}sponsors`, src: [...tmplPaths, 'assets/sponsors'] });
    for (const s of skills) urls.push({ u: `/${L.dir}skills/${s.name}`, src: [`skills/${s.name}`] });
  }
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(({ u, src }) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${lastCommitDate(src)}</lastmod><changefreq>weekly</changefreq><priority>${u === '/' ? '1.0' : (u.endsWith('/') ? '0.8' : '0.7')}</priority></url>`).join('\n') +
    '\n</urlset>\n';
  writeFileSync(join(DIST, 'sitemap.xml'), sitemap);

  // 结构化数据一旦转义写错（引号、</script>、CJK），浏览器和爬虫都只是**静默忽略**，
  // 页面看不出任何异常。所以构建时逐页把它 JSON.parse 一遍，坏了就直接失败。
  const validateLd = (dir) => {
    let n = 0;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, ent.name);
      if (ent.isDirectory()) { n += validateLd(f); continue; }
      if (!ent.name.endsWith('.html')) continue;
      const html = readFileSync(f, 'utf8');
      for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try { JSON.parse(m[1]); n++; }
        catch (e) { throw new Error(`${f} 里的 JSON-LD 不是合法 JSON：${e.message}`); }
      }
    }
    return n;
  };
  const ldCount = validateLd(DIST);

  // 收集所有生成页面里的内联 <script> 内容，算 SHA-256 作为 CSP hash 白名单。
  // 本站脚本由本生成器产出（可信），用 hash 即可严格禁用 'unsafe-inline'/'unsafe-eval'
  // 而不误伤自有内联脚本——注入的外来脚本则被 CSP 拦截。
  const scriptHashes = new Set();
  const collectScriptHashes = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) { collectScriptHashes(p); continue; }
      if (!ent.name.endsWith('.html')) continue;
      const html = readFileSync(p, 'utf8');
      for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
        scriptHashes.add("'sha256-" + createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
      }
    }
  };
  collectScriptHashes(DIST);

  // 严格 CSP：脚本仅允许 'self' + 本站内联脚本的 hash（含 GA 内联配置块，自动收集）；
  // 样式仅 'self'；禁用插件/内联事件；锁死 base-uri 与 frame 祖先。
  // Google Analytics (gtag) 需放行 googletagmanager（加载器）与 analytics（上报）域名。
  const GA_SCRIPT = 'https://www.googletagmanager.com';
  const GA_CONNECT = 'https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com';
  const csp = [
    "default-src 'self'",
    "script-src 'self' " + GA_SCRIPT + ' ' + [...scriptHashes].join(' '),
    "style-src 'self'",
    "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
    "font-src 'self'",
    "connect-src 'self' " + GA_CONNECT,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');

  // Cloudflare Pages：全站安全响应头 + 缓存策略。
  // 默认 /* 不缓存（must-revalidate）——这样 clean URL 的 HTML（/、/skills/x、
  // /en/x，均不带 .html）也能即时更新，不会被边缘缓存旧内容。
  // 带内容 hash 版本号的资源（styles.css?v= / app.js?v=）与 /assets/* 由更具体
  // 规则覆盖为长缓存 immutable（内容变 → URL 变 → 自动取新）。
  writeFileSync(join(DIST, '_headers'),
    '/*\n' +
    '  Content-Security-Policy: ' + csp + '\n' +
    '  X-Content-Type-Options: nosniff\n' +
    '  X-Frame-Options: DENY\n' +
    '  Referrer-Policy: no-referrer\n' +
    '  Cross-Origin-Opener-Policy: same-origin\n' +
    '  Permissions-Policy: geolocation=(), microphone=(), camera=()\n' +
    '  Cache-Control: no-store\n' +
    '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n' +
    '/styles.css\n  Cache-Control: public, max-age=31536000, immutable\n' +
    '/app.js\n  Cache-Control: public, max-age=31536000, immutable\n');

  const pages = LANGS.length * (2 + skills.length);
  console.log(`   结构化数据：${ldCount} 个 JSON-LD 块，均通过 JSON.parse 校验`);
  console.log(`✅ 生成 ${pages} 个页面：${LANGS.length} 语言（${LANGS.map(l => l.code).join('/')}）× (首页 + 赞助商页 + ${skills.length} 个 skill 详情页) → ${DIST}`);
}

build();
