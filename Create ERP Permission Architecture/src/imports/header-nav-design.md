🔝 Top Header Structure

Height: 72px
Background: Dark navy (#0f172a ya jo aapka theme hai)

Left:
ERP Permission Architecture

Center:
Icon Navigation Row

Right:
User Avatar + Theme toggle

🧭 Navigation Design (Main Part)

Icons circle ya rounded square ke andar hone chahiye.

Example structure:

[ 📊 ] Dashboard
[ 🛡️ ] Roles
[ 📋 ] Matrix
[ 👤 ] Users
[ 🏢 ] Branch
[ 🔐 ] RLS
[ ⚙️ ] Settings

Layout:

Horizontal
Gap: 32px
Icon container size: 44x44
Border radius: 12px

🎯 Active State Design (Very Important)

Active Tab:

✔ Background filled (emerald/primary color)
✔ Icon white
✔ Slight glow shadow
✔ Label bold
✔ 2px bottom indicator optional

Inactive:

✔ Transparent background
✔ Icon gray
✔ Label gray-400
✔ On hover → subtle bg color

📐 Figma Structure (Step by Step)

1️⃣ Delete sidebar frame completely
2️⃣ Create new Frame → Height 72px
3️⃣ Add Auto Layout (Horizontal)
4️⃣ Justify: Space Between

Inside center area:

Create another auto layout:

Direction: Horizontal
Gap: 32px
Alignment: Center

Each item structure:

Frame (Vertical Auto Layout)
├── Icon Container (44x44)
└── Label Text (12-13px)

📱 Content Switching Logic

Single Page Architecture:

Main layout:

Header
↓
Top Icon Nav
↓
Content Area (Auto layout vertical)

Content area mein:

Dashboard section
Roles section
Users section

In Figma:
Use variants OR interactive components

In Code:
State based rendering

🧱 Layout Structure Concept

Structure thinking:

div (min-h-screen flex flex-col)

header

icon-navigation

main-content (flex-1 p-6)

🎨 Styling Suggestion (Modern ERP Look)

Icon container inactive:
bg-slate-800
hover:bg-slate-700

Active:
bg-emerald-500
shadow-lg shadow-emerald-500/20

Label font:
12px
Medium weight

🧠 UX Improvements

✔ Tooltips on hover
✔ Smooth transition (150ms ease)
✔ Active indicator animation
✔ Content fade-in effect
✔ Top bar sticky rakho

🚀 Advanced Enhancement (Optional)

Agar aur premium feel chahte ho:

Icons only mode
Label hover par show ho

Ya compact mode:

Icons row center mein
Label bilkul remove