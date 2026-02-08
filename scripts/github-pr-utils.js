#!/usr/bin/env node

/**
 * GitHub Pull Request Utility Scripts
 * 
 * This script provides command-line utilities for managing GitHub pull requests
 * 
 * Usage:
 *   node scripts/github-pr-utils.js list [--state=open|closed|all]
 *   node scripts/github-pr-utils.js create --title "PR Title" --head branch-name --base main
 *   node scripts/github-pr-utils.js merge <pr-number>
 *   node scripts/github-pr-utils.js close <pr-number>
 *   node scripts/github-pr-utils.js info <pr-number>
 */

import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'NDM0313';
const GITHUB_REPO = process.env.GITHUB_REPO || 'NEWPOSV3';

if (!GITHUB_TOKEN) {
  console.error('❌ Error: GITHUB_TOKEN environment variable is required');
  console.error('   Set it in .env.local or .env file:');
  console.error('   GITHUB_TOKEN=ghp_your_token_here');
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

async function listPRs(state = 'open') {
  try {
    console.log(`\n📋 Fetching ${state} pull requests...\n`);
    
    const { data: prs } = await octokit.pulls.list({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      state: state,
      sort: 'updated',
      direction: 'desc',
      per_page: 50,
    });

    if (prs.length === 0) {
      console.log(`   No ${state} pull requests found.\n`);
      return;
    }

    prs.forEach(pr => {
      const status = pr.merged ? '✅ Merged' : pr.state === 'open' ? '🟢 Open' : '🔴 Closed';
      const branch = `${pr.head.ref} → ${pr.base.ref}`;
      const updated = new Date(pr.updated_at).toLocaleDateString();
      
      console.log(`   ${status} #${pr.number}: ${pr.title}`);
      console.log(`      ${branch} | Updated: ${updated}`);
      console.log(`      ${pr.html_url}\n`);
    });

    console.log(`   Total: ${prs.length} pull request(s)\n`);
  } catch (error) {
    console.error('❌ Error fetching pull requests:', error.message);
    process.exit(1);
  }
}

async function createPR(title, head, base, body = '', draft = false) {
  try {
    console.log(`\n🚀 Creating pull request...\n`);
    console.log(`   Title: ${title}`);
    console.log(`   Head:  ${head}`);
    console.log(`   Base:  ${base}\n`);

    const { data: pr } = await octokit.pulls.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      title,
      head,
      base,
      body: body || `Pull request from ${head} to ${base}`,
      draft,
    });

    console.log(`   ✅ Pull request created successfully!`);
    console.log(`   📝 PR #${pr.number}: ${pr.title}`);
    console.log(`   🔗 ${pr.html_url}\n`);
  } catch (error) {
    console.error('❌ Error creating pull request:', error.message);
    if (error.response) {
      console.error('   Details:', error.response.data);
    }
    process.exit(1);
  }
}

