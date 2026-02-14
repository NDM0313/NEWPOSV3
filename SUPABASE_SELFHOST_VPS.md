# Supabase Self-Host on VPS — Full Stack (Post Migration)

**Final architecture:** Auth, DB, RPC, RLS, Storage sab VPS par. Supabase Cloud ki dependency nahi.

---

## 🎯 REAL EXECUTION ORDER (Bahut Important)

Sabse common mistake: **direct restore kar dena bina roles aur extensions verify kiye.**  
Isliye yeh order follow karo:

| Phase | Kya karna hai |
|-------|----------------|
| **1** | Clean Supabase stack start → extensions + auth + storage schema **verify** → phir restore |
| **2** | Cloud backup: schema-only + data-only (safe); restore order: schema → functions → data |
| **3** | Restore ke baad: RLS + policies + RPC verify (`pg_policies`, `pg_proc`) |
| **4** | Frontend switch: **new** URL + **new** anon key (old Cloud key use nahi karni) |

---

## 🎯 FINAL ARCHITECTURE

```
User Browser / Mobile App (PWA)
        ↓
VPS (Nginx / Traefik)
        ↓
Supabase Stack (Docker) — same VPS
   - PostgreSQL
   - GoTrue (Auth)
   - PostgREST (API)
   - Realtime
   - Storage
        ↓
Internal Docker Network
```

**Result:**

- ✔ Auth VPS par  
- ✔ DB VPS par  
- ✔ RPC VPS par  
- ✔ RLS VPS par  
- ✔ Storage unlimited (VPS disk)  
- ✔ No Supabase Cloud dependency  

---

## 🔐 Phase 1 – VPS Hardening (Production Security Base)

**Real execution order — bina confusion ke:**

| # | Step | Done |
|---|------|------|
| 1 | VPS login → report | ☐ |
| 2 | `ss -tulnp` → paste output / list exposed ports | ☐ |
| 3 | UFW lock (sirf jab SSH 22 confirm) | ☐ |
| 4 | Success criteria check | ☐ |
| — | **Phir Phase 2** (Clean Supabase stack) | — |

**Abhi:** ❌ Restore nahi | ❌ Migration nahi | ❌ DNS change nahi — sirf security hardening.

---

### 📋 VPS Hardening Runbook (Exact Order — Copy-Paste)

**PHASE 1 – System Update**

```bash
apt update && apt upgrade -y
```

Reboot only if required (check: `[ -f /var/run/reboot-required ] && echo "Reboot required"`).

---

**PHASE 2 – Install & Configure UFW**

```bash
apt install ufw -y
ufw default deny incoming
ufw default allow outgoing
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
ufw status verbose
```

Expected: **22, 80, 443** ALLOW; baaki deny.

---

**PHASE 3 – Verify Open Ports**

```bash
ss -tulnp
```

Confirm: 22, 80, 443 listening; 3000, 5678, 8000, 5432 **not** externally reachable (firewall blocks them).

---

**PHASE 4 – Docker Security Check**

```bash
docker ps
```

If containers publish to 0.0.0.0 — **do not** remove containers; confirm firewall blocks public access.

---

**PHASE 5 – Security Confirmation Report (Template)**

After running the above, fill:

| Item | Result |
|------|--------|
| UFW status | Paste `ufw status verbose` (or numbered) |
| Open listening ports | Paste `ss -tulnp` (or list 22, 80, 443) |
| Docker published ports | Paste `docker ps` port column (e.g. 0.0.0.0:3000->3000) |
| Only 22, 80, 443 externally reachable | Yes / No |
| Warnings detected | None / list |
| Reboot required | Yes / No |

**Do NOT:** Modify Supabase containers, restore DB, change DNS, remove Docker services, expose new ports. Security hardening only.

---

### ⚡ One-Shot Apply (SSH mein paste karo — ek baar mein sab)

VPS par login karo: `ssh root@72.62.254.176`  
Phir **poora block** copy karke terminal mein paste karo:

```bash
apt update && apt upgrade -y
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
ufw status verbose
ss -tulnp
docker ps
```

Script file (optional): `scripts/vps-hardening-apply.sh` — VPS par copy karke `bash vps-hardening-apply.sh` chala sakte ho.

---

### 🚨 Agar Netstat Mein Yeh Dikhe (Public Exposed)

