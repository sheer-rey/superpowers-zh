#!/usr/bin/env bash
# 质量审计脚本 —— 跑 4 类检查防漂移
#
# 1. 静态校验：JSON parse / SKILL.md frontmatter / symlink / hook 可执行性
# 2. Installer 功能：23 款工具装 / 卸载 / 幂等
# 3. 上游对齐：hooks 3 文件 + brainstorm scripts 3 文件 + 14 翻译 skill 结构层级
# 4. 交叉引用：README → docs/ 链接 + skill 间引用 + bootstrap 注入路径
#
# 用法：
#   bash scripts/audit.sh                 # 跑全部，FAIL > 0 时 exit 1
#   bash scripts/audit.sh --quick         # 跳过 installer 功能测试
#   bash scripts/audit.sh --no-upstream   # 跳过上游对齐（CI 没 upstream remote 时）
#
# CI 默认在 PR + push to main 跑，发现漂移立刻拦下。

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

QUICK=0
NO_UPSTREAM=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --no-upstream) NO_UPSTREAM=1 ;;
  esac
done

PASS=0; FAIL=0; WARN=0
declare -a FAILURES=()
declare -a WARNINGS=()
INSTALLER="$ROOT/bin/superpowers-zh.js"

ok()   { PASS=$((PASS+1)); }
bad()  { FAIL=$((FAIL+1)); FAILURES+=("$1"); echo "  ❌ $1"; }
warn() { WARN=$((WARN+1)); WARNINGS+=("$1"); echo "  ⚠️  $1"; }
hdr()  { echo ""; echo "=== $1 ==="; }

# 确保有 upstream remote（CI 上需要 fetch）
ensure_upstream() {
  if [ "$NO_UPSTREAM" = "1" ]; then return 1; fi
  if ! git ls-remote --exit-code upstream HEAD >/dev/null 2>&1; then
    if git remote get-url upstream >/dev/null 2>&1; then
      git fetch upstream main --depth=50 --quiet 2>/dev/null || return 1
    else
      git remote add upstream https://github.com/obra/superpowers.git 2>/dev/null
      git fetch upstream main --depth=50 --quiet 2>/dev/null || return 1
    fi
  fi
  return 0
}

#==============================================================================
hdr "Category 1: 静态校验"
#==============================================================================

# 1a. JSON parse
while IFS= read -r f; do
  if node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then
    ok
  else
    bad "JSON parse failure: $f"
  fi
done < <(find . -name "*.json" \
            -not -path "./node_modules/*" \
            -not -path "./.git/*" \
            -not -path "./tests/*/node_modules/*")

