#!/usr/bin/env bash
# Deploy insurance logo/homepage changes from this machine to Railway,
# and attempt to publish them to redbeartvdev/strugglingwithaddiction.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checkout insurance commit on main"
git fetch origin main 2>/dev/null || true
git checkout main
git merge-base --is-ancestor e792e85 HEAD 2>/dev/null || git pull --ff-only origin main || true
echo "HEAD: $(git log -1 --oneline)"

echo "==> Build frontends into backend/static"
./scripts/prepare-railway-static.sh

echo "==> Deploy to Railway (requires: railway login)"
cd backend
railway up --ci --detach
cd "$ROOT"
echo "Railway deploy kicked off."

echo "==> Publish to upstream GitHub for Actions (optional)"
if git push upstream main 2>/dev/null; then
  echo "Pushed main → upstream (Actions Deploy should run)."
else
  echo "Could not fast-forward push to upstream/main (histories diverged)."
  echo "Open a compare PR from your fork:"
  echo "  https://github.com/redbeartvdev/strugglingwithaddiction/compare/main...dlvenida:strugglingwithaddiction:main"
  echo "Or after 'gh auth login':"
  echo "  gh pr create --repo redbeartvdev/strugglingwithaddiction --base main --head dlvenida:main --title 'Insurance logos + homepage section'"
fi
