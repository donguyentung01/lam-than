#!/bin/bash
# Build, deploy a preview, and point test.lamthan.com at it. Live site is untouched.
set -e
cd "$(dirname "$0")/.."
./build.sh
URL=$(npx -y vercel@latest deploy --yes 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | tail -1)
[ -n "$URL" ] || { echo "deploy failed: no preview URL"; exit 1; }
npx -y vercel@latest alias set "$URL" test.lamthan.com >/dev/null 2>&1
echo "preview:  $URL"
echo "test URL: https://test.lamthan.com"
