# VPS SSH Access (72.62.254.176)

**Server:** srv1314836 (72.62.254.176)  
**User:** root  
**Auth:** SSH key (password prompt nahi aata)

## Key path (Windows)

```
C:\Users\ndm31\.ssh\id_ed25519
```

## Test (PowerShell)

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@72.62.254.176
```

## Cursor Remote SSH

- **Host:** 72.62.254.176  
- **User:** root  
- **Private key:** `C:\Users\ndm31\.ssh\id_ed25519`  

Ab Cursor/SSH mein password prompt nahi aana chahiye.
