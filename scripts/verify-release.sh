#!/usr/bin/env bash
#
# verify-release.sh — 发版前深度验证。
#
# 与 audit.sh 的分工：audit.sh 只看 installer 的退出码，装完到底有没有东西落盘、
# 卸载有没有留垃圾它都不查。本脚本补上这些断言，发 npm 之前跑一次。
#
#   bash scripts/verify-release.sh
#
# 覆盖：
#   A. 22 款工具：装 -> 断言 skill 数落盘 -> 二次装幂等 -> 卸载零残留 + 无嵌套
#   B. 每个检测标记只触发预期工具（防新增工具时误触发既有工具）
#   C. --global 白名单成功 / 其余明确拒绝且退出码 1
#   D. --global 拒绝信息引用的 docs 文件真实存在（防死链）
#   E. rules 型工具（Cline / Kilo Code）的 bootstrap 索引内容断言
#   F. PATH 探测在 PATH 为空 / 畸形 / 未定义时的健壮性
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
INS="$REPO/bin/superpowers-zh.js"
NODE=$(command -v node)   # 绝对路径：F 段要清空 PATH，用裸 node 会 127
EXPECT_SKILLS=$(ls -d "$REPO"/skills/*/ | wc -l | tr -d ' ')

PASS=0; FAIL=0
declare -a FAILURES=()
ok()   { PASS=$((PASS+1)); }
bad()  { FAIL=$((FAIL+1)); FAILURES+=("$1"); printf '  ❌ %s\n' "$1"; }

# 工具别名 -> 期望的 skills 目录（相对项目根）
declare -a SPEC=(
  "claude:.claude/skills"          "cursor:.cursor/skills"        "codex:.agents/skills"
  "kiro:.kiro/skills"                  "deerflow:skills/custom"       "trae:.trae/skills"
  "antigravity:.agents/skills"     "vscode:.github/superpowers"   "openclaw:skills"
  "windsurf:.windsurf/skills"      "gemini:.gemini/skills"        "aider:.aider/skills"
  "opencode:.opencode/skills"      "qwen:.qwen/skills"            "hermes:.hermes/skills"
  "claw:.claw/skills"              "copilot:.claude/skills"       "qoder:.qoder/skills"
  "codebuddy:.codebuddy/skills"    "codearts:.codeartsdoer/skills"
  "cline:.cline/skills"            "kilocode:.kilocode/skills"
  "crush:.crush/skills"
)

echo "═══ 期望每款装入 $EXPECT_SKILLS 个 skill ═══"
echo ""
echo "─── A. 项目级：装 / 落盘断言 / 幂等 / 卸载无残留（22 款）───"
for entry in "${SPEC[@]}"; do
  tool="${entry%%:*}"; sdir="${entry#*:}"
  T=$(mktemp -d); cd "$T"

  if ! node "$INS" --tool "$tool" >/dev/null 2>&1; then
    bad "$tool: 安装退出码非 0"; rm -rf "$T"; continue
  fi
  n=$(ls -d "$T/$sdir"/*/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n" != "$EXPECT_SKILLS" ]; then
    bad "$tool: $sdir 里是 $n 个 skill，期望 $EXPECT_SKILLS"; rm -rf "$T"; continue
  fi
  # 嵌套 bug 检查：不应出现 skills/skills 之类
  if find "$T" -type d -path "*/skills/skills" 2>/dev/null | grep -q .; then
    bad "$tool: 出现嵌套 skills/skills 目录"
  fi

  node "$INS" --tool "$tool" >/dev/null 2>&1
  n2=$(ls -d "$T/$sdir"/*/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n2" != "$EXPECT_SKILLS" ]; then
    bad "$tool: 二次安装后变成 $n2 个（幂等性破坏）"; rm -rf "$T"; continue
  fi

  if ! node "$INS" --uninstall >/dev/null 2>&1; then
    bad "$tool: 卸载退出码非 0"; rm -rf "$T"; continue
  fi
  left=$(find "$T" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$left" != "0" ]; then
    bad "$tool: 卸载后残留 $left 个文件: $(find "$T" -type f | head -3 | tr '\n' ' ')"
  else
    ok
  fi
  cd /; rm -rf "$T"
done

echo ""
echo "─── B. 自动检测：每个标记只触发预期工具 ───"
declare -a DETECT=(
  ".claude:Claude Code"      ".cursor:Cursor"        ".codex:Codex CLI"
  ".kiro:Kiro"               ".trae:Trae"            ".agents:Antigravity"
  ".openclaw:OpenClaw"       ".windsurf:Windsurf"    ".aider:Aider"
  # Aider 的真实标记：它不创建 .aider/ 目录，留下的是 .aider. 前缀的产物。
  # 只测 ".aider" 等于拿代码测代码 —— 真实 Aider 项目一个都匹配不上。
  ".aider.conf.yml:Aider"    ".aider.chat.history.md:Aider"  ".aider.tags.cache.v3:Aider"
  ".opencode:OpenCode"       ".qwen:Qwen Code"       ".hermes:Hermes Agent"
  ".claw:Claw Code"          ".qoder:Qoder"          ".codebuddy:CodeBuddy"
  ".codeartsdoer:CodeArts"   ".clinerules:Cline"     ".kilocode:Kilo Code"
  ".kilo:Kilo Code"          ".crush:Crush"
  # DeerFlow 2.0 顶层没有 deer_flow 目录（backend/frontend/skills/…），只测它等于
  # 拿代码测代码。skills/public 是 skills 机制本身、随仓库版本控制，才是真实标记。
  "skills/public:DeerFlow"   "deer_flow:DeerFlow"
  ".github/copilot-instructions.md:VS Code"
  "GEMINI.md:Gemini CLI"
)
for entry in "${DETECT[@]}"; do
  marker="${entry%%:*}"; want="${entry#*:}"
  T=$(mktemp -d); cd "$T"
  case "$marker" in
    # .yml 也要按「文件」建 —— .aider.conf.yml 是文件不是目录。existsSync 两者都
    # 匹配得上，但用目录冒充文件等于测了个假场景，下次改检测逻辑就发现不了问题。
    *.md|*.json|*.yml) mkdir -p "$(dirname "$marker")" 2>/dev/null; : > "$marker" ;;
    *)           mkdir -p "$marker" ;;
  esac
  got=$(node "$INS" 2>&1 | grep -oE '✅ [A-Za-z][A-Za-z ]*(\[|:)' | sed 's/✅ //; s/ *[:[]$//' | sort -u | tr '\n' ',' | sed 's/,$//')
  if [ "$got" != "$want" ]; then
    bad "检测 ${marker}/ -> 得到「${got}」，期望「${want}」"
  else
    ok
  fi
  cd /; rm -rf "$T"
done

echo ""
echo "─── C. --global：11 款应成功，其余应明确拒绝且退出码 1 ───"
declare -a GLOBAL_OK=(claude codex openclaw windsurf opencode qwen qoder crush hermes codebuddy codearts)
declare -a GLOBAL_NO=(cursor kiro trae aider deerflow vscode claw gemini antigravity cline kilocode)
# 全局落盘位置断言。原来这里只看退出码 —— 而 Windsurf 的 --global 曾装到
# ~/.windsurf/skills，官方实际读 ~/.codeium/windsurf/skills，退出码照样是 0。
# 「跑通了」不等于「装对了」，必须断言 skill 真的落在官方读的那个目录。
declare -a GLOBAL_DIR=(
  "claude:.claude/skills"        "codex:.agents/skills"        "openclaw:.openclaw/skills"
  "windsurf:.codeium/windsurf/skills"                          "opencode:.config/opencode/skills"
  "qwen:.qwen/skills"            "qoder:.qoder/skills"         "crush:.config/crush/skills"
  "hermes:.hermes/skills"        "codebuddy:.codebuddy/skills"
  "codearts:.codeartsdoer/skills"
)
for entry in "${GLOBAL_DIR[@]}"; do
  tool="${entry%%:*}"; gdir="${entry#*:}"
  H=$(mktemp -d)
  if HOME="$H" node "$INS" --global --tool "$tool" >/dev/null 2>&1; then
    n=$(ls -d "$H/$gdir"/*/ 2>/dev/null | wc -l | tr -d ' ')
    if [ "$n" = "$EXPECT_SKILLS" ]; then ok; else
      bad "--global ${tool}: ${gdir} 里是 ${n} 个 skill，期望 ${EXPECT_SKILLS} —— 装到别处了？"
    fi
  else
    bad "--global ${tool} 应成功但失败"
  fi
  rm -rf "$H"
done
# 自检：GLOBAL_DIR 必须覆盖 GLOBAL_OK 全部，新增全局工具时不能漏断言落盘位置
if [ "${#GLOBAL_DIR[@]}" = "${#GLOBAL_OK[@]}" ]; then ok; else
  bad "GLOBAL_DIR(${#GLOBAL_DIR[@]}) 与 GLOBAL_OK(${#GLOBAL_OK[@]}) 数量不一致 —— 有全局工具没断言落盘位置"
fi
for tool in "${GLOBAL_NO[@]}"; do
  H=$(mktemp -d)
  out=$(HOME="$H" node "$INS" --global --tool "$tool" 2>&1); rc=$?
  if [ $rc -eq 0 ]; then bad "--global $tool 应拒绝但成功了"
  elif ! echo "$out" | grep -q "不支持通用全局安装"; then bad "--global $tool 拒绝信息缺失"
  else ok; fi
  rm -rf "$H"
done

echo ""
echo "─── D. --global 拒绝信息里引用的 docs 文件必须存在 ───"
for slug in gemini-cli antigravity trae aider hermes kiro cline kilocode; do
  if [ -f "$REPO/docs/README.$slug.md" ]; then ok; else bad "docs/README.$slug.md 不存在（拒绝信息会指向死链）"; fi
done

echo ""
echo "─── E. 新工具 bootstrap 索引内容断言 ───"
T=$(mktemp -d); cd "$T"; node "$INS" --tool cline >/dev/null 2>&1
R="$T/.clinerules/superpowers-zh.md"
[ -f "$R" ] && ok || bad "Cline 索引文件未生成"
head -1 "$R" | grep -q '^---' && bad "Cline 索引不该有 YAML frontmatter（Cline 只支持 paths 字段）" || ok
rows=$(grep -cE '^\| [a-z][a-z0-9-]+ \|' "$R")
[ "$rows" = "$EXPECT_SKILLS" ] && ok || bad "Cline 索引表 $rows 行，期望 $EXPECT_SKILLS"
grep -qE '^\| [a-z0-9-]+ \|\s*\|$' "$R" && bad "Cline 索引有空 description 的行" || ok
grep -q '\.cline/skills/' "$R" && ok || bad "Cline 索引未指向 .cline/skills/"
cd /; rm -rf "$T"

T=$(mktemp -d); cd "$T"; node "$INS" --tool kilocode >/dev/null 2>&1
R="$T/.kilocode/rules/superpowers-zh.md"
[ -f "$R" ] && ok || bad "Kilo 索引文件未生成"
rows=$(grep -cE '^\| [a-z][a-z0-9-]+ \|' "$R")
[ "$rows" = "$EXPECT_SKILLS" ] && ok || bad "Kilo 索引表 $rows 行，期望 $EXPECT_SKILLS"
grep -q '\.kilocode/skills/' "$R" && ok || bad "Kilo 索引未指向 .kilocode/skills/"
cd /; rm -rf "$T"

# VS Code：Copilot 不认识 .github/superpowers/，必须靠 instructions 文件引导。
# applyTo 缺失的话该文件只能手动挂载 = 白写，所以这条要硬断言。
T=$(mktemp -d); cd "$T"; node "$INS" --tool vscode >/dev/null 2>&1
R="$T/.github/instructions/superpowers-zh.instructions.md"
[ -f "$R" ] && ok || bad "VS Code instructions 文件未生成 —— skills 会成为 Copilot 读不到的死重"
grep -q '^applyTo: "\*\*"' "$R" && ok || bad "VS Code instructions 缺 applyTo: \"**\"（不写就只能手动挂载）"
rows=$(grep -cE '^\| [a-z][a-z0-9-]+ \|' "$R")
[ "$rows" = "$EXPECT_SKILLS" ] && ok || bad "VS Code 索引表 $rows 行，期望 $EXPECT_SKILLS"
grep -q '\.github/superpowers/' "$R" && ok || bad "VS Code 索引未指向 .github/superpowers/"
cd /; rm -rf "$T"

T=$(mktemp -d); cd "$T"; node "$INS" --tool kiro >/dev/null 2>&1
R="$T/.kiro/steering/superpowers-zh.md"
[ -f "$R" ] && ok || bad "Kiro steering 索引未生成"
head -2 "$R" | grep -q '^inclusion: always' && ok || bad "Kiro 索引缺 inclusion: always frontmatter"
rows=$(grep -cE '^\| [a-z][a-z0-9-]+ \|' "$R")
[ "$rows" = "$EXPECT_SKILLS" ] && ok || bad "Kiro 索引表 $rows 行，期望 $EXPECT_SKILLS"
grep -q '\.kiro/skills/' "$R" && ok || bad "Kiro 索引未指向 .kiro/skills/"
# 回归守卫：steering 每轮常驻，里面只能有索引这一个文件。v1.7.9 曾把 20 个 skill
# 正文装在这里 —— 47 个 md、335 KB 每轮进 prompt。别再退回去。
steer_md=$(find "$T/.kiro/steering" -name '*.md' | wc -l | tr -d ' ')
[ "$steer_md" = "1" ] && ok || bad "Kiro steering 下有 $steer_md 个 md（只该有索引 1 个）—— 正文不能放常驻目录"
steer_bytes=$(find "$T/.kiro/steering" -name '*.md' -exec cat {} + | wc -c | tr -d ' ')
[ "$steer_bytes" -lt 20000 ] && ok || bad "Kiro steering 常驻 $steer_bytes 字节，超过 20 KB 阈值"
cd /; rm -rf "$T"

# 升级路径：旧布局（正文躺在 steering 下）必须被清掉，否则新旧并存等于没修
T=$(mktemp -d); cd "$T"; mkdir -p .kiro/steering/brainstorming
echo "旧正文" > .kiro/steering/brainstorming/SKILL.md
printf -- '---\ninclusion: always\n---\n我自己的规则\n' > .kiro/steering/my-own.md
node "$INS" --tool kiro >/dev/null 2>&1
[ -d "$T/.kiro/steering/brainstorming" ] && bad "Kiro 升级未清理旧布局 .kiro/steering/<skill>/" || ok
[ -f "$T/.kiro/steering/my-own.md" ] && ok || bad "Kiro 升级误删了用户自己的 steering 文件"
cd /; rm -rf "$T"

# Qwen Code：bootstrap 必须写 QWEN.md（官方分层记忆的默认上下文文件），
# 且项目级/全局装卸都不能留残留。v1.7.10 及更早只装 skills 不写 bootstrap。
T=$(mktemp -d); cd "$T"
printf '# 用户自己的上下文\n' > QWEN.md
node "$INS" --tool qwen >/dev/null 2>&1
grep -q 'superpowers-zh' QWEN.md && ok || bad "Qwen: QWEN.md 未写入 bootstrap"
grep -q '用户自己的上下文' QWEN.md && ok || bad "Qwen: 覆盖了用户已有的 QWEN.md"
grep -q '\.qwen/skills/' QWEN.md && ok || bad "Qwen: bootstrap 未指向 .qwen/skills/"
node "$INS" --uninstall >/dev/null 2>&1
grep -q 'superpowers-zh' QWEN.md && bad "Qwen: 卸载后 QWEN.md 仍残留 superpowers-zh 段" || ok
grep -q '用户自己的上下文' QWEN.md && ok || bad "Qwen: 卸载误删了用户自己的 QWEN.md 内容"
cd /; rm -rf "$T"

H=$(mktemp -d)
HOME="$H" node "$INS" --global --tool qwen >/dev/null 2>&1
[ -f "$H/.qwen/QWEN.md" ] && ok || bad "Qwen --global: 未写 ~/.qwen/QWEN.md"
HOME="$H" node "$INS" --global --uninstall >/dev/null 2>&1
left=$(find "$H" -type f 2>/dev/null | wc -l | tr -d ' ')
[ "$left" = "0" ] && ok || bad "Qwen --global 卸载后 HOME 残留 $left 个文件"
rm -rf "$H"

echo ""
echo "─── F. PATH 探测健壮性（issue #48 新代码）───"
T=$(mktemp -d); cd "$T"
out=$(PATH="" "$NODE" "$INS" 2>&1); rc=$?
[ $rc -eq 1 ] && ok || bad "PATH 为空时应退出码 1，得到 $rc"
echo "$out" | grep -q "未在当前目录检测到" && ok || bad "PATH 为空时缺少检测落空提示"
out=$(PATH="/nonexistent:::/also/missing" "$NODE" "$INS" 2>&1); rc=$?
[ $rc -eq 1 ] && ok || bad "PATH 含空段/不存在目录时应优雅退出 1，得到 $rc"
echo "$out" | grep -qi "error\|Traceback\|ENOENT" && bad "PATH 异常时输出了未捕获错误" || ok
cd /; rm -rf "$T"

echo ""
echo "─── H. 外链验活：docs / README 里引用的官方文档必须真实存在 ───"
# 起因：docs/README.openclaw.md 长期链着 github.com/anthropics/openclaw —— 那个仓库
# 根本不存在（真正的是 openclaw/openclaw）；README 还把谷歌的 Antigravity 链成
# anthropics/antigravity。编造出来的「出处」比没有出处更坏：它让人以为核实过了。
# 无网络时跳过，不阻塞离线发版。
# 串行跑 45 条链接（每条最多 12s）会把整个脚本拖到分钟级并撞上超时 —— 第一版就是
# 这么写的，直接把 verify-release 跑挂了。改成 xargs -P 并行 + 8s 上限，结果写进
# 临时文件后再回到主 shell 计数（bad 是函数，在子进程里加不上计数）。
if curl -sS -o /dev/null --max-time 5 https://github.com 2>/dev/null; then
  LINKTMP=$(mktemp)
  # 第一遍并行快扫。注意这一遍**会误报** —— 实测 docs.codeium.com 在 8s 上限下
  # 偶发超时，而它其实活着。一个会误报的门禁比没有门禁更糟：人会学会忽略它。
  # 所以第一遍只产出「嫌疑名单」，不下结论。
  grep -rhoE "https://[a-zA-Z0-9./_-]+" "$REPO"/docs/*.md "$REPO"/README.md "$REPO"/README.zh-Hant.md 2>/dev/null \
    | grep -viE "jnmetacode|aiolaola|user-images|shields\.io|opensource\.org|makeapullrequest|npmjs\.com|compshare|cubence|claude\.ai/code" \
    | sed 's/[.,)]*$//' | sort -u \
    | xargs -P 10 -I{} sh -c 'c=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 8 "$1" 2>/dev/null); case "$c" in 2*|3*|403) ;; *) echo "$1" ;; esac' _ {} \
    > "$LINKTMP" 2>/dev/null
  # 第二遍：只对嫌疑名单串行复核，放宽超时并让 curl 自己重试。两遍都判死才算死。
  suspects=$(wc -l < "$LINKTMP" | tr -d ' ')
  dead=0
  if [ "$suspects" != "0" ]; then
    while read -r u; do
      [ -z "$u" ] && continue
      c=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 25 --retry 2 --retry-delay 1 "$u" 2>/dev/null)
      case "$c" in
        2*|3*|403) ;;
        *) bad "死链（${c:-无响应}）: ${u}"; dead=$((dead+1)) ;;
      esac
    done < "$LINKTMP"
  fi
  [ "$dead" = "0" ] && ok || true
  rm -f "$LINKTMP"
else
  # 跳过时也计一次 ok，否则 PASS 总数会随网络状况漂移，发版记录里对不上
  echo "  (无网络，跳过外链验活)"
  ok
fi

echo ""
echo "─── G. 自检：本脚本的覆盖清单不得落后于 installer ───"
# 与 audit.sh Category 5 同一口径：TARGETS 条目数 + 1（Copilot CLI 与 CC 共用目标）
targets=$(sed -n '/^const TARGETS = \[/,/^\];/p' "$INS" | grep -cE "^  \{ name: '")
expected=$((targets + 1))
if [ "${#SPEC[@]}" = "$expected" ]; then ok; else
  bad "A 段只覆盖 ${#SPEC[@]} 款工具，installer 支持 ${expected} 款 —— 新工具没进 SPEC 会被静默漏测"
fi
# 比对工具名集合，而不是数条数 —— 一个工具可以有多个检测标记
detect_tools=$(printf '%s\n' "${DETECT[@]}" | sed 's/^[^:]*://' | sort -u)
target_tools=$(sed -n '/^const TARGETS = \[/,/^\];/p' "$INS" | sed -nE "s/^  \{ name: '([^']+)'.*/\1/p" | sort -u)
uncovered=$(comm -13 <(printf '%s\n' "$detect_tools") <(printf '%s\n' "$target_tools"))
if [ -z "$uncovered" ]; then ok; else
  bad "B 段未验证这些工具的检测标记: $(printf '%s' "$uncovered" | tr '\n' ' ')"
fi

echo ""
echo "═══════════════════════════════════"
echo "✅ PASS: $PASS    ❌ FAIL: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "失败项："
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  exit 1
fi
echo "✅ 深度验证全部通过"
