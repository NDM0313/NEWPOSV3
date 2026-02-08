#!/bin/bash

# Quick script to create a GitHub Pull Request
# Usage: ./scripts/create-pr.sh "PR Title" feature-branch main

set -e

TITLE="$1"
HEAD_BRANCH="$2"
BASE_BRANCH="${3:-main}"

if [ -z "$TITLE" ] || [ -z "$HEAD_BRANCH" ]; then
  echo "❌ Error: Title and head branch are required"
  echo "Usage: ./scripts/create-pr.sh \"PR Title\" feature-branch [base-branch]"
  exit 1
fi

# Get current branch if HEAD_BRANCH is not provided
if [ "$HEAD_BRANCH" == "." ]; then
  HEAD_BRANCH=$(git branch --show-current)
fi

echo "🚀 Creating pull request..."
echo "   Title: $TITLE"
echo "   Head:  $HEAD_BRANCH"
echo "   Base:  $BASE_BRANCH"
echo ""

# Check if gh CLI is installed
if command -v gh &> /dev/null; then
  gh pr create --title "$TITLE" --head "$HEAD_BRANCH" --base "$BASE_BRANCH" --body ""
else
  # Fallback to Node.js script
  if [ -f "scripts/github-pr-utils.js" ]; then
    node scripts/github-pr-utils.js create --title "$TITLE" --head "$HEAD_BRANCH" --base "$BASE_BRANCH"
  else
    echo "❌ Error: GitHub CLI (gh) not installed and github-pr-utils.js not found"
    echo "   Install GitHub CLI: brew install gh (Mac) or visit https://cli.github.com"
    exit 1
  fi
fi

echo ""
echo "✅ Pull request created successfully!"
