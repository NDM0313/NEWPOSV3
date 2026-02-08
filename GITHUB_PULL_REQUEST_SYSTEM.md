# GitHub Pull Request System - Complete Documentation

## 📋 Overview

This is a complete GitHub Pull Request management system integrated into the ERP application. It provides a full-featured UI for managing pull requests directly from the application, along with command-line utilities for automation.

## ✨ Features

### Frontend UI Components

1. **Pull Request List** (`PullRequestList.tsx`)
   - View all pull requests with filtering (open/closed/all)
   - Search functionality
   - Real-time status indicators
   - Branch information display
   - File change statistics

2. **Pull Request Detail** (`PullRequestDetail.tsx`)
   - Complete PR information
   - Comments and reviews
   - File changes list
   - Merge/close actions
   - Add comments functionality

3. **Create Pull Request** (`CreatePullRequestDialog.tsx`)
   - Create new pull requests
   - Select source and target branches
   - Draft PR support
   - Form validation

4. **Main Page** (`GitHubPullRequestsPage.tsx`)
   - Authentication management
   - Token setup dialog
   - Navigation between list and detail views

### Backend Services

1. **GitHub Service** (`githubService.ts`)
   - Complete GitHub API integration
   - Pull request CRUD operations
   - Comments and reviews management
   - Branch listing
   - Repository information

### Command-Line Utilities

1. **Node.js Script** (`scripts/github-pr-utils.js`)
   - List pull requests
   - Create pull requests
   - Merge pull requests
   - Close pull requests
   - Get PR information

2. **Bash Script** (`scripts/create-pr.sh`)
   - Quick PR creation
   - Uses GitHub CLI or Node.js fallback

## 🚀 Getting Started

### 1. Generate GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (Full control of private repositories)
4. Copy the token (starts with `ghp_`)

### 2. Set Up Authentication

#### Option A: In the Application UI

1. Navigate to **GitHub PRs** in the sidebar
2. Click "Set GitHub Token"
3. Paste your token
4. Token is stored in `localStorage`

#### Option B: Environment Variable

Create or update `.env.local`:

```env
VITE_GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=NDM0313
GITHUB_REPO=NEWPOSV3
```

For command-line scripts, also add:

```env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=NDM0313
GITHUB_REPO=NEWPOSV3
```

### 3. Access the UI

1. Open the application
2. Click **GitHub PRs** in the sidebar
3. If not authenticated, you'll see the authentication screen
4. Set your token and start managing PRs!

## 📖 Usage Guide

### Using the UI

#### Viewing Pull Requests

1. Navigate to **GitHub PRs** page
2. Use filters:
   - **State**: Open, Closed, or All
   - **Search**: Search by title, description, or PR number
3. Click on any PR to view details

#### Creating a Pull Request

1. Click **New Pull Request** button
2. Fill in the form:
   - **Title**: Descriptive title (required)
   - **Description**: Detailed description (optional)
   - **Source Branch**: Branch with your changes
   - **Target Branch**: Branch to merge into (usually `main`)
   - **Draft**: Check to create as draft
3. Click **Create Pull Request**

#### Managing Pull Requests

1. Click on a PR to view details
2. View tabs:
   - **Description**: PR description and add comments
   - **Files**: List of changed files
   - **Comments**: All comments on the PR
   - **Reviews**: Code review status
3. Actions:
   - **Merge**: Merge the PR (if open)
   - **Close**: Close the PR (if open)
   - **Add Comment**: Leave a comment

### Using Command-Line Tools

#### List Pull Requests

```bash
# List open PRs
node scripts/github-pr-utils.js list

# List closed PRs
node scripts/github-pr-utils.js list --state=closed

# List all PRs
node scripts/github-pr-utils.js list --state=all
```

#### Create Pull Request

```bash
# Basic
node scripts/github-pr-utils.js create --title "Fix bug" --head feature-branch --base main

# With description
node scripts/github-pr-utils.js create \
  --title "Add new feature" \
  --head feature-branch \
  --base main \
  --body "This PR adds a new feature that does X, Y, and Z."

# Create as draft
node scripts/github-pr-utils.js create --title "WIP" --head feature-branch --base main --draft
```

#### Merge Pull Request

```bash
# Merge PR #123
node scripts/github-pr-utils.js merge 123

# Merge with squash
node scripts/github-pr-utils.js merge 123 --method=squash

# Merge with rebase
node scripts/github-pr-utils.js merge 123 --method=rebase
```

#### Close Pull Request

```bash
node scripts/github-pr-utils.js close 123
```

#### Get PR Information

```bash
node scripts/github-pr-utils.js info 123
```

#### Quick PR Creation (Bash Script)

```bash
# Make script executable
chmod +x scripts/create-pr.sh

# Create PR from current branch
./scripts/create-pr.sh "Fix bug" . main

# Create PR from specific branch
./scripts/create-pr.sh "Add feature" feature-branch main
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_GITHUB_TOKEN` | GitHub token for frontend | - |
| `GITHUB_TOKEN` | GitHub token for CLI scripts | - |
| `GITHUB_OWNER` | Repository owner | `NDM0313` |
| `GITHUB_REPO` | Repository name | `NEWPOSV3` |

