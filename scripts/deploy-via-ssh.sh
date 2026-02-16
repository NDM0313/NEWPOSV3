#!/usr/bin/env bash
# Run from your PC: SSH to VPS and run deploy. Needs Host dincouture-vps in ~/.ssh/config.
# Usage: bash scripts/deploy-via-ssh.sh

SSH_HOST="${SSH_HOST:-dincouture-vps}"
CMD="cd /root/NEWPOSV3 && git fetch origin && git reset --hard origin/before-mobile-replace && bash scripts/deploy-erp-vps.sh"
ssh -o ConnectTimeout=15 "$SSH_HOST" "$CMD"
