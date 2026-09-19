#!/bin/bash
# Build and deploy to the live site, https://lamthan.com
set -e
cd "$(dirname "$0")/.."
./build.sh
npx -y vercel@latest deploy --prod --yes 2>&1 | grep -E "Aliased|Error" | head -2
echo "live: https://lamthan.com"
