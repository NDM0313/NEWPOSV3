# Studio Production Lifecycle 🧵

**Din Collection ERP - Sale se Completion tak ka Safar**

---

## 🎯 Complete Workflow Overview

```
SALE → AUTO-DETECTION → PRODUCTION ORDER → 3 STAGES → COMPLETION
```

---

## 📍 Stage 1: Sale Point (The Trigger)

### **Auto-Detection System**

```typescript
When AddSaleModal saves a sale:
    ↓
Check product settings:
    requires_production: true
    ↓
AUTO-CREATE:
    ✅ Production Order (PO-XXXX)
    ✅ Job Card (JC-XXXX)
    ✅ 3 Steps:
        - Dyeing (Pending)
        - Handwork (Locked 🔒)
        - Stitching (Locked 🔒)
```

### **Branch Context (Option A Logic)**

```
Sale created at: Main Store
    ↓
branch_id: BRN-001  🔒 (System-locked)
    ↓
All production steps inherit this branch
    ↓
Cannot change branch mid-production
```

**Visual Indicator:**
```
┌──────────────────────┐
│ Branch: Main Store 🔒│  ← Lock icon shows system-locked
└──────────────────────┘
```

---

## 📊 Stage 2: Studio Dashboard (First View)

### **Status Cards Update**

Sale complete hone ke baad:

```
┌──────────────┐
│ 🎨 Dyeing    │
│      1+1     │  ← Count increases
│ Active Jobs  │
└──────────────┘
```

### **Order Card Display**

```
┌─────────────────────────────────┐
│ JC-001 | Fatima Khan | Silk 15m │
│ [HIGH] [⏰ 1d]                   │  ← Priority + Days in stage
└─────────────────────────────────┘
```

**Click karne par:**
```
Right Panel → Production Flow opens
Shows complete 3-stage breakdown
```

---

## 🎨 Stage 3: Dyeing (Dahair) - First Step

### **Assignment Flow**

```
Manager opens job card
    ↓
Selects Worker: Ali Raza
    ↓
Enters Quantity: 15m (Gazz/Meters)
    ↓
Click "Start"
    ↓
Status: pending → in-progress
started_at: Auto-set (2026-01-08 11:00 AM)
```

### **Material Tracking**

```
Input Fields:
┌────────────────┐
│ Worker: Ali ▼  │
│ Material: 15m  │  ← How much thaan given
│ Cost: Rs.5000  │  ← Dyeing fee
└────────────────┘
```

### **Visual Status**

```
Pending:
⚪ Gray circle (hollow)

In-Progress:
🟣 Purple circle (pulsing)

Completed:
🟣 Purple circle (solid)
   ✓ Completed badge
```

---

## ✨ Stage 4: Handwork - Sequential Gating

### **Gating Rule (STRICT)**

```
Dyeing Status: in-progress
    ↓
Handwork Button: 🔒 LOCKED
    ↓
User sees: "Complete Dyeing first"

Dyeing Status: completed
    ↓
Handwork Button: 🔓 UNLOCKED
    ↓
Can now assign worker
```

### **Completion Verification**

```
Before marking Dyeing complete:
    ↓
System checks:
    completed_qty === step_qty
    ↓
If NO: Show error
    "Quantity mismatch! Expected 15m, completed 12m"
    ↓
If YES: Allow completion
    ↓
Auto-update:
    completed_at: timestamp
    paymentStatus: 'pending' → 'payable'
```

### **Lock Visual**

```
Locked Stage:
┌──────────────────────┐
│ ✨ Handwork       🔒 │  ← Lock icon
│ Waiting for Dyeing   │
│ to complete...       │
└──────────────────────┘

Unlocked Stage:
┌──────────────────────┐
│ ✨ Handwork       🔓 │  ← Unlock icon
│ Ready to assign      │
│ [Assign Worker]      │
└──────────────────────┘
```

---

## ✂️ Stage 5: Stitching (Tailor) - Final Step

### **Measurements Integration**

```
Sale mein saved measurements:
    ↓
Automatically show in Tailor step:
    ┌───────────────────┐
    │ NAAP (Measurements)│
    ├───────────────────┤
    │ Length: 44        │
    │ Chest:  40        │
    │ Waist:  36        │
    │ Sleeve: 22        │
    └───────────────────┘
```

### **Worker Assignment**

```
Select Tailor: Hassan
    ↓
Auto-fill stitching fee:
    cost: Rs.7000 (from tailor profile)
    ↓
Material same as original:
    material: 15m
```

### **Gating Check**

```
Handwork Status: in-progress → LOCKED
Handwork Status: completed → UNLOCKED
```

---

## 💰 Accountability & Ledgers (Paison ka Hisab)

### **1. Salesman Commission**

```
TRIGGER: Sale finalized
    ↓
ACTION: Auto-calculate commission
    sale_amount: Rs.50,000
    commission_rate: 5%
    commission: Rs.2,500
    ↓
LEDGER ENTRY:
    Table: worker_ledgers
    worker_id: salesman_id
    type: 'credit'
    amount: Rs.2,500
    description: "Commission - SALE-2547"
    timestamp: Sale completion time
```

