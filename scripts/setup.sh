#!/bin/sh
# One-shot onboarding. Run from repo root: sh scripts/setup.sh
set -e
cd "$(dirname "$0")/.."

echo "[setup] enabling pre-push sync hook"
git config core.hooksPath .githooks
chmod +x .githooks/pre-push 2>/dev/null || true

echo "[setup] checking tools"
for t in git node npm python; do
  if command -v "$t" >/dev/null 2>&1; then echo "  ok   $t ($($t --version 2>&1 | head -1))"; else echo "  MISSING $t"; fi
done
if command -v graphify >/dev/null 2>&1 || python -m graphify --help >/dev/null 2>&1; then
  echo "  ok   graphify"
else
  echo "  installing graphify (knowledge graph CLI)"; pip install -q graphifyy || echo "  WARN graphify install failed; run: pip install graphifyy"
fi

# ECC (Everything Claude Code): agents, commands, rules, workflow skills, hooks for Claude Code.
# Installed per machine because its hook commands embed this machine's absolute path.
ECC_VERSION=2.2.3
echo "[setup] installing ECC $ECC_VERSION into .claude/ (project scope, core profile, hooks on)"
if command -v npx >/dev/null 2>&1; then
  npx -y "ecc-universal@$ECC_VERSION" install --target claude-project --profile core --enable-hooks >/dev/null     && npx -y "ecc-universal@$ECC_VERSION" doctor --target claude-project | grep -E "Status|Summary"     || echo "  WARN ECC install failed; rerun: npx -y ecc-universal@$ECC_VERSION install --target claude-project --profile core --enable-hooks"
else
  echo "  SKIP ECC: npx not found (install Node.js 18+)"
fi

echo "[setup] skills present in .claude/skills:"
ls .claude/skills

name=$(git config user.name)
echo "[setup] git identity: ${name:-<unset>} <$(git config user.email)>"
[ -z "$name" ] && echo "  set it: git config user.name \"Your Name\"; git config user.email you@example.com"

echo
echo "Next: read TEAM_INSTRUCTIONS.md, then AGENTS.md. Create your branch: git checkout -b <name>/<topic>"
