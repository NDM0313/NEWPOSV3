# Phase 8B — Shared Counter Usage Guide (Roman Urdu)

Yeh guide batati hai ke naya **Enterprise POS State** system kaise use karein. Is mein Supabase session **ek hi** rehti hai (Admin/Owner), aur staff switch **local PIN** se hota hai — bina logout, bina token rotation.

---

## Pehle samajh lein: do alag cheezein

| Cheez | Kya hai | Kab use hoti hai |
|-------|---------|------------------|
| **Admin session** | Email/password se login — tablet par ek hi JWT | Boot par, Permanent Sign-Out tak |
| **Counter worker** | Naam + 4-digit PIN — sirf is device par | POS lock screen, sales/expense attribution |

Device **Quick PIN** (4–6 digit, Settings) alag hai — yeh personal phone/tablet unlock ke liye hai, counter worker PIN se mix mat karein.

---

## Step 1: Admin / Owner email se login

1. Tablet par app kholein.
2. **Email + password** se sign in karein (Owner ya Admin account).
3. Branch select karein agar zaroori ho.

> **Zaroori:** Pehli dafa counter setup ke liye Admin/Owner login lazmi hai. Bina is ke sirf PIN se session nahi banti.

---

## Step 2: Settings mein workers enroll karein

Har staff jo counter use karega, us ka **alag 4-digit PIN** save karein:

1. **Settings** → **Counter & lock screen** section kholein.
2. **Counter tablet PIN** par tap karein.
3. Apna **4-digit PIN** do baar enter karein (match hona chahiye).
4. **Save** dabayein.
5. Agla banda apne account se (ya Admin us ke liye) same steps repeat kare — **har shaks ka PIN alag** ho.

**Tips:**
- Pehla worker save hone par **Shared Counter Mode** auto ON ho sakta hai.
- Enrolled list mein **Remove** se kisi user ko device se hata sakte hain.
- Agar pehle purana vault tha, app ek dafa **auto-migrate** kar sakti hai — list khali ho to dubara enroll karein.

**Optional — Quick PIN se counter PIN:**
- Settings → **Set Quick PIN** (exactly 4 digits) save karte waqt app puchegi: counter tablet PIN bhi save karein?

---

## Step 3: Shared Counter Mode ON rakhein

1. Settings → **Counter & lock screen**.
2. **Shared Counter Mode** → **On**.
3. Is se cold boot aur logout par **POS lock grid** dikhegi.

---

## Step 4: Lock screen — kaun counter par hai?

Jab lock screen aaye ("Who is using this counter?"):

1. Apna **naam** tap karein.
2. Apna **4-digit counter PIN** enter karein.
3. **Unlock** — ab aap active worker hain; sales/expense aap ke naam se record hongi.

Supabase session **change nahi** hoti — sirf local state switch hoti hai.

---

## Step 5: POS / Expense par kaam

- **POS sale** → `userId` / salesman = jo worker lock screen se select hua.
- **Expense add** → bhi active worker ke account se attribute hota hai.
- Header par **Switch user** (Users icon):
  - **Shared Counter Mode ON** → poori lock screen (Temporary Lock).
  - **Mode OFF** → PIN overlay se doosra worker select karein.

---

## Temporary Lock vs Permanent Sign-Out

| Action | Kya hota hai | Kaun kar sakta hai |
|--------|--------------|-------------------|
| **Logout / Switch user** (counter enrolled) | Lock screen — session **zinda** | Sab enrolled staff |
| **Sign out completely** | Email login dubara — JWT clear | **Sirf Admin / Owner** (lock screen footer) |

**Temporary Lock** use karein jab:
- Shift change ho, lekin tablet same Admin session par rahe.
- Koi sale beech mein chhod kar doosra banda aaye.

**Permanent Sign-Out** use karein jab:
- Tablet kisi aur shop ko dena ho.
- Poori device se sab logout karna ho.

---

## Purani device / migration

- Pehle Phase 6 vault wale users: app **migrateLegacyVaultOnce** se names copy kar sakti hai (bina refresh token).
- Agar lock screen khali ho: Settings se dubara **Counter tablet PIN** enroll karein.
- Koi database migration **nahi** — sab kuch sirf is tablet ki IndexedDB mein hai.

---

## Troubleshooting

| Masla | Hal |
|-------|-----|
| Lock screen par koi naam nahi | Settings se kam az kam 1 worker enroll karein |
| Wrong PIN | Sahi user select kiya? PIN 4 digit? Settings se reset/enroll |
| Sale galat bande ke naam se | Lock screen se sahi worker select karein, phir sale karein |
| Permanent sign-out nahi dikh raha | Sirf Admin/Owner ko footer link milti hai |
| Email login zaroori lag raha hai | Admin pehle login kare, phir workers enroll karein |

---

## Technical reference (developers)

- Registry: [`erp-mobile-app/src/lib/counterWorkerRegistry.ts`](../erp-mobile-app/src/lib/counterWorkerRegistry.ts)
- Context: [`erp-mobile-app/src/context/CounterWorkerContext.tsx`](../erp-mobile-app/src/context/CounterWorkerContext.tsx)
- Roadmap: [`docs/mobile_phase8_pos_state_rebuild.plan.md`](mobile_phase8_pos_state_rebuild.plan.md)