**Visual:**
```
Salesman Ledger:
┌─────────────────────────────────┐
│ ✅ Commission - SALE-2547       │
│ +Rs.2,500                    ↗️ │
│ 2026-01-08 10:30 AM             │
└─────────────────────────────────┘
```

---

### **2. Worker Payment (Dyer)**

```
TRIGGER: Dyer marks step 'Completed'
    ↓
VERIFICATION:
    completed_qty === step_qty ✓
    ↓
LEDGER ENTRY:
    Table: worker_ledgers
    worker_id: dyer_id (Ali Raza)
    type: 'credit'
    amount: Rs.5,000
    description: "Dyeing - JC-001"
    reference: production_step_id
    paymentStatus: 'payable'
```

**Visual:**
```
Ali Raza Ledger:
┌─────────────────────────────────┐
│ ✅ Dyeing - JC-001              │
│ +Rs.5,000                    💰 │
│ Payable | 2026-01-08 5:00 PM    │
└─────────────────────────────────┘
```

---

### **3. Worker Payment (Handwork)**

```
Same flow as Dyer:
    Complete → Verify → Credit Ledger
    
Zainab Bibi:
    +Rs.8,000 for Handwork - JC-001
```

---

### **4. Worker Payment (Tailor)**

```
Hassan Tailor:
    Complete stitching → Credit Rs.7,000
```

---

### **5. Step Cancellation (Strict Rule)**

```
IF Manager cancels a step:
    ↓
NO ledger entry created
    ↓
Worker gets NO payment
    ↓
Audit log records:
    "Step cancelled by Manager-001"
    "Reason: Quality issue"
```

**Visual:**
```
Cancelled Step:
┌─────────────────────────────────┐
│ ❌ Dyeing - CANCELLED           │
│ Rs.0 (No payment)            🚫 │
│ Cancelled: 2026-01-08 3:00 PM   │
└─────────────────────────────────┘
```

---

## 🎨 Figma UX - 3 Zaroori Features

### **1. Status Badges (Color-Coded)**

```css
Pending:    Yellow (⚠️)
In-Progress: Blue with pulse (🔵...)
Completed:   Green (✅)
Cancelled:   Red (❌)
```

**Implementation:**
```tsx
<Badge className={
    status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
    status === 'in-progress' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
    status === 'completed' ? 'bg-green-500/20 text-green-400' :
    'bg-red-500/20 text-red-400'
}>
    {status.toUpperCase()}
</Badge>
```

---

### **2. Lock Icon 🔒 for System Fields**

**Branch ID (System-Locked):**
```tsx
<div className="flex items-center gap-2">
    <Lock size={12} className="text-gray-500" />
    <span className="text-xs text-gray-400">Main Store</span>
    <Badge className="bg-gray-800 text-gray-500 text-[8px]">
        SYSTEM
    </Badge>
</div>
```

**Visual:**
```
┌────────────────────┐
│ 🔒 Main Store [SYS]│  ← Cannot edit
└────────────────────┘
```

**Stage Lock (Gating):**
```tsx
<div className="flex items-center gap-2 text-gray-500">
    <Lock size={14} />
    <span className="text-xs">
        Complete Dyeing to unlock
    </span>
</div>
```

---

### **3. Visual Stepper with Time Tracking**

```
Dyeing (1 day ago)
    ↓
Handwork (Active - 2 days)  ⏱️ WARNING!
    ↓
Stitching (Locked)  🔒
```

**Implementation:**
```tsx
<div className="flex items-center gap-2 text-xs">
    {/* Stage icon */}
    <div className="w-8 h-8 rounded-full bg-purple-500 animate-pulse">
        <Palette size={14} />
    </div>
    
    {/* Stage info */}
    <div className="flex-1">
        <div className="font-semibold">Dyeing</div>
        <div className="text-gray-500 flex items-center gap-1">
            <Timer size={10} />
            Started: 1 day ago
        </div>
    </div>
    
    {/* Time warning */}
    {daysInStage > 2 && (
        <AlertTriangle className="text-yellow-400" size={14} />
    )}
</div>
```

---

## 📊 Complete Data Flow

