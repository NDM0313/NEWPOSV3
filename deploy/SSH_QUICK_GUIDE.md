# VPS SSH Quick Guide

## Connection Details

| Field | Value |
|------|-------|
| **Host** | 72.62.254.176 |
| **User** | root |
| **Port** | 22 |

## SSH Command

```bash
ssh root@72.62.254.176 -p 22
```

## Cursor Remote-SSH

1. **Command Palette** (Cmd+Shift+P) → search **"Remote-SSH: Connect to Host…"**
2. **"Add New SSH Host"** → paste:
   ```
   ssh root@72.62.254.176 -p 22
   ```
3. **Remote Explorer** → select `root@72.62.254.176` → Connect

## Run Commands on VPS

```bash
# Single command
ssh root@72.62.254.176 -p 22 "docker ps"

# Script
ssh root@72.62.254.176 -p 22 "bash -s" < deploy/production-ssl-erp-fix.sh
```
