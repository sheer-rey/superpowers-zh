#!/usr/bin/env bash
# Script: sync-archify.sh — Sync skills/archify/ to a specified tt-a1i/archify version.
#
# Usage:
#   scripts/sync-archify.sh              # Sync to upstream main (development head)
#   scripts/sync-archify.sh v3.0.1       # Sync to a specific tag / commit
#
# What it does (mirrors the manual flow used when archify was first introduced):
#   1. Clone/reuse the upstream repo and check out the target version
#   2. Copy only the runtime-required files of skills/archify/, dropping
#      dev-only artifacts and pre-rendered outputs
#   3. Verify: kept files must be byte-identical to upstream (no edits), and
#      `archify doctor` must be all-green, before anything is overwritten
#
# Trim policy (must stay consistent with the repo's current state):
#   - Keep: top-level files + assets bin brand-marks delta migrations recipes
#           references renderers schemas scripts + all examples/*.json
#   - Drop: test/, examples/*.html, examples/locales/ (dev-only / rendered assets)
#
# Exit codes:
#   0 = success (skills/archify/ has been replaced)
#   1 = failure (skills/archify/ left untouched)

set -euo pipefail

UPSTREAM_REPO="https://github.com/tt-a1i/archify.git"
TAG="${1:-main}"
WORKDIR_REPO="/tmp/archify-upstream-sync"   # Reused dir, avoids re-cloning
WORKDIR_SKILL="/tmp/archify-skill-staging"  # Staging area for the trimmed copy

DST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/skills/archify"

echo "==> Target: ${DST}"
echo "==> Upstream version: ${TAG}"

# ---- 1. Get the upstream repo at the target version ----
if [ ! -d "$WORKDIR_REPO/.git" ]; then
  echo "==> Cloning upstream (first run)..."
  git clone --depth 1 "$UPSTREAM_REPO" "$WORKDIR_REPO" >/dev/null
fi

echo "==> Checking out ${TAG} ..."
( cd "$WORKDIR_REPO"
  # A shallow clone only has the default branch's shallow history; a tag may not
  # be present, so pull it explicitly by ref.
  if [ "$TAG" != "main" ] && ! git rev-parse --quiet --verify "$TAG^{commit}" >/dev/null 2>&1; then
    git fetch --depth 1 origin "refs/tags/${TAG}:refs/tags/${TAG}" >/dev/null 2>&1 || true
  fi
  git fetch --depth 1 origin "$TAG" >/dev/null 2>&1 || git fetch --tags --depth 4096 >/dev/null 2>&1 || true
  if git rev-parse --quiet --verify "$TAG^{commit}" >/dev/null 2>&1; then
    git checkout -q --detach "$TAG"
  else
    echo "!! Cannot resolve version '${TAG}' (neither a branch nor a tag). Aborting." >&2
    exit 1
  fi
)

SRC="$WORKDIR_REPO/archify"
[ -d "$SRC" ] || { echo "!! No archify/ dir in the upstream repo — aborting" >&2; exit 1; }

# ---- 2. Build the trimmed skill copy in the staging area ----
rm -rf "$WORKDIR_SKILL"; mkdir -p "$WORKDIR_SKILL"

# Top-level files
for f in LICENSE SKILL.md THIRD_PARTY_NOTICES.md package.json skill-release.json; do
  [ -f "$SRC/$f" ] && cp "$SRC/$f" "$WORKDIR_SKILL/"
done

# Directories (copied in full)
for d in assets bin brand-marks delta migrations recipes references renderers schemas scripts; do
  [ -d "$SRC/$d" ] && cp -r "$SRC/$d" "$WORKDIR_SKILL/"
done

# examples: keep only *.json (drop rendered *.html output and locales/ dicts)
mkdir -p "$WORKDIR_SKILL/examples"
for f in "$SRC"/examples/*.json; do
  [ -f "$f" ] && cp "$f" "$WORKDIR_SKILL/examples/"
done

echo "==> Staging copy ready: $(du -sh "$WORKDIR_SKILL" | cut -f1) ($(find "$WORKDIR_SKILL" -type f | wc -l) files)"
echo "==> Version: $(grep -m1 '"version"' "$WORKDIR_SKILL/skill-release.json" 2>/dev/null || echo '?')"

# ---- 3. Verification ----
echo "==> Check 1/2: staging copy must be byte-identical to upstream ${TAG} (pure trim, no edits)..."
bad=$( { diff -qr "$SRC" "$WORKDIR_SKILL" || true; } 2>/dev/null | grep "differ" )
if [ -z "$bad" ]; then
  echo "   ✓ Kept files are byte-identical to upstream (pure trim, no content rewrite)"
else
  echo "!! Staging copy contains rewritten content (not a pure trim) — aborting without overwrite" >&2
  echo "$bad" | head >&2
  exit 1
fi

echo "==> Check 2/2: archify doctor self-check..."
DOCTOR_OUT=$( (cd "$WORKDIR_SKILL" && node bin/archify.mjs doctor) 2>&1 )
if echo "$DOCTOR_OUT" | grep -qE "\[missing\]|\[fail\]"; then
  echo "!! doctor is not all-green — aborting without overwrite (skills/archify/ left untouched):" >&2
  echo "$DOCTOR_OUT" | grep -E "\[missing\]|\[fail\]" | head >&2
  exit 1
fi
echo "   ✓ doctor passed $(echo "$DOCTOR_OUT" | grep -cE '\[ok\]') checks"

# ---- 4. Overwrite the repo skill ----
echo "==> Overwriting ${DST} ..."
rm -rf "$DST"
cp -r "$WORKDIR_SKILL" "$DST"

echo
echo "✔ Done. skills/archify/ is now synced to upstream ${TAG}"
echo "  Next: review, then git add skills/archify/ and commit (no README update needed)"