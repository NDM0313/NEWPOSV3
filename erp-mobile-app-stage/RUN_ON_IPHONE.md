# iPhone par Mobile App chalana

Teen tareeqe – jo bhi kaam kare use karo.

---

## Method 1: localtunnel (no signup – WiFi ki zaroorat nahi)

iPhone aur Mac **alag networks** pe bhi chalega. Koi account nahi chahiye.

### Step 1: Dev server start karo
```bash
cd erp-mobile-app
npm run dev
```

### Step 2: Naya terminal – tunnel
```bash
npx localtunnel --port 5174
```

Output: `your url is: https://xyz-abc-123.loca.lt`

### Step 3: iPhone par
Safari mein woh URL open karo.

**Note:** Pehli baar "Click to Continue" / "Submit" pe tap karna padega (IP verify).

---

## Method 2: localhost.run (no install – sirf SSH)

Mac pe SSH hai to koi install nahi. Naya terminal:

```bash
cd erp-mobile-app && npm run dev
```

Phir **alag terminal**:
```bash
ssh -R 80:localhost:5174 nokey@localhost.run
```

Output mein URL aayega – iPhone Safari mein open karo.

---

## Method 3: Same WiFi (Mac IP se)

Mac aur iPhone **same WiFi** pe hon.

### Step 1: Mac ka IP
```bash
ipconfig getifaddr en0
```
(agar blank aaye to `en1` try karo)

### Step 2: Dev server
```bash
cd erp-mobile-app
npm run dev:mobile
```

Output mein `Network: http://192.168.x.x:5174/` dikhega.

### Step 3: iPhone Safari
```
http://192.168.x.x:5174
```
(apna IP use karo)

### Agar load nahi ho raha
- **Firewall:** System Settings → Network → Firewall → Options → Allow incoming for "Node" / port 5174
- **WiFi isolation:** Kuch routers "AP isolation" on karte hain – devices ek doosre se connect nahi kar sakte. Router settings check karo.
- **IP change:** `ipconfig getifaddr en0` dobara chalao – DHCP se IP badal sakta hai.

---

## Method 4: Capacitor iOS (native app – Mac + Xcode)

Agar Mac pe Xcode hai:
```bash
cd erp-mobile-app
npm run cap:sync
npm run cap:ios
```
Xcode → iPhone select karo (USB connect) → Run → App iPhone pe install ho jayegi.

---

## Add to Home Screen (PWA)

Koi bhi method se app open hone ke baad:
Safari → Share → **Add to Home Screen** → Home screen pe icon add ho jayega, app jaisa feel.

---

## Quick reference

| Method       | WiFi same? | Signup? |
|-------------|------------|---------|
| localtunnel | Nahi       | Nahi    |
| localhost.run | Nahi    | Nahi    |
| Same WiFi   | Haan       | Nahi    |
| Capacitor   | Nahi       | Nahi (Xcode chahiye) |

**ngrok** ab signup + authtoken maangta hai – isliye localtunnel prefer karo.