# 1b. SKILL.md frontmatter 完整性
for f in skills/*/SKILL.md; do
  if ! head -1 "$f" | grep -q '^---$'; then
    bad "No frontmatter: $f"
    continue
  fi
  fm=$(sed -n '/^---$/,/^---$/p' "$f" | head -20)
  for field in name description; do
    if ! echo "$fm" | grep -q "^${field}:"; then
      bad "Missing frontmatter field '$field': $f"
    fi
  done
  ok
done

# 1c. Symlink 解析
while IFS= read -r l; do
  if [ -e "$l" ]; then ok; else bad "Broken symlink: $l"; fi
done < <(find . -type l -not -path "./node_modules/*" -not -path "./.git/*")

# 1d. Hook 脚本可执行权限
for f in hooks/session-start hooks/run-hook.cmd; do
  if [ -x "$f" ]; then ok; else bad "Not executable: $f"; fi
done

# 1e. shell 脚本里「变量后紧跟多字节字符」
#
# bash 解析变量名时会把紧随其后的多字节字符吞进名字里，于是 set -u 下直接报
# unbound variable 并中断脚本。本仓已踩过两次，两次都是「脚本半途崩掉、看起来
# 像没跑」。写成花括号界定即可。
#
# 注意实现：这里不能用 grep -P —— macOS 的 /usr/bin/grep 是 BSD grep，不支持 -P，
# 配上 2>/dev/null 就成了静默失效的检查（本检查第一版正是这么写的，交互 shell 里
# 用 ugrep 看着能用，进了脚本一个都匹配不到）。用 LC_ALL=C + ERE：C locale 下
# 多字节字符按单字节处理，>0x7F 的字节自然落在 [^ -~] 之外，BSD/GNU 都支持。
# 排除注释行，否则本条说明文字自己会被命中。
while IFS= read -r hit; do
  case "${hit#*:*:}" in
    \#*|" "*\#*) continue ;;   # 注释行（含缩进注释）不算
  esac
  bad "变量后紧跟多字节字符，bash 会吞进变量名（用 \${VAR} 界定）: $hit"
done < <(LC_ALL=C grep -nE '\$[A-Za-z_][A-Za-z0-9_]*[^ -~]' scripts/*.sh hooks/session-start 2>/dev/null)
ok

#==============================================================================
if [ "$QUICK" != "1" ]; then
hdr "Category 2: Installer 功能测试（23 款工具）"
#==============================================================================

declare -a TOOLS=(claude cursor codex kiro deerflow trae antigravity vscode openclaw windsurf gemini aider opencode qwen hermes claw copilot qoder codebuddy codearts cline kilocode crush)

for tool in "${TOOLS[@]}"; do
  TMP=$(mktemp -d)
  pushd "$TMP" >/dev/null

  if ! node "$INSTALLER" --tool "$tool" >/dev/null 2>&1; then
    bad "Installer: $tool 安装失败"
    popd >/dev/null
    rm -rf "$TMP"
    continue
  fi

  # 幂等：再装一遍不应炸
  if ! node "$INSTALLER" --tool "$tool" >/dev/null 2>&1; then
    bad "Installer: $tool 二次安装失败（幂等性破坏）"
    popd >/dev/null
    rm -rf "$TMP"
    continue
  fi

  if ! node "$INSTALLER" --uninstall >/dev/null 2>&1; then
    bad "Installer: $tool 卸载失败"
  else
    ok
  fi

  popd >/dev/null
  rm -rf "$TMP"
done

else
echo ""
echo "[--quick 跳过 installer 功能测试]"
fi

#==============================================================================
hdr "Category 3: 上游对齐"
#==============================================================================

if ! ensure_upstream; then
  warn "无法访问 upstream，跳过对齐检查（CI 上请确保有网络）"
else
  # 3a. Hooks 3 文件 + cursor manifest
  for f in hooks/session-start hooks/hooks.json hooks/run-hook.cmd hooks/hooks-cursor.json; do
    d=$(diff <(git show upstream/main:$f 2>/dev/null) "$f" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$d" = "0" ]; then ok; else bad "Hooks 漂移: $f ($d 行)"; fi
  done

  # 3b. Brainstorm scripts 3 文件
  for f in skills/brainstorming/scripts/server.cjs \
           skills/brainstorming/scripts/start-server.sh \
           skills/brainstorming/scripts/stop-server.sh; do
    d=$(diff <(git show upstream/main:$f 2>/dev/null) "$f" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$d" = "0" ]; then ok; else bad "Brainstorm script 漂移: $(basename $f) ($d 行)"; fi
  done

  # 3c. 14 翻译 skill 结构层级（H1-H4 标题数）
  #
  # 必须排除 ``` 围栏内的行：shell 注释（`# 运行测试`）同样匹配 ^#{1,4} ，
  # 会被当成 markdown 标题数进去。用 grep 直接数的话，一个 skill 里多几行
  # bash 注释就能凭空造出「结构漂移」—— executing-plans 与
  # finishing-a-development-branch 两条告警此前就是这么来的假阳性。
  count_headings() {  # 读 stdin，只数围栏之外的 H1-H4
    awk '/^```/{fence = !fence; next} !fence && /^#{1,4} /{n++} END{print n+0}'
  }
  declare -a SKILLS=(brainstorming dispatching-parallel-agents executing-plans \
    finishing-a-development-branch receiving-code-review requesting-code-review \
    subagent-driven-development systematic-debugging test-driven-development \
    using-git-worktrees using-superpowers verification-before-completion \
    writing-plans writing-skills)

  for s in "${SKILLS[@]}"; do
    up=$(git show upstream/main:skills/$s/SKILL.md 2>/dev/null | count_headings || echo 0)
    our=$(count_headings < "skills/$s/SKILL.md" 2>/dev/null || echo 0)
    diff=$((up - our))
    abs=${diff#-}
    # 允许 3 个 header 差异（翻译造成的合并/拆分小幅波动）
    if [ "$abs" -le "3" ]; then
      ok
    else
      warn "Skill 结构漂移: ${s} (上游 H=${up}, 我们 H=${our}) -- 可能 v5.1.0 没跟，或主动扩写"
    fi
  done

  # 3c-bis. fork 增量必须显式声明
  #
  # 翻译 skill 的标题数应等于「上游标题数 + 本文件里声明的 fork 增量节数」。
  # 增量节靠正文里的一行标记声明（见下方 FORK_MARK），标记与内容同处一文件，
  # 不会各自漂移。没打标记就多出章节 = 隐性分叉，下次同步时会被误当成漏译。
  FORK_MARK='本节是 superpowers-zh 的增量内容'
  for s in "${SKILLS[@]}"; do
    up=$(git show upstream/main:skills/$s/SKILL.md 2>/dev/null | count_headings || echo 0)
    our=$(count_headings < "skills/$s/SKILL.md" 2>/dev/null || echo 0)
    # 注意：grep -c 找到 0 个时输出 "0" 但退出码为 1，写成 `|| echo 0` 会拼出
    # "0\n0"，后续整数比较直接报错、检查静默失效。用 `; true` 只吞退出码。
    declared=$(grep -c "$FORK_MARK" "skills/$s/SKILL.md" 2>/dev/null; true)
    declared=${declared:-0}
    delta=$((our - up))
    if [ "$delta" = "$declared" ]; then
      ok
    elif [ "$delta" -gt "$declared" ]; then
      bad "未声明的 fork 增量: ${s} 比上游多 ${delta} 节，但只声明了 ${declared} 节 —— 给增量节加上「${FORK_MARK}」标记，或回归上游"
    fi
    # delta < declared 由 3c 的漂移检查覆盖，此处不重复报
  done

  # 3d. requesting-code-review/code-reviewer.md 结构（v5.1.0 self-contained）
  up=$(git show upstream/main:skills/requesting-code-review/code-reviewer.md 2>/dev/null | count_headings || echo 0)
  our=$(count_headings < skills/requesting-code-review/code-reviewer.md)
  diff=$((up - our))
  abs=${diff#-}
  if [ "$abs" -le "2" ]; then
    ok
  else
    bad "code-reviewer.md 结构漂移 (上游 v5.1.0 self-contained, H=${up}; 我们 H=${our})"
  fi
fi

#==============================================================================
hdr "Category 4: 交叉引用完整性"
#==============================================================================

# 4a. README → docs/ 链接
BROKEN=0
while IFS= read -r link; do
  link=${link#(}; link=${link%)}
  if [ -f "$link" ]; then ok; else
    bad "README 链接断: $link"
    BROKEN=$((BROKEN+1))
  fi
done < <(grep -oE '\(docs/README\.[a-z-]+\.md\)' README.md)

# 4b. Skill 间引用（superpowers:xxx）
while IFS= read -r line; do
  skill_file=$(echo "$line" | cut -d: -f1)
  refs=$(echo "$line" | grep -oE '\bsuperpowers:[a-z-]+\b' | sort -u)
  for ref in $refs; do
    name=${ref#superpowers:}
    if [ -d "skills/$name" ]; then ok; else
      src=$(basename $(dirname "$skill_file"))
      bad "Skill 引用断: $src 引用了不存在的 skills/$name"
    fi
  done
done < <(grep -rln 'superpowers:' skills/*/SKILL.md 2>/dev/null | \
         xargs -I{} grep -H 'superpowers:' {} 2>/dev/null)

