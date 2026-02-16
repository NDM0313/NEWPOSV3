# VPS par script check aur run

## 1. Check karo — script sahi download hua ya 404?

VPS (SSH) par chalao:

```bash
head -5 /root/erp-traefik-register.sh
```

- **Agar pehli line `#!/bin/bash` dikhe** → script sahi hai. Seedha chalao:
  ```bash
  bash /root/erp-traefik-register.sh
  ```
- **Agar `<!DOCTYPE` ya `Not Found` dikhe** → wget ne 404 page save kar diya (script GitHub par nahi hai). Neeche Option A ya B karo.

---

## 2A. Agar 404 aaya — pehle GitHub par push karo

Apne **PC** par (project folder se):

```powershell
cd "c:\Users\ndm31\dev\Corusr\NEW POSV3"
git add scripts/erp-traefik-register.sh
git commit -m "Add erp-traefik-register script"
git push origin main
```

(agar branch `before-mobile-replace` ho to `git push origin before-mobile-replace`.)

Phir **VPS** par dobara:

```bash
cd /root && wget -q 'https://raw.githubusercontent.com/NDM0313/NEWPOSV3/main/scripts/erp-traefik-register.sh' -O erp-traefik-register.sh && chmod +x erp-traefik-register.sh && bash erp-traefik-register.sh
```

(Branch name apne hisaab se change karo.)

---

## 2B. Bina push — PC se SCP se copy karo

**PC (PowerShell)** se:

```powershell
scp "c:\Users\ndm31\dev\Corusr\NEW POSV3\scripts\erp-traefik-register.sh" root@72.62.254.176:/root/
```

**VPS** par:

```bash
chmod +x /root/erp-traefik-register.sh
bash /root/erp-traefik-register.sh
```

---

## 3. Script run hone ke baad

- Agar **compose path** na mile to script manual labels print karega — unhe Dokploy/compose mein add karo.
- Agar sab theek chale to end mein `curl -I https://erp.dincouture.pk` ka result dikhega (200 = OK).
