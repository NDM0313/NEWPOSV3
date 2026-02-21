#!/bin/bash
# Install post-commit hook to auto-push after commit.
# Run once: bash scripts/install-post-commit-push.sh

HOOK=".git/hooks/post-commit"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

cat > "$HOOK" << 'HOOK'
#!/bin/sh
# Auto-push after commit (optional - install via scripts/install-post-commit-push.sh)
BRANCH=$(git branch --show-current)
git push origin "$BRANCH" 2>/dev/null || echo "Push failed (check remote)"
HOOK
chmod +x "$HOOK"
echo "[OK] Post-commit hook installed. Commits will auto-push to origin."
echo "To disable: rm .git/hooks/post-commit"
