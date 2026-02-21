#!/bin/bash
# Swap Memory Create - Agar Supabase installation RAM ki wajah se fail ho
# Run on VPS: bash swap-create.sh

set -e
echo "=== Swap Memory Create ==="

if swapon --show | grep -q swapfile2; then
  echo "Swap already exists (swapfile2)"
  free -m
  exit 0
fi

echo "Creating 4GB swap file..."
sudo fallocate -l 4G /swapfile2 2>/dev/null || sudo dd if=/dev/zero of=/swapfile2 bs=1M count=4096
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2

if ! grep -q swapfile2 /etc/fstab; then
  echo '/swapfile2 none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo ""
echo "=== Done. Current memory ==="
free -m