- `0.0.0.0:5678` → exposed  
- `0.0.0.0:3000` → exposed  
- `0.0.0.0:80` / `443` / `22` → (80/443/22 normal for web/SSH)  
- Docker swarm: `7946`, `2377`  

Matlab abhi VPS **production-safe nahi** hai. Panic nahi — UFW se fix ho jata hai.

**Samajh lo:** Docker 3000/5678 expose kar raha hai, ye tab dangerous hai jab firewall unhe allow karta hai. **UFW sirf 22/80/443 allow karega** → 3000/5678 **automatically block** ho jayenge.

---

### STEP 1 – VPS Login

Apne local system se:

```bash
ssh root@72.62.254.176
```

Agar login ho jata hai → next step.

### STEP 2 – Check Open Ports (Sabse Important)

Run karo:

```bash
ss -tulnp
```

Ya:

```bash
netstat -tulnp
```

**Batana / screenshot:** In ports pe **0.0.0.0** dikh raha hai?

- 3000  
- 5678  
- 5432  
- 8000  
- 8080  

Agar **0.0.0.0** likha hai matlab **public exposed** hai. Output yahan paste karo (ya note karo).

### STEP 3 – Firewall Enable (Production Mode)

⚠️ **Yeh tab karo jab confirm ho ke SSH (22) open hai.**

```bash
apt update
apt install ufw -y

ufw default deny incoming
ufw default allow outgoing

ufw allow 22
ufw allow 80
ufw allow 443

ufw enable
```

Phir check:

```bash
ufw status
```

**Expected:** 22 ALLOW, 80 ALLOW, 443 ALLOW — baaki sab deny.

### STEP 4 – Docker Public Ports Check

Run karo:

```bash
docker ps
```

Agar aisa dikh raha ho:

- `0.0.0.0:3000->3000`
- `0.0.0.0:5678->5678`
- `0.0.0.0:8000->8000`
- `0.0.0.0:5432->5432`

Toh ye production ke liye **dangerous** hai.  

**Lekin:** Agar UFW sirf 22/80/443 allow karta hai toh baaki ports **automatically block** ho jayenge. Studio/API ke liye baad mein Nginx reverse proxy (80/443) use karna.

### ✅ Phase 1 Success Criteria

- ✔ Sirf **22, 80, 443** open  
- ✔ **5432** public nahi  
- ✔ **8000** public nahi  
- ✔ **3000** public nahi  
- ✔ Firewall active  

### 💡 Important

Abhi tak humne:

- Domain setup / architecture decide kiya  
- Self-host Supabase plan ready kiya  
- Firewall phase start kiya  

**Abhi restore ya migration nahi karni.**

### 🚀 Next After Phase 1

Agar firewall clean ho jata hai:

**→ Phase 2 – Clean Supabase stack start** (phir extensions verify karenge)

**Phase 1 – 100% successful.** VPS production-safe; sirf 22, 80, 443 open; 5432/8000/3000/5678/swarm blocked. Restore abhi nahi karna.

---

### 🔒 Next Level (Firewall Ke Baad — Professional Fix)

Jab UFW lock ho jaye, baad mein ye karenge:

- Docker ports **remove** karna (public bind hatao)  
- Sirf **internal expose**  
- **Nginx reverse proxy** setup (80/443 → Kong/Studio)  
- **SSL** setup  
- Supabase **internal network only**  

**Abhi:** ❌ Supabase restore nahi | ❌ Migration nahi | ❌ DNS change nahi — sirf security lock.

---

### 🧠 RAM Planning (8GB VPS)

| Component | Allocation |
|-----------|------------|
| Postgres | 1.5–2 GB |
| Supabase services | ~1 GB |
| Nginx + frontend | ~200 MB |
| Automation (n8n etc) | ~1 GB |
| System buffer | ~1 GB |
| Safe free | ~2 GB |

8GB ERP ke liye enough hai.

---

## ✅ PHASE 2 — Clean Supabase Stack Start (Restore Se Pehle)

**Phase 1 (VPS Hardening) complete.** Ab Supabase stack.

### Decision: Option A vs B

| Option | Kya karna hai |
|--------|----------------|
| **A – Direct production** | Seedha VPS par Supabase self-host stack chala dein. |
| **B – Dry Run first (Recommended)** | Temporary test stack → restore test → frontend connect test → phir final cutover. |

Professional ERP ke liye: **Dry Run first** recommend.

---

### 🎯 Next Immediate Step (VPS par run karo)

