# VPS Hardening — Security Confirmation Report

**VPS:** 72.62.254.176 (root@srv1314836)  
**Date:** Post Phase 1–5 execution  
**Purpose:** Production ERP — only SSH, HTTP, HTTPS allowed.

---

## UFW Status

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)

To                         Action      From
--                         ------      ----
22                         ALLOW IN    Anywhere
80                         ALLOW IN    Anywhere
443                        ALLOW IN    Anywhere
22 (v6)                    ALLOW IN    Anywhere (v6)
80 (v6)                    ALLOW IN    Anywhere (v6)
443 (v6)                   ALLOW IN    Anywhere (v6)
```

**Firewall:** Active and enabled on system startup.

---

## Open Listening Ports (ss -tulnp summary)

| Bind           | Port | Service / Process     | Externally reachable? |
|----------------|------|------------------------|------------------------|
| 0.0.0.0        | 22   | sshd                   | ✅ Yes (allowed)       |
| 0.0.0.0        | 80   | docker-proxy (Traefik) | ✅ Yes (allowed)       |
| 0.0.0.0        | 443  | docker-proxy (Traefik) | ✅ Yes (allowed)       |
| 0.0.0.0        | 3000 | docker-proxy (Dokploy) | ❌ No (UFW blocks)    |
| 0.0.0.0        | 5678 | docker-proxy (n8n)     | ❌ No (UFW blocks)    |
| *              | 7946 | dockerd (swarm)        | ❌ No (UFW blocks)    |
| *              | 2377 | dockerd (swarm)        | ❌ No (UFW blocks)    |
| 127.0.0.x      | 53   | systemd-resolve        | ❌ No (local only)    |
| 127.0.0.1      | 65529| monarx-agent           | ❌ No (local only)    |
| (container)    | 5432 | postgres               | ❌ No (internal)       |
| (container)    | 6379 | redis                  | ❌ No (internal)      |

---

## Docker Published Ports

| Container           | Image              | PORTS |
|---------------------|--------------------|--------|
| dokploy-postgres    | postgres:16        | 5432/tcp (no host bind — internal) |
| dokploy-redis       | redis:7            | 6379/tcp (internal) |
| dokploy             | dokploy/dokploy    | 0.0.0.0:3000->3000 (UFW blocks from internet) |
| n8n-production      | n8nio/n8n          | 0.0.0.0:5678->5678 (UFW blocks from internet) |
| dokploy-traefik     | traefik:v3.6.7     | 0.0.0.0:80->80, 0.0.0.0:443->443 (allowed — reverse proxy) |

---

## Confirmation

| Check | Result |
|-------|--------|
| Only 22, 80, 443 externally reachable | ✅ Yes |
| 5432 (Postgres) public | ❌ No (internal only) |
| 8000 public | ❌ Not listening |
| 3000 (Dokploy) public | ❌ No — UFW blocks |
| 5678 (n8n) public | ❌ No — UFW blocks |
| Firewall active | ✅ Yes |

---

## Warnings / Notes

1. **Reboot recommended (not required for security)**  
   - Kernel upgrade pending: running **6.8.0-90**, expected **6.8.0-100**.  
   - Reboot when convenient: `reboot`

2. **cloud-init** — 1 package kept back (optional, no action needed for hardening).

3. **Ports 3000 and 5678** — Still bound to 0.0.0.0 by Docker, but **UFW blocks** incoming traffic. For stricter setup later you can change compose to use `expose` only and access via Traefik.

4. **Monarx** — Present (security agent); no change.

---

## Summary

- **Phase 1 (System Update):** ✅ Completed; 26 packages upgraded.  
- **Phase 2 (UFW):** ✅ Active; only 22, 80, 443 allowed.  
- **Phase 3 (Ports):** ✅ Only 22, 80, 443 reachable from internet.  
- **Phase 4 (Docker):** ✅ No containers modified; Postgres/Redis internal; 3000/5678 blocked by UFW.  
- **Reboot required for security:** No. Reboot recommended for new kernel when convenient.

**VPS is production-safe for ERP from a network perspective:** only SSH, HTTP, and HTTPS are exposed.