async function mergePR(prNumber, mergeMethod = 'merge') {
  try {
    console.log(`\n🔀 Merging pull request #${prNumber}...\n`);

    const { data: result } = await octokit.pulls.merge({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: prNumber,
      merge_method: mergeMethod,
    });

    if (result.merged) {
      console.log(`   ✅ Pull request #${prNumber} merged successfully!`);
      console.log(`   🔗 ${result.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/pull/${prNumber}`}\n`);
    } else {
      console.log(`   ⚠️  Merge result: ${result.message}\n`);
    }
  } catch (error) {
    console.error('❌ Error merging pull request:', error.message);
    if (error.response) {
      console.error('   Details:', error.response.data);
    }
    process.exit(1);
  }
}

async function closePR(prNumber) {
  try {
    console.log(`\n🔴 Closing pull request #${prNumber}...\n`);

    await octokit.pulls.update({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: prNumber,
      state: 'closed',
    });

    console.log(`   ✅ Pull request #${prNumber} closed successfully!\n`);
  } catch (error) {
    console.error('❌ Error closing pull request:', error.message);
    process.exit(1);
  }
}

async function getPRInfo(prNumber) {
  try {
    console.log(`\n📊 Fetching pull request #${prNumber}...\n`);

    const { data: pr } = await octokit.pulls.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: prNumber,
    });

    const status = pr.merged ? '✅ Merged' : pr.state === 'open' ? '🟢 Open' : '🔴 Closed';
    
    console.log(`   ${status} #${pr.number}: ${pr.title}`);
    console.log(`   Author: ${pr.user.login}`);
    console.log(`   Branch: ${pr.head.ref} → ${pr.base.ref}`);
    console.log(`   Created: ${new Date(pr.created_at).toLocaleString()}`);
    console.log(`   Updated: ${new Date(pr.updated_at).toLocaleString()}`);
    if (pr.merged_at) {
      console.log(`   Merged: ${new Date(pr.merged_at).toLocaleString()}`);
    }
    console.log(`   Files: ${pr.changed_files} changed (+${pr.additions} -${pr.deletions})`);
    console.log(`   Comments: ${pr.comments}`);
    console.log(`   Reviews: ${pr.review_comments}`);
    console.log(`   Commits: ${pr.commits}`);
    console.log(`   URL: ${pr.html_url}\n`);

    if (pr.body) {
      console.log(`   Description:\n   ${pr.body.split('\n').join('\n   ')}\n`);
    }
  } catch (error) {
    console.error('❌ Error fetching pull request:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'list':
    const state = process.argv.find(arg => arg.startsWith('--state='))?.split('=')[1] || 'open';
    listPRs(state);
    break;

  case 'create':
    const title = process.argv.find(arg => arg.startsWith('--title='))?.split('=')[1];
    const head = process.argv.find(arg => arg.startsWith('--head='))?.split('=')[1];
    const base = process.argv.find(arg => arg.startsWith('--base='))?.split('=')[1] || 'main';
    const body = process.argv.find(arg => arg.startsWith('--body='))?.split('=')[1] || '';
    const draft = process.argv.includes('--draft');

    if (!title || !head) {
      console.error('❌ Error: --title and --head are required');
      console.error('   Usage: node scripts/github-pr-utils.js create --title "Title" --head branch-name [--base=main] [--body="Description"] [--draft]');
      process.exit(1);
    }

    createPR(title, head, base, body, draft);
    break;

  case 'merge':
    const prNumber = parseInt(process.argv[3]);
    const mergeMethod = process.argv.find(arg => arg.startsWith('--method='))?.split('=')[1] || 'merge';

    if (!prNumber || isNaN(prNumber)) {
      console.error('❌ Error: PR number is required');
      console.error('   Usage: node scripts/github-pr-utils.js merge <pr-number> [--method=merge|squash|rebase]');
      process.exit(1);
    }

    mergePR(prNumber, mergeMethod);
    break;

  case 'close':
    const closePRNumber = parseInt(process.argv[3]);

    if (!closePRNumber || isNaN(closePRNumber)) {
      console.error('❌ Error: PR number is required');
      console.error('   Usage: node scripts/github-pr-utils.js close <pr-number>');
      process.exit(1);
    }

    closePR(closePRNumber);
    break;

  case 'info':
    const infoPRNumber = parseInt(process.argv[3]);

    if (!infoPRNumber || isNaN(infoPRNumber)) {
      console.error('❌ Error: PR number is required');
      console.error('   Usage: node scripts/github-pr-utils.js info <pr-number>');
      process.exit(1);
    }

    getPRInfo(infoPRNumber);
    break;

  default:
    console.log(`
GitHub Pull Request Utility Scripts

Usage:
  node scripts/github-pr-utils.js <command> [options]

Commands:
  list [--state=open|closed|all]     List pull requests
  create [options]                    Create a new pull request
  merge <pr-number> [--method=...]    Merge a pull request
  close <pr-number>                   Close a pull request
  info <pr-number>                    Get pull request details

Examples:
  node scripts/github-pr-utils.js list --state=open
  node scripts/github-pr-utils.js create --title "Fix bug" --head feature-branch --base main
  node scripts/github-pr-utils.js merge 123
  node scripts/github-pr-utils.js close 123
  node scripts/github-pr-utils.js info 123

Environment Variables:
  GITHUB_TOKEN    - GitHub Personal Access Token (required)
  GITHUB_OWNER    - Repository owner (default: NDM0313)
  GITHUB_REPO     - Repository name (default: NEWPOSV3)
`);
    process.exit(1);
}
