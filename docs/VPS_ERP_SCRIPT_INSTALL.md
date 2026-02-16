# VPS par erp-traefik-register.sh kaise chalayein

Script **aapke PC** par hai: `scripts/erp-traefik-register.sh`.  
Isko pehle **VPS par copy** karna hoga, phir run karo.

---

## Option 1: GitHub se direct (agar code push ho chuka ho)

VPS par SSH karke:

```bash
cd /root
wget -q "https://raw.githubusercontent.com/NDM0313/NEWPOSV3/before-mobile-replace/scripts/erp-traefik-register.sh" -O erp-traefik-register.sh
chmod +x erp-traefik-register.sh
bash erp-traefik-register.sh
```

Agar branch alag ho to URL mein branch name change karo.

---

## Option 2: Apne PC se SCP se copy karo

**Windows (PowerShell)** — PC par project folder se:

```powershell
scp "c:\Users\ndm31\dev\Corusr\NEW POSV3\scripts\erp-traefik-register.sh" root@72.62.254.176:/root/
```

Phir VPS par:

```bash
chmod +x /root/erp-traefik-register.sh
bash /root/erp-traefik-register.sh
```

---

## Option 3: Script content paste karke file banao

1. VPS par: `nano /root/erp-traefik-register.sh`
2. Apne PC se `scripts/erp-traefik-register.sh` ka **pura content** copy karo.
3. SSH terminal mein paste karo (right-click ya Shift+Insert).
4. Ctrl+O, Enter, Ctrl+X se save karo.
5. Chalao:

```bash
chmod +x /root/erp-traefik-register.sh
bash /root/erp-traefik-register.sh
```

---

## Note

- `cmd` aur Windows path (`c:\Users\...`) **VPS (Linux) par kaam nahi karte.** Script sirf VPS par chalana hai, isliye pehle script VPS par copy karo (upar mein se koi bhi option use karo).
