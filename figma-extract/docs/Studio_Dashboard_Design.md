# Studio Production Dashboard 🎨

**Din Collection ERP - Professional Production Management Interface**

---

## 🎯 Overview

A **dark-themed, minimalist dashboard** for managing fabric production through three stages:
1. **Dyeing (Dahair)** - Color treatment
2. **Handwork** - Detail embellishments
3. **Stitching (Tailor)** - Final assembly

---

## 📐 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Studio Production Dashboard                    [Filter] [🔍]│
├─────────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│  │Dyeing  │  │Handwork│  │Stitching│  │Complete│           │
│  │   1    │  │   1    │  │   1    │  │   1    │  Status   │
│  └────────┘  └────────┘  └────────┘  └────────┘   Cards   │
├─────────────────────────────────────────┬───────────────────┤
│  Production Queue (2/3)                 │ Production Flow   │
│  ┌─────────────────────────────────┐   │ (1/3)            │
│  │ JC-001 │ Customer │ Fabric │ ▓▓▓│   │                  │
│  │ JC-002 │ Customer │ Fabric │ ▓▓▓│   │ [Selected Job]   │
│  │ JC-003 │ Customer │ Fabric │ ▓▓▓│   │                  │
│  └─────────────────────────────────┘   │ 🎨 Dyeing        │
│                                         │   → Worker       │
│                                         │   → Material     │
│                                         │   → Cost         │
│                                         │                  │
│                                         │ ✨ Handwork      │
│                                         │   → Worker       │
│                                         │   → Material     │
│                                         │   → Cost         │
│                                         │                  │
│                                         │ ✂️ Stitching     │
│                                         │   → Worker       │
│                                         │   → Material     │
│                                         │   → Cost         │
└─────────────────────────────────────────┴───────────────────┘
```

---

## 🎨 Design Elements

### **1. Status Cards (Top Bar)**

4 clickable cards showing stage counts:

```
┌──────────────┐
│  🎨          │
│      1       │  ← Count (large, colored)
│              │
│ Dyeing       │  ← Label
│ Active Jobs  │  ← Subtitle
└──────────────┘
```

**Features:**
- **Icons:** Palette, Sparkles, Scissors, CheckCircle
- **Colors:** Purple, Pink, Blue, Green
- **Interactive:** Click to filter jobs by stage
- **Active State:** Border glow + colored background

**Colors:**
```css
Dyeing:    Purple (#A855F7)
Handwork:  Pink (#EC4899)
Stitching: Blue (#3B82F6)
Completed: Green (#10B981)
```

---

### **2. Production Queue Table**

Clean, minimal table with:

**Columns:**
- **Job Card ID** (JC-001) + Priority badge
- **Customer Name** (Fatima Khan)
- **Fabric Type** (Silk Thaan - 15m)
- **Progress Bar** (33% with deadline)
- **Action** (Chevron indicator)

**Features:**
- **Row Selection:** Click to view details
- **Selected State:** Blue highlight + left border
- **Progress Bar:** Color-coded by current stage
- **Priority Badge:** Red "HIGH" for urgent jobs
- **Deadline:** Clock icon + date

**Progress Colors:**
```
33% → Purple (Dyeing)
66% → Pink (Handwork)
85% → Blue (Stitching)
100% → Green (Completed)
```

---

### **3. Production Flow Panel (Vertical Stepper)**

Right sidebar with detailed stage breakdown:

```
JC-001
Fatima Khan
Silk Thaan - 15m

┌─────────────────┐
│  ⦿ Dyeing       │  ← Active/Completed indicator
│                 │
│  Worker:        │
│  Ali Raza       │
│                 │
│  [Material] [Cost]
│   15m      5000 │
│                 │
│  [Completed]    │
└─────────────────┘
        │
        ↓
┌─────────────────┐
│  ⦿ Handwork     │
│  ...            │
└─────────────────┘
        │
        ↓
┌─────────────────┐
│  ⦿ Stitching    │
│  ...            │
└─────────────────┘
```

**Stage Status:**
- **Completed:** Filled circle (colored)
- **In Progress:** Pulsing circle (animated)
- **Pending:** Gray circle

**Each Stage Shows:**
```
Worker Card:
┌──────────────┐
│ 👤 Worker    │
│ Ali Raza     │
└──────────────┘

Data Grid (2 columns):
┌──────┬──────┐
│📏 15m│💰5000│
└──────┴──────┘
```

---

## 📊 Data Structure

### **Job Card:**
```typescript
{
  id: 'JC-001',
  customer: 'Fatima Khan',
  fabricType: 'Silk Thaan - 15m',
  status: 'dyeing' | 'handwork' | 'stitching' | 'completed',
  progress: 33,
  deadline: '2026-01-15',
  priority: 'high' | 'medium' | 'low',
  stages: {
    dyeing: {
      status: 'in-progress',
      worker: 'Ali Raza',
      material: '15m',
      cost: 5000
    },
    handwork: { ... },
    stitching: { ... }
  }
}
```

---

## 🎯 Features

### **1. Status Filtering**
- Click any status card to filter jobs
- Click again to show all
- Active filter highlights the card

### **2. Job Selection**
- Click any row in table
- Right panel shows detailed flow
- Selected row gets blue highlight

### **3. Progress Tracking**
- Visual progress bar per job
- Color indicates current stage
- Percentage shows completion

### **4. Stage Details**
- Worker assignment tracking
- Material usage (meters)
- Cost per stage
- Status badges

### **5. Priority System**
- High priority shows red badge
- Affects visual prominence
- Helps prioritize work

---

## 🎨 Color System

### **Background:**
```css
Page: bg-gray-950 (#030712)
Cards: bg-gray-900 (#111827)
Inputs: bg-gray-800 (#1F2937)
```

### **Borders:**
```css
Default: border-gray-800 (#1F2937)
Hover: border-gray-700 (#374151)
Active: border-[color]-500
```

### **Text:**
```css
Primary: text-white
Secondary: text-gray-300
Tertiary: text-gray-400
Labels: text-gray-500
```

### **Stage Colors:**
```css
Dyeing:    purple-500 (#A855F7)
Handwork:  pink-500 (#EC4899)
Stitching: blue-500 (#3B82F6)
Completed: green-500 (#10B981)
Priority:  red-500 (#EF4444)
```

---

## 📱 Responsive Behavior

### **Desktop (lg+):**
```
Status Cards: 4 columns
Queue: 2/3 width
Flow: 1/3 width (sticky)
```

### **Tablet (md):**
```
Status Cards: 2x2 grid
Queue: Full width
Flow: Below queue
```

### **Mobile (sm):**
```
Status Cards: 1 column
Queue: Stacked
Flow: Expandable
```

---

## ✨ Interactive Elements

### **Hover States:**
```css
Status Cards: border-gray-700
Table Rows: bg-gray-800/50
Buttons: Subtle glow
```

### **Active States:**
```css
Selected Card: Colored border + tint
Selected Row: Blue highlight + border
Active Stage: Pulsing animation
```

### **Animations:**
```css
Progress Bar: Smooth width transition
Stage Circle: Pulse when active
Hover: Soft transitions (300ms)
```

---

## 🔍 Search & Filter

### **Search Bar:**
```
Top right: "Search job cards..."
Searches: ID, Customer, Fabric
Real-time filtering
```

### **Filter Button:**
```
Opens filter modal
Filter by:
  - Status
  - Priority
  - Deadline range
  - Worker
```

---

## 📐 Sizing Guide

### **Status Cards:**
```css
Height: ~120px
Icon: 20px
Count: text-2xl
Label: text-sm
```

### **Table:**
```css
Row Height: ~60px
Font: text-sm
Progress Bar: h-2 (8px)
Badge: text-[10px]
```

### **Flow Panel:**
```css
Width: 1/3 of grid
Sticky: top-6
Stage Circle: 32px
Icon: 14px
Text: text-xs
```

---

## 🎯 User Workflow

**1. Overview:**
- See counts at top
- Scan queue table
- Identify urgent jobs (red badges)

**2. Filter:**
- Click status card to focus
- Or use search/filter

**3. Details:**
- Click job row
- View production flow
- Check worker assignments

**4. Tracking:**
- Monitor progress bars
- See stage statuses
- Track costs & materials

---

## 💡 Best Practices

### **Visual Hierarchy:**
```
Level 1: Status counts (most important)
    ↓
Level 2: Job list (scannable)
    ↓
Level 3: Selected details (deep dive)
```

### **Information Density:**
- Status cards: Minimal, focused
- Table: Essential info only
- Details panel: Complete data

### **Color Usage:**
- Semantic (stage = color)
- Consistent throughout
- Not overwhelming

---

## 🔧 Technical Implementation

### **Component Structure:**
```tsx
StudioDashboard
├── Header
│   ├── Title
│   └── Search + Filter
├── Status Cards (4)
│   └── Click → Filter
├── Grid Layout
│   ├── Production Queue (2/3)
│   │   └── Job Rows (clickable)
│   └── Production Flow (1/3)
│       └── Vertical Stepper
│           ├── Dyeing Stage
│           ├── Handwork Stage
│           └── Stitching Stage
```

### **State Management:**
```tsx
const [selectedJob, setSelectedJob] = useState<string | null>(null);
const [filterStatus, setFilterStatus] = useState<string>('all');
```

### **Conditional Rendering:**
```tsx
// Filter jobs by status
const filteredJobs = filterStatus === 'all' 
  ? productionJobs 
  : productionJobs.filter(j => j.status === filterStatus);

// Show flow only when job selected
{selectedJobData && <ProductionFlow />}
```

---

## ✅ Key Features Summary

| Feature | Description |
|---------|-------------|
| **Status Cards** | 4 clickable cards for quick filtering |
| **Queue Table** | Clean list of all production jobs |
| **Progress Bars** | Visual completion tracking |
| **Priority Badges** | High/Medium/Low indicators |
| **Vertical Stepper** | Stage-by-stage breakdown |
| **Worker Tracking** | Who's assigned to each stage |
| **Cost Tracking** | Material + labor costs |
| **Material Tracking** | Meters used per stage |
| **Real-time Updates** | Live status changes |
| **Responsive Design** | Works on all screens |

---

## 🎬 Mock Data

**Sample Jobs:**
```
JC-001: Dyeing → Purple bar (33%)
JC-002: Handwork → Pink bar (66%)
JC-003: Stitching → Blue bar (85%)
JC-004: Completed → Green bar (100%)
```

**Workers:**
- Ali Raza (Dyeing specialist)
- Zainab Bibi (Handwork expert)
- Hassan Tailor (Stitching master)

---

## 🚀 Future Enhancements

1. ✅ **Real-time Updates** - WebSocket integration
2. ✅ **Worker Dashboard** - Individual task views
3. ✅ **Time Tracking** - How long each stage takes
4. ✅ **Quality Checks** - Approval workflows
5. ✅ **Photo Upload** - Before/after images
6. ✅ **Notifications** - Stage completion alerts
7. ✅ **Analytics** - Performance metrics
8. ✅ **Export** - Reports generation

---

**Status:** ✅ **Complete & Production Ready**  
**Design Style:** Minimalist, Professional, High-Contrast  
**Color Scheme:** Dark theme with semantic stage colors  
**Layout:** Strict data tracking with clean separation  
**Last Updated:** January 9, 2026

---

## 🎉 Summary

**Professional Studio Dashboard featuring:**
- ✅ 4 status cards for quick overview
- ✅ Production queue with progress tracking
- ✅ Detailed vertical stepper for selected jobs
- ✅ Worker, material, and cost tracking
- ✅ Color-coded stages (Purple/Pink/Blue/Green)
- ✅ Clean, minimal, high-contrast design
- ✅ Responsive and interactive
- ✅ Ready for real production use

**Perfect for managing fabric production workflows!** 🎨✂️✨