# 4c. 装完后 .claude/skills/using-superpowers/SKILL.md 路径必须存在（hook 依赖）
TMP=$(mktemp -d)
pushd "$TMP" >/dev/null
if node "$INSTALLER" --tool claude >/dev/null 2>&1; then
  if [ -f "$TMP/.claude/skills/using-superpowers/SKILL.md" ]; then
    ok
  else
    bad "装完后 .claude/skills/using-superpowers/SKILL.md 不存在（hook 会找不到）"
  fi
fi
popd >/dev/null
rm -rf "$TMP"

#==============================================================================
hdr "Category 5: 工具计数一致性"
#==============================================================================
# 文案里宣称的工具数必须与 installer 实际支持的数量一致。
#
# 口径说明：installer 的 TARGETS 是「安装目标」；Copilot CLI 与 Claude Code 共用
# .claude/skills（别名 copilot -> Claude Code），在 TARGETS 里不占独立条目，但文案
# 里作为独立产品单独计数 —— 所以「文案工具数 = TARGETS 条目数 + 1」。
#
# 加新工具时最容易漏改文案：计数散落在简繁 README、package.json、CLAUDE.md、
# site/build.mjs、3 份 plugin manifest 十几处。这一类检查专门堵这个。

TARGET_COUNT=$(sed -n '/^const TARGETS = \[/,/^\];/p' "$INSTALLER" | grep -cE "^  \{ name: '")
EXPECTED_TOOLS=$((TARGET_COUNT + 1))
echo "  installer TARGETS = $TARGET_COUNT 个安装目标  ->  文案应宣称 $EXPECTED_TOOLS 款"