```
┌────────────────────────────────────────────────────┐
│ SALE CREATED                                       │
│ Product: Unstitched Suit (requires_production=true)│
│ Customer: Fatima Khan                              │
│ Branch: Main Store 🔒                              │
└───────────────────┬────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ AUTO-GENERATE         │
        │ - Production Order    │
        │ - Job Card (JC-001)   │
        │ - 3 Steps (Sequential)│
        └───────────┬───────────┘
                    ↓
    ┌───────────────────────────────┐
    │ STEP 1: DYEING 🎨            │
    │ Status: Pending → In-Progress │
    │ Worker: Ali Raza              │
    │ Material: 15m                 │
    │ Cost: Rs.5,000                │
    │ Started: 2026-01-08 11:00 AM  │
    │                               │
    │ [Complete] ✓                  │
    │ → completed_at: timestamp     │
    │ → Ledger: +Rs.5,000 to Ali    │
    │ → Unlock Handwork 🔓          │
    └───────────────┬───────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ STEP 2: HANDWORK ✨ (UNLOCKED)│
    │ Status: Pending → In-Progress │
    │ Worker: Zainab Bibi           │
    │ Material: 15m                 │
    │ Cost: Rs.8,000                │
    │                               │
    │ [Complete] ✓                  │
    │ → Ledger: +Rs.8,000 to Zainab │
    │ → Unlock Stitching 🔓         │
    └───────────────┬───────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ STEP 3: STITCHING ✂️ (UNLOCKED)│
    │ Status: Pending → In-Progress │
    │ Worker: Hassan Tailor         │
    │ Material: 15m                 │
    │ Cost: Rs.7,000                │
    │ Measurements: 44/40/36/22     │
    │                               │
    │ [Complete] ✓                  │
    │ → Ledger: +Rs.7,000 to Hassan │
    │ → Order Status: COMPLETED 🎉  │
    └───────────────┬───────────────┘
                    ↓
        ┌───────────────────────┐
        │ FINAL STATUS          │
        │ All steps completed ✅ │
        │ Total cost: Rs.20,000 │
        │ Ready for delivery    │
        └───────────────────────┘
```

---

## 🎯 Dashboard Implementation

### **Status Card Counts**

```typescript
const counts = {
    dyeing: productionJobs.filter(j => j.status === 'dyeing').length,
    handwork: productionJobs.filter(j => j.status === 'handwork').length,
    stitching: productionJobs.filter(j => j.status === 'stitching').length,
    completed: productionJobs.filter(j => j.status === 'completed').length
};
```

### **Visual Stepper Logic**

```typescript
const getStageStatus = (stage) => {
    if (stage.isLocked) return 'locked';
    if (stage.status === 'completed') return 'completed';
    if (stage.status === 'in-progress') return 'active';
    return 'pending';
};

const getStageIcon = (status) => {
    if (status === 'locked') return <Lock />;
    if (status === 'active') return <Circle className="animate-pulse" />;
    if (status === 'completed') return <CheckCircle />;
    return <Circle className="opacity-50" />;
};
```

### **Time Tracking**

```typescript
const getDaysInStage = (startedAt) => {
    const now = new Date();
    const start = new Date(startedAt);
    const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return days;
};

// Show warning if > 2 days
{daysInStage > 2 && (
    <Badge className="bg-yellow-500/20 text-yellow-400">
        <Timer size={8} />
        {daysInStage}d
    </Badge>
)}
```

---

## ✅ Completion Checklist

### **For Developers:**
- [x] Auto-create production order on sale
- [x] Generate 3 sequential steps
- [x] Implement gating logic (lock/unlock)
- [x] Quantity verification before completion
- [x] Auto-timestamp on status change
- [x] Worker ledger entries on completion
- [x] No payment on cancellation
- [x] Branch context locking

### **For Designers:**
- [x] Status badges (Yellow/Blue/Green/Red)
- [x] Lock icons for system fields
- [x] Lock icons for gated stages
- [x] Visual stepper with connector lines
- [x] Time tracking indicators
- [x] Payment status badges
- [x] Pulsing animation for active stages
- [x] Measurements display in tailor step

---

## 💡 Business Rules Summary

| Rule | Implementation |
|------|----------------|
| **Auto-trigger** | `requires_production: true` → Create PO |
| **Branch Lock** | System-set, cannot change |
| **Sequential** | Next step locked until previous complete |
| **Verification** | `completed_qty === step_qty` required |
| **Timestamps** | Auto-set on status change |
| **Payments** | Credit ledger only on completion |
| **Cancellation** | No ledger entry, no payment |
| **Measurements** | From sale, shown in tailor step |

---

## 🎨 Visual Examples

### **Dashboard View:**
```
┌─────────────────────────────────────────────┐
│ Studio Production Dashboard                 │
├─────────────────────────────────────────────┤
│ [🎨 Dyeing:1] [✨ Handwork:1] [✂️ Stitch:1] │
├──────────────────────┬──────────────────────┤
│ JC-001 | Fatima |▓▓▓│ JC-001               │
│ [HIGH] [⏰1d]        │ Fatima Khan          │
│                      │ Silk 15m             │
│ JC-002 | Sarah  |▓▓▓│                      │
│ [⏰3d ⚠️]           │ 🎨 Dyeing (1d ago)   │
│                      │    Ali Raza          │
│                      │    15m | Rs.5,000    │
│                      │    ✓ Completed       │
│                      │                      │
│                      │ ✨ Handwork 🔓       │
│                      │    Ready to assign   │
│                      │                      │
│                      │ ✂️ Stitching 🔒      │
│                      │    Waiting...        │
└──────────────────────┴──────────────────────┘
```

---

**Perfect! Ab aapka Studio Lifecycle completely documented hai with:**

✅ **Auto-detection** - Product se production order  
✅ **Sequential gating** - Lock/unlock logic  
✅ **Time tracking** - Days in stage warnings  
✅ **Worker ledgers** - Payment accountability  
✅ **Visual indicators** - Badges, locks, pulses  
✅ **Measurements** - Tailor step integration  
✅ **Branch context** - System-locked fields  

**Ready for Figma implementation!** 🎨🚀
