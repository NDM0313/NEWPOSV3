# GitHub se Full System Download Karne Ke Instructions

## Option 1: Fresh Clone (Nayi Machine/Location Par)

Agar aap kisi nayi location ya machine par system download karna chahte hain:

```bash
# 1. Navigate to desired directory
cd /path/to/your/desired/location

# 2. Clone the repository
git clone https://github.com/NDM0313/NEWPOSV3.git

# 3. Navigate into the project
cd NEWPOSV3

# 4. Install dependencies
npm install

# 5. Create .env file with your Supabase credentials
# (Copy from your existing .env file or set up new one)

# 6. Start development server
npm run dev
```

## Option 2: Existing Repository Se Pull (Latest Changes)

Agar aap already cloned repository se latest changes pull karna chahte hain:

```bash
# 1. Navigate to project directory
cd /Users/ndm/Documents/Development/CursorDev/NEWPOSV3

# 2. Pull latest changes
git pull origin main

# 3. Install any new dependencies (if package.json updated)
npm install

# 4. Start development server
npm run dev
```

## Repository Information

- **Repository URL**: https://github.com/NDM0313/NEWPOSV3.git
- **Branch**: main
- **Latest Commit**: 9b831ee (Full system: Inventory, Enable Packing, Ledger/Print, Purchase/Sale fixes, docs & migrations)

## Important Files Included

✅ Customer Ledger with Modern Design
✅ All API services
✅ Shared components (LoadingSpinner, ErrorMessage, EmptyState)
✅ Complete integration with Accounting Dashboard
✅ Contacts page integration
✅ Dark theme implementation
✅ Full documentation

## Requirements

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and credentials
- Git installed

## After Download

1. Install dependencies: `npm install`
2. Set up environment variables in `.env` file
3. Run development server: `npm run dev`
4. Access application at: `http://localhost:5173`

---

**Current Status**: ✅ Repository is up to date with all latest changes