# check_count <文件> <正则> <说明>：正则匹配到的所有数字都必须等于 EXPECTED_TOOLS
check_count() {
  local file="$1" re="$2" label="$3" got n
  if [ ! -f "$file" ]; then bad "计数检查: $file 不存在"; return; fi
  got=$(grep -oE "$re" "$file" 2>/dev/null | grep -oE '[0-9]+' | sort -u)
  if [ -z "$got" ]; then
    bad "计数检查: ${file} 里没匹配到「${label}」—— 文案改动过？正则需同步更新"
    return
  fi
  for n in $got; do
    if [ "$n" != "$EXPECTED_TOOLS" ]; then
      bad "计数不一致: ${file}「${label}」= ${n}，应为 ${EXPECTED_TOOLS}"
      return
    fi
  done
  ok
}

# ── 简体 README ──
check_count README.md '等 \*\*[0-9]+ 款 AI 编程工具\*\*'        '首屏标语'
check_count README.md '\*\*[0-9]+ 款\*\*：上述'                  '对比表支持工具'
check_count README.md '\*\*\+\*\* [0-9]+ 款工具一键适配'         '一句话总结'
check_count README.md '### 🤖 支持 [0-9]+ 款主流'                 '工具表标题'
check_count README.md '等 [0-9]+ 款工具真正会干活'                 '页脚标语'
check_count README.md 'across [0-9]+ AI coding tools'            '英文简介'

# ── 繁體 README ──
check_count README.zh-Hant.md '等 \*\*[0-9]+ 款 AI 編程工具\*\*'  '首屏標語'
check_count README.zh-Hant.md '\*\*[0-9]+ 款\*\*：上述'           '對比表支援工具'
check_count README.zh-Hant.md '\*\*\+\*\* [0-9]+ 款工具一鍵適配'  '一句話總結'
check_count README.zh-Hant.md '### 🤖 支援 [0-9]+ 款主流'          '工具表標題'
check_count README.zh-Hant.md '等 [0-9]+ 款工具真正會幹活'          '頁腳標語'
check_count README.zh-Hant.md 'across [0-9]+ AI coding tools'     '英文簡介'

# ── 元数据与 manifest ──
check_count package.json                    '等 [0-9]+ 款工具'      'npm description'
check_count CLAUDE.md                       '支持 [0-9]+ 款 IDE/CLI' '贡献者指南'
check_count .claude-plugin/plugin.json      '等 [0-9]+ 款工具'      'plugin manifest'
check_count .claude-plugin/marketplace.json '等 [0-9]+ 款工具'      'marketplace manifest'
check_count .cursor-plugin/plugin.json      '等 [0-9]+ 款工具'      'cursor manifest'

# ── 官网（三语言） ──
check_count site/build.mjs '[0-9]+ 款 AI 编程工具装上'   '官网简体标语'
check_count site/build.mjs '[0-9]+ 款 AI 編程工具裝上'   '官网繁體標語'
check_count site/build.mjs '共 [0-9]+ 款：'              '官网 FAQ 枚举'
check_count site/build.mjs 'into [0-9]+ AI coding tools' '官网英文标语'
check_count site/build.mjs '^      \{ q: .Which AI coding tools are supported.*[0-9]+ tools:' '官网英文 FAQ'

# ── 结构性检查：README 工具表的实际行数 ──
rows=$(awk '/^### 🤖 支持 [0-9]+ 款主流/,/^> 运行 `npx/' README.md | grep -cE '^\| \[')
if [ "$rows" = "$EXPECTED_TOOLS" ]; then ok; else
  bad "README 工具表有 $rows 行，应为 $EXPECTED_TOOLS 行（漏加/多加了表格行）"
fi

# ── 自检：Category 2 测的工具数应等于宣称数（宣称了就必须测） ──
tools_tested=$(grep -oE '^declare -a TOOLS=\(.*\)' "$0" | sed -E 's/^declare -a TOOLS=\(//; s/\)$//' | wc -w | tr -d ' ')
if [ "$tools_tested" = "$EXPECTED_TOOLS" ]; then ok; else
  bad "Category 2 只测了 $tools_tested 款，但文案宣称 $EXPECTED_TOOLS 款（宣称的工具必须都有回归测试）"
fi

#==============================================================================
echo ""
echo "=========================================="
echo "📊 审计结果"
echo "=========================================="
echo "✅ PASS: $PASS"
echo "⚠️  WARN: $WARN"
echo "❌ FAIL: $FAIL"

if [ "$WARN" -gt 0 ]; then
  echo ""
  echo "Warnings（不阻塞）："
  for w in "${WARNINGS[@]}"; do echo "  ⚠️  $w"; done
fi

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failures（必须修）："
  for f in "${FAILURES[@]}"; do echo "  ❌ $f"; done
  echo ""
  echo "❌ Audit 失败：$FAIL 个 P0 问题。看 README 「质量审计」段了解每项含义。"
  exit 1
fi

echo ""
echo "✅ Audit 通过"
exit 0