### Customizing Repository

To use with a different repository, update the GitHub service:

```typescript
import { GitHubService } from './services/githubService';

const githubService = new GitHubService('your-owner', 'your-repo');
```

Or set environment variables:

```env
GITHUB_OWNER=your-owner
GITHUB_REPO=your-repo
```

## 📁 File Structure

```
src/app/
├── components/
│   └── github/
│       ├── GitHubPullRequestsPage.tsx    # Main page component
│       ├── PullRequestList.tsx              # List view
│       ├── PullRequestDetail.tsx          # Detail view
│       └── CreatePullRequestDialog.tsx    # Create dialog
├── services/
│   └── githubService.ts                  # GitHub API service
└── context/
    └── NavigationContext.tsx             # Updated with 'github-prs' view

scripts/
├── github-pr-utils.js                    # Node.js CLI utilities
└── create-pr.sh                          # Bash quick PR script
```

## 🔐 Security Notes

1. **Token Storage**: 
   - UI tokens are stored in `localStorage` (browser only)
   - CLI tokens should be in `.env.local` (gitignored)
   - Never commit tokens to version control

2. **Token Permissions**:
   - Use minimal required scopes (`repo` for private repos)
   - Rotate tokens regularly
   - Revoke tokens if compromised

3. **Environment Files**:
   - `.env.local` is gitignored by default
   - Never commit `.env` files with tokens

## 🐛 Troubleshooting

### "GitHub API error: 401"

- **Cause**: Invalid or missing token
- **Solution**: 
  1. Verify token is correct
  2. Check token hasn't expired
  3. Ensure token has `repo` scope

### "GitHub API error: 403"

- **Cause**: Insufficient permissions
- **Solution**: 
  1. Check token has `repo` scope
  2. Verify repository access

### "Failed to load branches"

- **Cause**: Network issue or invalid repository
- **Solution**:
  1. Check internet connection
  2. Verify repository name and owner
  3. Check token has access to repository

### CLI Script Not Working

- **Cause**: Missing dependencies or environment variables
- **Solution**:
  1. Install dependencies: `npm install @octokit/rest dotenv`
  2. Set `GITHUB_TOKEN` in `.env.local`
  3. Check Node.js version (requires v18+)

## 🎯 Best Practices

1. **PR Titles**: Use clear, descriptive titles
   - ✅ Good: "Fix login authentication bug"
   - ❌ Bad: "Fix"

2. **PR Descriptions**: Include:
   - What changed
   - Why it changed
   - How to test
   - Screenshots (if UI changes)

3. **Branch Naming**: Use descriptive branch names
   - ✅ Good: `feature/add-user-authentication`
   - ❌ Bad: `fix1`

4. **Draft PRs**: Use draft PRs for work-in-progress
   - Prevents accidental merges
   - Signals work is not ready

5. **Review Process**: 
   - Request reviews from team members
   - Address review comments
   - Merge only after approval

## 🔄 Integration with Git Workflow

### Typical Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "Add new feature"

# 3. Push branch
git push origin feature/new-feature

# 4. Create PR (using UI or CLI)
# Option A: Use UI in application
# Option B: Use CLI
node scripts/github-pr-utils.js create \
  --title "Add new feature" \
  --head feature/new-feature \
  --base main

# 5. Review and merge in UI or CLI
node scripts/github-pr-utils.js merge <pr-number>
```

## 📚 API Reference

### GitHubService Methods

```typescript
// Get all pull requests
getPullRequests(params?: {
  state?: 'open' | 'closed' | 'all';
  head?: string;
  base?: string;
  sort?: 'created' | 'updated' | 'popularity';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}): Promise<GitHubPullRequest[]>

// Get single PR
getPullRequest(prNumber: number): Promise<GitHubPullRequest>

// Create PR
createPullRequest(params: CreatePullRequestParams): Promise<GitHubPullRequest>

// Update PR
updatePullRequest(prNumber: number, updates: {...}): Promise<GitHubPullRequest>

// Merge PR
mergePullRequest(prNumber: number, options?: {...}): Promise<{merged: boolean}>

// Get comments
getPullRequestComments(prNumber: number): Promise<PullRequestComment[]>

// Add comment
addPullRequestComment(prNumber: number, body: string): Promise<PullRequestComment>

// Get files
getPullRequestFiles(prNumber: number): Promise<File[]>
```

## 🆘 Support

For issues or questions:

1. Check this documentation
2. Review GitHub API documentation: https://docs.github.com/en/rest
3. Check application console for errors
4. Verify token permissions and validity

## 📝 Changelog

### Version 1.0.0 (Initial Release)

- ✅ Complete UI for PR management
- ✅ GitHub API service integration
- ✅ Command-line utilities
- ✅ Authentication system
- ✅ Comments and reviews support
- ✅ File changes display
- ✅ Merge and close functionality

---

**Happy PR Managing! 🚀**
