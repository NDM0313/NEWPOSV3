# VPS SSH – dincouture-vps

Sab SSH connections is host se apply hoti hain.

## Config (already set)

- **Host:** `dincouture-vps`
- **HostName:** 72.62.254.176
- **User:** root
- **IdentityFile:** `~/.ssh/id_ed25519` (Windows: `C:\Users\<you>\.ssh\id_ed25519`)
- **ServerAliveInterval:** 30, **ServerAliveCountMax:** 3

Template: `docs/ssh-config-dincouture-vps.example`

## Commands (PC se – SSH se VPS par)

- Connect: `ssh dincouture-vps`
- Deploy ERP: `.\scripts\deploy-via-ssh.ps1` (PowerShell) ya `bash scripts/deploy-via-ssh.sh`
- Supabase auth fix: `ssh dincouture-vps "cd /root/NEWPOSV3 && bash scripts/vps-supabase-fix-fetch.sh"`

## Agar pehle se VPS par ho (root@srv...)

- **Deploy-via-ssh mat chalao** – woh script **sirf Windows PC** se chalana hai (PC → SSH → VPS).
- **dincouture-vps** host VPS par resolve nahi hota – ye sirf aapke PC ke `~/.ssh/config` mein hai.
- Seedha ye chalao:
  - Deploy: `cd /root/NEWPOSV3 && bash scripts/deploy-erp-vps.sh`
  - Supabase fix: `cd /root/NEWPOSV3 && bash scripts/vps-supabase-fix-fetch.sh`

Repo ke scripts / docs mein jahan bhi **PC se** VPS par command chalana ho, use `ssh dincouture-vps '...'` se run karein.
