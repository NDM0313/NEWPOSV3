# Full Auto Git + VPS Deploy Workflow

## Overview

| Step | Action |
|------|--------|
| 1 | Mac: Push to GitHub |
| 2 | VPS: Auto pull + build + restart |
| 3 | Windows: `git pull` only |

---

## Quick Commands

### Mac – One Command (Push + Deploy)

```bash
cd /path/to/NEWPOSV3
chmod +x scripts/git-push-and-deploy.sh
./scripts/git-push-and-deploy.sh "ERP: Cancel system + numbering updates"
```

Or with auto message:
```bash
./scripts/git-push-and-deploy.sh
```

### Mac – Manual Steps

```bash
git add .
git commit -m "ERP: your message"
git push origin before-mobile-replace
ssh dincouture-vps "cd /root/NEWPOSV3 && BRANCH=before-mobile-replace bash scripts/deploy-erp-vps.sh"
```

### Windows – Sync Only

```bash
git pull origin before-mobile-replace
```

---

## VPS Setup (One-Time)

1. **Copy deploy script to VPS**

```bash
scp deploy/VPS-deploy.sh dincouture-vps:/root/NEWPOSV3/deploy.sh
ssh dincouture-vps "chmod +x /root/NEWPOSV3/deploy.sh"
```

2. **Manual deploy from VPS**

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy.sh"
```

---

## Optional: Auto-Push on Commit

```bash
bash scripts/install-post-commit-push.sh
```

After this, every `git commit` will auto-push. To disable: `rm .git/hooks/post-commit`

---

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| SSH_HOST | dincouture-vps | SSH host for VPS |
| VPS_PROJECT | /root/NEWPOSV3 | Project path on VPS |
| BRANCH | before-mobile-replace | Git branch |

---

## Rules

- **No auto-resolve** on git conflicts – fix manually
- **Build fail** – script logs error and exits
- **VPS unreachable** – 3 retries with 10s delay

---

## Verification After Deploy

1. Site: https://erp.dincouture.pk
2. Supabase: Login works
3. API: No 500 errors in console
