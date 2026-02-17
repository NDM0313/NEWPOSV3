# Windows - sync only (pull from GitHub, no push)
# Usage: .\scripts\sync-pull.ps1

$branch = "before-mobile-replace"
git fetch origin
git pull origin $branch
