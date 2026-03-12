# Device Testing Checklist

**Focus:** Barcode, POS, printing, sync. No new features; verify on real devices.

---

## Test Devices

| Device | Type | Notes |
|--------|------|--------|
| **Sunmi V2 Pro** | Android (POS) | Built-in scanner (keyboard wedge). Test barcode + POS. |
| **Android phone** | Phone | Camera barcode; POS; optional Bluetooth scanner. |
| **iPhone** | Phone | Camera barcode; POS. |
| **Tablet** | Android / iPad | Same flows; layout. |

---

## Test Matrix

### 1. Barcode

| Test | Sunmi | Android | iPhone | Tablet |
|------|-------|---------|--------|--------|
| Camera scan (Add Products / POS) | N/A (use wedge) | ✓ | ✓ | ✓ |
| Keyboard wedge (hardware scanner) | ✓ | ✓ (if BT scanner) | ✓ (if BT scanner) | ✓ |
| Dedicated “Scan barcode” field (Enter) | ✓ | ✓ | ✓ | ✓ |
| Product not found message | ✓ | ✓ | ✓ | ✓ |
| Auto-add to cart (qty 1) | ✓ | ✓ | ✓ | ✓ |

### 2. POS (Scan → Cart → Payment → Invoice)

| Test | All devices |
|------|-------------|
| Open POS, scan or tap product → cart | ✓ |
| Cart: change qty, remove item | ✓ |
| Checkout → Payment (Cash/Bank/Card) | ✓ |
| Complete sale → invoice/success screen | ✓ |
| Walk-in customer default | ✓ |

### 3. Printing

| Test | Where applicable |
|------|------------------|
| Print receipt / invoice from device | Sunmi, Android (if printer configured) |
| Print from web (erp.dincouture.pk) | Desktop / same network |

### 4. Sync

| Test | All devices |
|------|-------------|
| Online: sale created and visible on web | ✓ |
| Offline (when implemented): queue sale, go online, sync | ✓ |

---

## How to Test

1. **Build mobile:** `npm run mobile:dev` or build Capacitor app for Android/iOS.  
2. **Point to backend:** Use same Supabase/API as erp.dincouture.pk (env).  
3. **Sunmi:** Install APK; enable scanner; focus “Scan barcode” field and scan.  
4. **iPhone/Android:** Use camera for scan; or attach Bluetooth scanner (keyboard wedge mode).  
5. **Tablet:** Same as phone; check layout on large screen.

---

## Sign-Off

- [ ] Sunmi V2 Pro: barcode + POS  
- [ ] Android: barcode (camera + wedge if available) + POS  
- [ ] iPhone: barcode + POS  
- [ ] Tablet: barcode + POS  
- [ ] Printing (where supported)  
- [ ] Sync (online; offline when implemented)
