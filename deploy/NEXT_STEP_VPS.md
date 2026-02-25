# Next step: Deploy to VPS (mobile /m/ 404 fix)

## 1. Local machine – push the fix

```powershell
cd "c:\Users\ndm31\dev\Corusr\NEW POSV3"
git add deploy/vps-redeploy-erp.sh deploy/NEXT_STEP_VPS.md erp-mobile-app/scripts/rewrite-pwa-base.js
git commit -m "fix: mobile PWA asset paths /m/m/ -> /m/ (rewrite script)"
git push origin main
```

## 2. VPS – pull and redeploy

SSH into the VPS, then from the project root:

```bash
cd /root/NEWPOSV3
bash deploy/vps-redeploy-erp.sh
```

If your repo is elsewhere (e.g. `~/NEWPOSV3`):

```bash
cd ~/NEWPOSV3
bash deploy/vps-redeploy-erp.sh
```

This script will:
- `git pull origin main` (get latest, including the rewrite fix)
- Run `deploy/deploy.sh` (fetch/reset, build Docker image with fixed mobile build, restart `erp-frontend`)

## 3. Verify

- Open **https://erp.dincouture.pk** (web app)
- Open **https://erp.dincouture.pk/m/** (mobile PWA) – no more 404 for `index-*.js` / `index-*.css`

If you don’t use the script, you can do the same manually:

```bash
cd /root/NEWPOSV3
git pull origin main
bash deploy/deploy.sh
```
