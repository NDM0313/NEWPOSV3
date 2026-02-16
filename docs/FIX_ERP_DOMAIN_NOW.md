# erp.dincouture.pk — Fix DNS / Use App Today

**Problem:** Browser shows "Can't reach this page" / **DNS_PROBE_FINISHED_NXDOMAIN** — domain doesn’t resolve.

---

## Use the app RIGHT NOW (workaround, 2 min)

Until DNS is fixed, you can make **your PC** resolve `erp.dincouture.pk` yourself:

### Windows

1. **Open Notepad as Administrator**  
   (Right‑click Notepad → Run as administrator.)

2. **Open the hosts file:**  
   `File → Open` → go to:
   ```
   C:\Windows\System32\drivers\etc
   ```
   File type = **All Files**, select **hosts**, open.

3. **Add this line at the end** (then Save):
   ```
   72.62.254.176 erp.dincouture.pk
   ```

4. **Save and close.**  
   Run in PowerShell (Admin): `ipconfig /flushdns`  
   Then open: **https://erp.dincouture.pk** in the browser.

You may see a one-time certificate warning (e.g. “Your connection is not private”); use **Advanced → Proceed to erp.dincouture.pk** if the certificate is for `erp.dincouture.pk`. After that, the app should load.

---

## Fix DNS permanently (Hostinger)

So that **everyone** (and every device) can open erp.dincouture.pk without the hosts trick:

### 1) Confirm where DNS is managed

- Log in to **Hostinger** → **Domains** → **dincouture.pk**.
- Open **DNS / Nameservers** or **Manage DNS**.
- Ensure **nameservers** for dincouture.pk are Hostinger’s (e.g. ns1.dns-parking.com / ns2.dns-parking.com or whatever Hostinger shows).  
  If the domain uses other nameservers (e.g. Cloudflare), add the A record **there** instead.

### 2) Add or fix the A record

In the same DNS zone for **dincouture.pk**:

| Type | Name / Host | Value / Points to | TTL |
|------|-------------|-------------------|-----|
| **A** | `erp`       | `72.62.254.176`   | 300 |

- **Name:** Only the subdomain: `erp` (not the full domain).
- **Value:** Exactly `72.62.254.176`.
- **Save** and wait 5–30 minutes (sometimes up to 1–2 hours).

Some panels use “Host” = `erp.dincouture.pk`; that’s also correct as long as the type is A and value is the IP above.

### 3) Verify from VPS

On the server:

```bash
cd /root/NEWPOSV3 && bash scripts/vps-dns-verify.sh
```

If it still says “[FAIL] No A record”, the record is missing or wrong at the place where dincouture.pk’s nameservers point (Hostinger or wherever they are).

### 4) Verify from your PC (after propagation)

- Run: `ipconfig /flushdns` (PowerShell as Admin).
- In browser open: **https://erp.dincouture.pk**  
  Or in CMD: `ping erp.dincouture.pk` — it should show `72.62.254.176`.

---

## Checklist

| Step | Action |
|------|--------|
| 1 | Use app now: add `72.62.254.176 erp.dincouture.pk` to `C:\Windows\System32\drivers\etc\hosts`, then `ipconfig /flushdns`, then open https://erp.dincouture.pk |
| 2 | Fix DNS: Hostinger (or current DNS) → A record `erp` → `72.62.254.176`, Save |
| 3 | Confirm nameservers for dincouture.pk point to where you added the A record |
| 4 | On VPS: `bash scripts/vps-dns-verify.sh` to confirm DNS and site |
| 5 | After propagation: from PC run `ipconfig /flushdns` and test https://erp.dincouture.pk again |

Once the A record is correct and propagated, you can remove the hosts line if you want; the domain will work without it.
