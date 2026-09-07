#!/usr/bin/env bash
#
# make-og-image.sh —— 生成社交分享大图 assets/og-image.jpg（1200×630）
#
# 为什么是脚本而不是构建时生成：渲染依赖 ImageMagick，而官网构建跑在 Cloudflare
# Pages 上（只有 node，没有 magick）。所以图是**提交进仓库的产物**，改了文案或
# 数字要手动重跑这个脚本。
#
# 图里的数字（skill 数 / 工具数）不写死 —— 从 skills/ 目录与 bin/superpowers-zh.js
# 的 TARGETS 现场算，跟官网统计块同一个口径。否则图片里的数字漂了没有任何门禁看得见。
#
# 用法：bash scripts/make-og-image.sh   （产物 assets/og-image.jpg）
set -euo pipefail
cd "$(dirname "$0")/.."

command -v magick >/dev/null || { echo "需要 ImageMagick（brew install imagemagick）" >&2; exit 1; }

CJK=/System/Library/Fonts/PingFang.ttc
MONO=/System/Library/Fonts/Menlo.ttc
for f in "$CJK" "$MONO"; do
  [ -f "$f" ] || { echo "缺字体：${f}（本脚本依赖 macOS 系统字体）" >&2; exit 1; }
done

# —— 现场取数，与官网 / audit 同口径 ——
SKILLS=$(ls -d skills/*/ | wc -l | tr -d ' ')
CN=$(ls -d skills/chinese-*/ | wc -l | tr -d ' ')
TARGETS=$(sed -n '/^const TARGETS = \[/,/^\];/p' bin/superpowers-zh.js | grep -cE "^  \{ name: '")
TOOLS=$((TARGETS + 1))            # Copilot CLI 与 Claude Code 共用目标，文案里单独计数
echo "  取数：${SKILLS} skills / ${CN} 中国原创 / ${TOOLS} 款工具"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# logo：原图是黑字符白底，反色成白色并抠掉底
magick assets/app-icon.png -alpha off -negate -fuzz 25% -transparent black -resize 150x150 "$TMP/logo.png"

# 底色 + 两团品牌辉光（#7c6cff / #4dd6c8，取自 site/template/styles.css）
magick -size 1200x630 xc:'#0a0b10' \
  \( -size 1200x630 radial-gradient:'#7c6cff'-'#0a0b10' -resize 200% -crop 1200x630+0+0 +repage -evaluate multiply 0.28 \) \
  -compose screen -composite \
  \( -size 700x700 radial-gradient:'#4dd6c8'-'#0a0b10' -evaluate multiply 0.20 \) \
  -geometry +780+260 -compose screen -composite \
  \( -size 1200x7 gradient:'#7c6cff'-'#4dd6c8' -rotate 90 -resize 1200x7! \) \
  -geometry +0+0 -compose over -composite \
  "$TMP/base.png"

magick "$TMP/base.png" \
  "$TMP/logo.png" -geometry +78+118 -compose over -composite \
  -font "$CJK" -fill '#e7e9f0' -pointsize 82 -annotate +248+205 'superpowers-zh' \
  -font "$CJK" -fill '#4dd6c8' -pointsize 36 -annotate +252+262 'AI 编程超能力 · 中文增强版' \
  -font "$CJK" -fill '#9aa0b4' -pointsize 33 -annotate +80+390 "${SKILLS} 个实战方法论 Skill · ${TOOLS} 款 AI 编程工具通用" \
  -font "$CJK" -fill '#9aa0b4' -pointsize 33 -annotate +80+440 "obra/superpowers 完整汉化 + ${CN} 个中国原创 · MIT 开源" \
  -fill '#161924' -stroke '#242838' -strokewidth 1 -draw 'roundrectangle 80,500 540,570 14,14' \
  -stroke none -font "$MONO" -fill '#4dd6c8' -pointsize 30 -annotate +108+545 'npx superpowers-zh' \
  -font "$CJK" -fill '#6b7186' -pointsize 27 -gravity SouthEast -annotate +80+40 'sp.aiolaola.com' \
  -quality 90 -strip assets/og-image.jpg

echo "  产出：assets/og-image.jpg  $(sips -g pixelWidth -g pixelHeight assets/og-image.jpg | tail -2 | tr -s ' \n' ' ') $(stat -f%z assets/og-image.jpg) 字节"
