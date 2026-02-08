# GitHub Pull Request System - Quick Start

## 🚀 Quick Setup (5 minutes)

### Step 1: Get GitHub Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it: "ERP PR System"
4. Select scope: ✅ **repo**
5. Click "Generate token"
6. **Copy the token** (starts with `ghp_`)

### Step 2: Set Token in App

1. Open your ERP application
2. Click **GitHub PRs** in the sidebar
3. Click "Set GitHub Token"
4. Paste your token
5. Click "Save Token"

### Step 3: Start Using!

✅ You're ready! You can now:
- View all pull requests
- Create new pull requests
- Merge/close pull requests
- Add comments
- View file changes

## 📝 Common Tasks

### Create a Pull Request

1. Click **New Pull Request**
2. Fill in:
   - Title: "Fix login bug"
   - Source: `feature-branch`
   - Target: `main`
3. Click **Create Pull Request**

### View Pull Request Details

1. Click on any PR in the list
2. View:
   - Description
   - Files changed
   - Comments
   - Reviews

### Merge a Pull Request

1. Open the PR
2. Click **Merge** button
3. Confirm merge

## 🔧 Optional: CLI Tools

If you want to use command-line tools:

```bash
# Install dependencies
npm install --save-dev @octokit/rest dotenv

# Set token in .env.local
echo "GITHUB_TOKEN=ghp_your_token_here" >> .env.local

# Use CLI
node scripts/github-pr-utils.js list
```

## ❓ Need Help?

See full documentation: `GITHUB_PULL_REQUEST_SYSTEM.md`

---

**That's it! Happy PR managing! 🎉**