```bash
cd /root
git clone https://github.com/supabase/supabase.git
cd supabase/docker
```

**Uske baad (order mein):**

1. `.env` secure generate (copy from example, set secrets)  
2. JWT_SECRET generate (`openssl rand -base64 32`)  
3. Stack start: `docker compose up -d`  
4. Extensions verify (Studio SQL: `pg_extension`, schemata `auth` / `storage` / `public`)  

**Restore abhi nahi karna.**

---

### STEP 1 – VPS Preparation (agar abhi clone nahi kiya)

```bash
ssh root@72.62.254.176
mkdir -p /root/supabase-selfhost
cd /root/supabase-selfhost
```

(Agar upar wala `cd /root` + clone use kiya hai to `supabase/docker` directly use karo.)

---

## 🧱 STEP 2 – Supabase Official Docker Setup

```bash
git clone https://github.com/supabase/supabase.git
cd supabase/docker
```

Yahan `.env` file hogi (example se copy karo agar nahi hai).

---

## 🧱 STEP 3 – .env Configure

```bash
nano .env
```

**Secrets generate karo (ek strong secret):**

```bash
openssl rand -base64 32
```

Is output ko (ya alag-alag 32-byte secrets) use karo:

- `JWT_SECRET=`
- `ANON_KEY=` (JWT hi use hota hai; doc ke hisaab se generate — see [Supabase self-hosting docs](https://supabase.com/docs/guides/self-hosting/docker))
- `SERVICE_ROLE_KEY=`

⚠️ Inko safely save kar lena — baad mein frontend + backups ke liye chahiye.

**Note:** Official Supabase docker `.env` mein exact variable names check karo; wahi use karo.

---

## 🧱 STEP 4 – Ports

- **8000** — API (Kong gateway) — **internal** rakhna better; Nginx se proxy karo (see Security)  
- **5432** — internal only (public expose mat karo)  
- **3000** — Studio (optional; dashboard)

Production: sirf **80 + 443** public; 8000 Nginx ke peeche.

---

## 🧱 STEP 5 – Supabase Stack Start

```bash
cd /root/supabase-selfhost/supabase/docker
docker compose up -d
```

1–2 minute wait karo. Phir:

```bash
docker ps
```

Containers dikhne chahiye: `supabase-db`, `supabase-auth` (GoTrue), `supabase-rest` (PostgREST), `supabase-realtime`, `supabase-storage`, Kong, etc. (exact names repo ke hisaab se ho sakte hain).

### STEP 6 – Studio Open → Verify (Restore Se Pehle Zaroor)

Studio kholo (e.g. `http://72.62.254.176:3000` — repo mein port confirm karo). **Restore se pehle** confirm karo:

- [ ] **Extensions** installed (required wale present hain)
- [ ] **auth** schema present
- [ ] **storage** schema present

Jab yeh clean dikhe, tab hi Phase 2 (backup/restore) karo.

---

## ✅ PHASE 2 — Cloud Backup & Restore (Safe Order)

**Direct full dump + restore agar versions mismatch ho to issue de sakta hai.** Professional safe order:

### Cloud se backup (alag schema + data)

```bash
# Schema only
pg_dump -h db.PROJECT_REF.supabase.co -U postgres -d postgres --schema-only -F c -f erp_schema.dump

# Data only (schema verify ke baad)
pg_dump -h db.PROJECT_REF.supabase.co -U postgres -d postgres --data-only -F c -f erp_data.dump
```

(Password Supabase Dashboard se; PROJECT_REF apna project ref.)

### Restore order (VPS par)

1. **Schema restore**  
2. **Functions restore** (agar alag file ho)  
3. **Data restore**  

Example (container name apne hisaab se):

```bash
cat erp_schema.dump | docker exec -i supabase-db pg_restore -U postgres -d postgres -F c --no-owner --no-privileges -
# phir data
cat erp_data.dump | docker exec -i supabase-db pg_restore -U postgres -d postgres -F c --no-owner --no-privileges -
```

Agar roles/extensions errors aayein to Phase 1 dobara check karo (extensions/auth/storage schema).

---

## ✅ PHASE 3 — RLS + Policies + RPC Verification (Restore Ke Baad)

Studio → **SQL Editor** mein run karo (production migration mein yeh mandatory hai):

```sql
-- RLS policies exist?
SELECT * FROM pg_policies;
```

```sql
-- RPC functions exist (public schema)?
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
```

Check karo policies aur RPC dono present hain. Nahi to migration/RPC scripts dobara run karo.

---

## ✅ PHASE 4 — Frontend Switch

Frontend mein **new** self-hosted values use karo — **old Cloud anon key use nahi karni:**

```
VITE_SUPABASE_URL=http://your-domain-or-ip:8000
VITE_SUPABASE_ANON_KEY=<new_selfhost_anon_key>
```

Phir `npm run build` aur `dist/` VPS par upload karo.

---

---

## 🧱 STEP 9 – Frontend Serve (Nginx)

VPS par frontend folder (e.g. `/root/erp-production/frontend`) mein `dist/` ki contents rakho. Phir nginx container:

**Option A — Alag folder:**

```yaml
# e.g. /root/erp-production/docker-compose.yml
frontend:
  image: nginx:stable-alpine
  container_name: erp_frontend
  restart: always
  ports:
    - "8080:80"
  volumes:
    - ./frontend/dist:/usr/share/nginx/html:ro
```

```bash
docker compose up -d frontend
```

**Option B — Same machine par:** Nginx/Traefik host pe 80/443 point karo isi container ki taraf.

Browser: `http://72.62.254.176:8080` (ya apna domain).

---

## 🔐 Security Hardening (Professional Level)

**Port 8000 public expose mat karein.** Better architecture:

```
Domain (HTTPS)
   ↓
Nginx (SSL — 80/443 only)
   ↓
Supabase Kong (8000 internal)
```

- ✔ **PostgreSQL (5432)** — internal only  
- ✔ **Kong (8000)** — internal only; Nginx reverse proxy se hi forward karo  
- ✔ **Sirf 80 + 443** open karein; 8000 public mat karo  

**Firewall:**

```bash
ufw allow 80
ufw allow 443
ufw enable
```

- ✔ `.env` mein default passwords/secrets replace karo (official self-hosting security guide follow karo)

---

## 📦 Daily Backup (Improved — Disk Save)

Pehle `mkdir -p /root/backups` kar lena. Phir:

```bash
crontab -e
```

Add (gzip se disk save):

```cron
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres | gzip > /root/backups/db_$(date +\%F).sql.gz
```

---

## 🚀 Final Result

- ✔ Fully VPS based  
- ✔ Unlimited storage (VPS disk)  
- ✔ Same RPC, RLS, Auth — app code change nahi  
- ✔ No Supabase Cloud dependency  

---

## 🔐 JWT Secret Consistency

- **Agar existing Supabase Cloud users migrate kar rahe ho:**  
  Self-host par **JWT_SECRET same** rakho — warna existing sessions invalidate ho jayengi.

- **Agar fresh login acceptable hai:**  
  Naya secret use karo — sab users ko dubara login karna hoga.

---

## 🎯 Most Important Final Decision — Dry Run vs Cutover

| Option | Kya karna hai |
|--------|----------------|
| **A – Dry Run first** | Cloud → VPS migration **test** karo; frontend temporarily VPS point karo; flows verify karo. |
| **B – Direct cutover** | Maintenance window → Cloud backup → Restore VPS → DNS switch → Go live. |

**Professional approach:** Pehle **Dry Run** karo, sab verify ho jaye, phir **final cutover** window lo.

---

## 🔥 DRY RUN EXECUTION PLAN (Structured)

Jab document ready ho, kaam is order mein karo:

| Day | Focus | Tasks |
|-----|--------|--------|
| **Day 1** | Setup | Supabase self-host stack start → Extensions verify → auth schema verify → storage schema verify |
| **Day 2** | Migration | Schema-only restore → Function restore → Data-only restore → `pg_policies` verify → `pg_proc` verify |
| **Day 3** | Frontend (temporary) | `.env.production` VPS URL → Build → Deploy to staging domain → Test: Login, Sales, Rental, Studio, RPC, Permissions |
| **Day 4** | Validation | Console error check → Permission test (different roles) → Ledger correctness → RLS enforcement → Backup test restore |

**Agar sab green hai:** Final Cutover Window schedule karo.

---

## ✅ DAY 1 — Phase 1 Execution (Stack Verification)

**Abhi koi restore nahi karna.** Sirf yeh confirm karna hai ke self-hosted Supabase stack sahi chal raha hai.

### STEP 1 – VPS Login

```bash
ssh root@72.62.254.176
cd /root/supabase-selfhost/supabase/docker
```

### STEP 2 – Stack Start

```bash
docker compose up -d
```

Phir:

```bash
docker ps
```

**Expected containers (sab "Up" hona chahiye):**

- `supabase-db`
- `supabase-auth`
- `supabase-rest`
- `supabase-realtime`
- `supabase-storage`
- `kong`
- `studio`

Agar sab Up hai → Phase 1 pass.

### STEP 3 – Studio Open

Browser mein:

**http://YOUR_SERVER_IP:3000**

(Ya agar Nginx use kar rahe ho to uske through.)

### STEP 4 – Restore Se Pehle Verify (SQL Editor)

Studio → **SQL Editor** → run karo:

**Extensions:**

```sql
SELECT * FROM pg_extension;
```

Check: `pgcrypto`, `uuid-ossp`, `pgjwt` (agar use ho), aur Supabase-related extensions present hain.

**Schemas:**

```sql
SELECT schema_name FROM information_schema.schemata;
```

Check: **auth**, **storage**, **public** — yeh teen sahi hain.

**Agar yeh teen sahi hain → Phase 1 complete.**

---

### 🚨 IMPORTANT

**Restore karne ki jaldi mat karo.** Aksar migration yahin fail hoti hai.

---

### 🧠 Strategic Position (Phase 1 Ke Baad)

| Option | Kya karna hai |
|--------|----------------|
| **A – Continue Dry Run (Recommended)** | Day 2: Cloud backup → VPS restore (test). Day 3: Temporary frontend switch → full ERP test. |
| **B – Direct Cutover** | Not recommended without dry run. |
| **C – Hybrid** | Cloud live rakho, VPS par test karo. |

---

### 🏆 Professional Advice (ERP Level)

Aapka ERP complex hai: RPCs, RLS, multi-role, ledger, commission, rental lifecycle.  
**Isliye Dry Run mandatory hai.**

---

## 🚨 Sabse Critical Check During Dry Run

Yeh **3 cheezein fail nahi honi chahiye** — tab hi migration successful:

| Check | Kya verify karna hai |
|-------|----------------------|
| **supabase.auth login** | User login / signup / session refresh chal raha hai |
| **supabase.rpc()** | Saari required RPCs (e.g. `get_customer_ledger_rentals`, commission, payment reverse) respond kar rahe hain |
| **RLS enforcement** | User data isolation — user A ko user B ka data nahi dikhna chahiye |

Agar yeh teen sahi chal rahe hain — migration successful hai.

---

## 🏁 FINAL CUTOVER PLAN (Jab Dry Run Green Ho)

1. **Maintenance announce karo** — 30–60 min window  
2. **Final Supabase Cloud backup** lo  
3. **VPS restore** (final) — same order: schema → functions → data  
4. **DNS switch** — traffic VPS ki taraf  
5. **Monitor 48 hours** — logs, errors, RPC, auth  

---

## 🚀 Domain vs Direct IP

Aap:

1. **Direct IP** se chalana chahte ho? (e.g. `http://72.62.254.176:8080`)  
2. **Proper domain + SSL** ke saath production karna chahte ho?

**Professional ERP ke liye:** Domain + SSL strongly recommended (HTTPS, PWA, trust).

---

## ⚠ IMPORTANT WARNING

Self-hosted Supabase powerful hai, lekin:

- **SSL** configure karna hoga (production ke liye)  
- **Firewall** manage karna hoga (sirf 80/443; 8000 internal)  
- **Backups** regularly lena hoga (gzip wala cron use karo)  
- **Updates** — Supabase docker repo + [CHANGELOG](https://github.com/supabase/supabase/blob/master/docker/CHANGELOG.md) dekh kar carefully upgrade karo  

Official doc: [Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)

---

## 🧠 CTO-Level — Migration Mein Sabse Zyada Issues

Supabase migration mein commonly yeh problems aate hain; is doc ka plan inhe address karta hai:

| Issue | Plan mein kahan cover hai |
|-------|---------------------------|
| **Extensions mismatch** | Phase 1: Restore se pehle extensions verify |
| **Role ownership conflicts** | Phase 2: `--no-owner --no-privileges` + schema/data split |
| **Policy restore order** | Phase 2: Schema → Functions → Data; Phase 3: `pg_policies` verify |
| **JWT mismatch** | JWT Secret note: same = seamless users; new = fresh login |
