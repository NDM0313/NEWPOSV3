# Production T0 package (DO NOT EXECUTE)

**Status:** package only — awaiting owner approval.  
**Placeholder:** `PRODUCTION_T0 = OWNER_APPROVAL_REQUIRED`  
Do not invent a cutover time.

**Capability deploy SHA (product):** `356819d0759948f1583c3b9f22e9dded4d9f2529`  
**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`

This package is **not** cutover authorization. Capability deployment does **not** authorize T0.

---

## Owner approval contract (required later)

Future approval must **explicitly** name:

1. Actual production T0 execution
2. DHL local `SUP-ZHD-0007` supplier → courier
3. KIRAN `SUP-ZHD-0036` supplier → worker
4. SHAHMIM `SUP-ZHD-0046` supplier → worker
5. Creation of their prospective role leaves (203x / WA / WP)

Must **not** imply:

- historical AP reclassification
- Strategy B
- Ibrahim / ID LACE work
- supplier dual-account cleanup reopen

---

## Fresh production identifiers (post-capability)

| Party | Code | Contact UUID | Current type | Target type |
|-------|------|--------------|--------------|-------------|
| DHL local | `SUP-ZHD-0007` | `6ce5bed0-bd0a-495d-8841-19f90be6188c` | supplier | courier |
| KIRAN | `SUP-ZHD-0036` | `797ca8bb-5491-4827-8d6e-c7971d20a022` | supplier | worker |
| SHAHMIM | `SUP-ZHD-0046` | `f902a1f8-cc8a-4508-8c47-beb1850da1ed` | supplier | worker |

**Do not use staging-generated account IDs** (`203164`, staging WA/WP UUIDs). Ensure leaves fresh on production at T0.

DHL PK control leaf (must remain untouched): account code `2030162`, linked_contact `4505905b-b3e0-4ec2-8fc7-bd79464b0506`.

Historical AP freeze fingerprint: `e2d8dbaf79042b661d354a95d1980d3e`  
(DHL 48 / KIRAN 68 / SHAHMIM 86 lines; nets 4.7M / 2.25M / 5.0M).

---

## Per-party atomic design

Independent for each party:

`PRECHECK` → `TYPE_FLIP` → `LEAF_ENSURE` → `VERIFY` → `ENABLE`

| Step | Meaning |
|------|---------|
| PRECHECK | Lock party; no in-flight relevant posting |
| TYPE_FLIP | supplier → courier/worker |
| LEAF_ENSURE | Create role leaf(s) via ensure RPCs |
| VERIFY | Linkage (`linked_contact_id` / `contact_id`); DHL ≠ `2030162` |
| ENABLE | Release for new role transactions |

If leaf ensure fails after type flip and **before** first role transaction: revert type if safe.  
If any role transaction already exists: **do not** blindly revert → `POST_FIRST_POST_INCIDENT` for that party only.

Do not require one giant three-party transaction unless architecture forces it.

---

### DHL local (`SUP-ZHD-0007`)

1. Lock/precheck party  
2. Ensure no in-flight relevant posting  
3. supplier → courier  
4. Ensure DHL-local 203x (production-generated code)  
5. Confirm account ≠ DHL PK `2030162`  
6. Verify contact + linked_contact linkage  
7. Release for new courier transactions  

Historical AP remains frozen on existing AP-*.

### KIRAN (`SUP-ZHD-0036`)

1. supplier → worker  
2. Ensure WA  
3. Ensure WP  
4. Validate linkage  
5. Release worker workflow  

### SHAHMIM (`SUP-ZHD-0046`)

Same as KIRAN.

No historical AP reclass.
