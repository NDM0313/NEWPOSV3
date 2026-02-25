# Web par login page localhost jaisa kaise karein

Agar **localhost:5174** par 4 quick-login buttons (Main, Info, Admin, Demo) aur "auto-fills and signs in" dikh raha hai, lekin **https://erp.dincouture.pk/m/** par purana page (3 buttons, "fills form and signs in") dikh raha ho, to web **purana build** serve kar raha hai.

## 1. VPS par naya build chalao

SSH se:

```bash
cd ~/NEWPOSV3
git pull origin main
bash deploy/deploy.sh
```

Agar full deploy fail ho (e.g. studio-injector TLS timeout), sirf ERP rebuild karo:

```bash
cd ~/NEWPOSV3
git pull origin main
bash deploy/vps-build-erp-only.sh
```

## 2. Browser cache hatao

Deploy ke baad bhi purana page dikhe to:

- **Hard refresh:** `Ctrl+Shift+R` (Windows/Linux) ya `Cmd+Shift+R` (Mac)
- Ya **Incognito/Private** window mein https://erp.dincouture.pk/m/ kholo

Iske baad web par bhi wahi login page dikhna chahiye jo localhost par hai (4 buttons, Info, "auto-fills and signs in").
