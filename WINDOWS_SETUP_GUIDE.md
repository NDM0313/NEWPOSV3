# 🪟 Windows Setup Guide

**Complete guide to set up and run Din Collection ERP on Windows**

---

## 📋 Prerequisites

### 1. Install Node.js

**Download from official website:**
- Go to [nodejs.org](https://nodejs.org/)
- Download **LTS version** (v18 or higher)
- Run installer and follow instructions
- Make sure to check "Add to PATH" during installation

**Verify installation:**
```powershell
node --version  # Should be v18 or higher
npm --version
```

### 2. Install Git

**Download from official website:**
- Go to [git-scm.com](https://git-scm.com/download/win)
- Download Windows installer
- Run installer with default settings
- Git Bash will be installed automatically

**Verify installation:**
```powershell
git --version
```

### 3. Install PowerShell (Already Installed)

Windows 10/11 comes with PowerShell 5.1+ pre-installed.

**Verify:**
```powershell
$PSVersionTable.PSVersion
```

---

## 🚀 Quick Setup

### Step 1: Clone Repository

**Using PowerShell:**
```powershell
cd Desktop  # Or your preferred location
git clone https://github.com/NDM0313/NEWPOSV3.git
cd NEWPOSV3
```

**Using Git Bash:**
```bash
cd ~/Desktop
git clone https://github.com/NDM0313/NEWPOSV3.git
cd NEWPOSV3
```

### Step 2: Install Dependencies

```powershell
npm install
```

This will install all required packages. Wait for completion (may take 2-5 minutes).

### Step 3: Create Environment File

**Using PowerShell:**
```powershell
New-Item -Path .env.local -ItemType File
```

**Using Command Prompt:**
```cmd
type nul > .env.local
```

**Using Git Bash:**
```bash
touch .env.local
```

Open `.env.local` in Notepad or VS Code and add:

```env
VITE_SUPABASE_URL=https://pcxfwmbcjrkgzibgdrlz.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Get your Supabase credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings → API**
4. Copy Project URL and anon/public key
5. Copy service_role key (keep it secret!)

### Step 4: Start Development Server

```powershell
npm run dev
```

Open browser: `http://localhost:5173`

---

## 🗄 Database Setup (Windows)

### Option 1: Using Supabase Dashboard (Easiest - Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **SQL Editor**
4. Run scripts in this order:
   - `supabase-extract/schema.sql` - Copy entire file and run
   - `supabase-extract/functions.sql` - Copy entire file and run
   - `supabase-extract/rls-policies.sql` - Copy entire file and run
   - `supabase-extract/seed.sql` - (Optional) Demo data

### Option 2: Using psql (Command Line)

#### Install PostgreSQL Client

**Download PostgreSQL:**
- Go to [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
- Download installer
- During installation, make sure to install "Command Line Tools"

**Or use Chocolatey (Package Manager):**
```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install PostgreSQL
choco install postgresql
```

#### Connect to Supabase

**Using PowerShell:**
```powershell
# Set environment variables
$env:PGHOST="aws-1-ap-southeast-1.pooler.supabase.com"
$env:PGPORT="6543"
$env:PGDATABASE="postgres"
$env:PGUSER="postgres.pcxfwmbcjrkgzibgdrlz"
$env:PGPASSWORD="your-password"

# Run SQL scripts
psql -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -f supabase-extract\schema.sql
psql -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -f supabase-extract\functions.sql
psql -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -f supabase-extract\rls-policies.sql
```

**Using Command Prompt:**
```cmd
set PGHOST=aws-1-ap-southeast-1.pooler.supabase.com
set PGPORT=6543
set PGDATABASE=postgres
set PGUSER=postgres.pcxfwmbcjrkgzibgdrlz
set PGPASSWORD=your-password

psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f supabase-extract\schema.sql
```

---

## 🛠 Development Commands

**All commands work in PowerShell, Command Prompt, or Git Bash:**

```powershell
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check for errors
npm run lint
```

---

## 🔧 Windows-Specific Tips

### 1. Terminal Setup

**Recommended Terminal Options:**

1. **Windows Terminal** (Best - Built-in on Windows 11):
   - Press `Win + X` → Select "Terminal"
   - Or download from Microsoft Store

2. **PowerShell** (Default):
   - Press `Win + X` → Select "Windows PowerShell"
   - Or search "PowerShell" in Start menu

3. **Git Bash** (For Linux-like experience):
   - Comes with Git installation
   - Right-click folder → "Git Bash Here"

4. **VS Code Integrated Terminal**:
   - Open VS Code
   - Press `` Ctrl + ` `` to open terminal

### 2. Code Editor

**VS Code** (Recommended):
- Download from [code.visualstudio.com](https://code.visualstudio.com/)
- Install with default settings
- Recommended extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin

**Cursor** (AI-powered):
- Download from [cursor.sh](https://cursor.sh/)
- Similar to VS Code but with AI features

### 3. Git Configuration

**First time setup:**
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Check configuration:**
```powershell
git config --list
```

### 4. Port Management

**If port 5173 is busy:**

**Using PowerShell:**
```powershell
# Find process using port
netstat -ano | findstr :5173

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Using Command Prompt:**
```cmd
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Or change port in vite.config.ts:**
```typescript
export default defineConfig({
  server: {
    port: 3000  // Change to any available port
  }
})
```

### 5. Path Issues

**Windows uses backslashes (`\`) but Git Bash uses forward slashes (`/`):**

- In PowerShell/CMD: Use `\` or `/` (both work)
- In Git Bash: Use `/` only
- In code: Always use `/` (works everywhere)

**Example:**
```powershell
# PowerShell - both work
cd .\src\app
cd ./src/app

# Git Bash - only forward slash
cd ./src/app
```

---

## 📦 Package Management

### Using npm (Default)

```powershell
# Install package
npm install <package-name>

# Install dev dependency
npm install -D <package-name>

# Uninstall package
npm uninstall <package-name>

# Update all packages
npm update

# Clear cache
npm cache clean --force
```

### Using yarn (Alternative)

```powershell
# Install yarn globally
npm install -g yarn

# Use yarn
yarn install
yarn add <package-name>
yarn remove <package-name>
yarn upgrade
```

### Using pnpm (Faster Alternative)

```powershell
# Install pnpm globally
npm install -g pnpm

# Use pnpm
pnpm install
pnpm add <package-name>
pnpm remove <package-name>
```

---

## 🔐 Environment Variables

### Create `.env.local`

**Using PowerShell:**
```powershell
New-Item -Path .env.local -ItemType File
```

**Using Command Prompt:**
```cmd
type nul > .env.local
```

**Using Git Bash:**
```bash
touch .env.local
```

### Add Variables

Open `.env.local` in Notepad or VS Code:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://pcxfwmbcjrkgzibgdrlz.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**⚠️ Important**: 
- Never commit `.env.local` to Git!
- File is already in `.gitignore`
- Keep credentials secret

---

## 🐛 Troubleshooting

### Issue 1: Permission Denied

**Problem:** npm install fails with permission errors

**Solution:**
```powershell
# Run PowerShell as Administrator
# Right-click PowerShell → "Run as Administrator"

# Then try again
npm install
```

### Issue 2: Node Version Mismatch

**Problem:** Wrong Node.js version

**Solution - Use nvm-windows:**
```powershell
# Install nvm-windows from:
# https://github.com/coreybutler/nvm-windows/releases

# Install Node.js 18
nvm install 18
nvm use 18

# Verify
node --version
```

### Issue 3: Port Already in Use

**Problem:** Port 5173 is already in use

**Solution:**
```powershell
# Find process
netstat -ano | findstr :5173

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in vite.config.ts
```

### Issue 4: Module Not Found

**Problem:** `npm install` fails or modules not found

**Solution:**
```powershell
# Delete node_modules and package-lock.json
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

### Issue 5: Git Authentication Issues

**Problem:** Can't push to GitHub

**Solution 1 - Use Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token
3. Use token as password when pushing

**Solution 2 - Use SSH:**
```powershell
# Change remote URL to SSH
git remote set-url origin git@github.com:NDM0313/NEWPOSV3.git

# Generate SSH key (if needed)
ssh-keygen -t ed25519 -C "your.email@example.com"
# Press Enter for all prompts

# Copy public key
cat ~/.ssh/id_ed25519.pub
# Add to GitHub: Settings → SSH and GPG keys
```

### Issue 6: Line Ending Warnings

**Problem:** Git shows line ending warnings

**Solution:**
```powershell
# Configure Git for Windows
git config --global core.autocrlf true

# Or for cross-platform (recommended)
git config --global core.autocrlf input
```

### Issue 7: PowerShell Execution Policy

**Problem:** Can't run PowerShell scripts

**Solution:**
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue 8: Long Path Names

**Problem:** File path too long error

**Solution:**
```powershell
# Enable long paths in Windows (Run as Administrator)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

# Restart computer
```

---

## 📱 Recommended Tools

### Development Tools

1. **VS Code Extensions**:
   - ESLint
   - Prettier
   - Tailwind CSS IntelliSense
   - TypeScript Vue Plugin
   - GitLens
   - Error Lens

2. **Browser Extensions**:
   - React Developer Tools
   - Redux DevTools

3. **Database Tools**:
   - **DBeaver** (Free, Cross-platform)
     - Download from [dbeaver.io](https://dbeaver.io/)
   - **pgAdmin** (PostgreSQL specific)
     - Download from [pgadmin.org](https://www.pgadmin.org/)
   - **TablePlus** (Paid, Beautiful UI)
     - Download from [tableplus.com](https://tableplus.com/)

### Install DBeaver

```powershell
# Using Chocolatey
choco install dbeaver

# Or download from website
# https://dbeaver.io/download/
```

---

## 🔄 Git Workflow

### Daily Workflow

**Using PowerShell:**
```powershell
# Pull latest changes
git pull origin main

# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Your commit message"

# Push
git push origin main
```

**Using Git Bash:**
```bash
git pull origin main
git status
git add .
git commit -m "Your commit message"
git push origin main
```

### Branch Workflow

```powershell
# Create new branch
git checkout -b feature/your-feature-name

# Work on feature
# ... make changes ...

# Commit
git add .
git commit -m "Add feature"

# Push branch
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

---

## 🚀 Production Deployment

### Build for Production

```powershell
npm run build
```

Output will be in `dist/` folder.

### Deploy Options

1. **Vercel** (Recommended):
   ```powershell
   npm install -g vercel
   vercel
   ```

2. **Netlify**:
   - Connect GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **GitHub Pages**:
   ```powershell
   npm install -g gh-pages
   npm run build
   gh-pages -d dist
   ```

4. **Windows Server (IIS)**:
   - Build project: `npm run build`
   - Copy `dist/` folder to IIS wwwroot
   - Configure IIS for SPA routing

---

## 📝 Windows-Specific Notes

- **Line Endings**: Windows uses CRLF (`\r\n`), Git handles automatically
- **File Permissions**: Windows handles permissions differently than Linux/Mac
- **Path Separators**: Use `\` in PowerShell/CMD, `/` in Git Bash
- **Case Sensitivity**: Windows file system is case-insensitive
- **Long Paths**: Enable long path support in Windows settings
- **Antivirus**: May slow down `npm install`, add project folder to exclusions

---

## ✅ Verification Checklist

- [ ] Node.js installed (v18+)
- [ ] Git installed and configured
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` created with Supabase credentials
- [ ] Database schema applied
- [ ] Development server runs (`npm run dev`)
- [ ] Application opens in browser (`http://localhost:5173`)
- [ ] Can login/create business
- [ ] Products module works
- [ ] Purchases module works
- [ ] Sales module works

---

## 🆘 Getting Help

1. Check [README.md](./README.md) for general info
2. Check [MACBOOK_SETUP_GUIDE.md](./MACBOOK_SETUP_GUIDE.md) for Mac-specific tips (if working cross-platform)
3. Check module-specific guides:
   - `PRODUCTS_MODULE_COMPLETE.md`
   - `PURCHASES_MODULE_COMPLETE.md`
   - `SALES_MODULE_COMPLETE.md`
4. Check [GitHub Issues](https://github.com/NDM0313/NEWPOSV3/issues)
5. Review error messages in browser console (Press `F12`)
6. Check Supabase logs in dashboard
7. Check Windows Event Viewer for system errors
8. Check [QUICK_SETUP_GUIDE.md](./QUICK_SETUP_GUIDE.md) for quick troubleshooting

---

## 🎯 Next Steps

After setup is complete:

### Step 1: Database Setup

Run all SQL scripts in `supabase-extract/` folder using Supabase Dashboard:

1. Go to [Supabase Dashboard](https://app.supabase.com/) → SQL Editor
2. Run scripts in this order:
   - `supabase-extract/schema.sql` - Creates all tables
   - `supabase-extract/functions.sql` - Creates functions & triggers
   - `supabase-extract/rls-policies.sql` - Sets up Row Level Security
   - `supabase-extract/seed.sql` - (Optional) Demo data

### Step 2: Create Demo User

**Using PowerShell Script (Recommended):**

```powershell
# Make sure .env.local has SUPABASE_SERVICE_ROLE_KEY
# Then run:
.\create-user.ps1
```

**Manual Method:**

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter email and password
4. User will be created

**Or use SQL in Supabase SQL Editor:**

```sql
-- Run create-demo-user-simple.sql
-- This creates a demo user with email: demo@example.com
```

### Step 3: Test Modules

1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:5173`
3. Login with demo user credentials
4. Test each module:
   - ✅ Products module - Create, edit, delete products
   - ✅ Purchases module - Create purchase orders
   - ✅ Sales module - Create sales invoices

### Step 4: Configure Settings

1. Go to Settings module
2. Set up:
   - Company information
   - Branches
   - Accounts (Cash, Bank, etc.)
   - Numbering rules

### Step 5: Add Data

1. Create products
2. Add contacts (suppliers, customers)
3. Create purchase orders
4. Create sales invoices

### Step 6: Implement Remaining Modules from Figma Design

**⚠️ IMPORTANT:** Windows ne Figma design banaya hai. Ab remaining modules ko Figma design ke according front-end ke saath link karna hai.

#### Current Status:

**✅ Completed Modules (100%):**
- Products Module - Full CRUD, Variations, Stock, Pricing
- Purchases Module - PO Management, Payments, Ledger
- Sales Module - Invoices, Payments, Shipping

**🟡 Partially Complete Modules:**
- Contacts Module (80%) - CRUD done, some actions remaining
- Inventory Module (60%) - Dashboard done, stock tracking remaining
- Rentals Module (50%) - Booking done, full management remaining
- Studio Production Module (50%) - Basic workflow done
- Expenses Module (50%) - Tracking done, full features remaining
- Accounting Module (50%) - Entries done, reports remaining
- Reports Module (40%) - Basic dashboards done
- Settings Module (60%) - Company settings done, full config remaining

#### Implementation Workflow (Figma Design → Front-End):

**1. Study Figma Design:**
- Open Figma design file: `Modern ERP POS System compete by figma 18-1-26.zip`
- Review design for each remaining module
- Note all components, layouts, and interactions

**2. Check Existing Implementation Guides:**
- Read `figma-extract/IMPLEMENTATION_COMPLETE.md` - Complete system overview
- Read `figma-extract/GLOBAL_PATTERNS_IMPLEMENTATION.md` - Design patterns
- Read `SYSTEM_REBUILD_PROGRESS.md` - Current progress and remaining work
- Read `PRODUCTS_MODULE_SYSTEMATIC_PLAN.md` - Example of systematic approach

**3. Follow Systematic Approach:**

**For Each Remaining Module:**

**Step A: Component Analysis**
```powershell
# Check what components exist in figma-extract folder
ls figma-extract/src/app/components/
```

**Step B: Create/Update Components**
- Match Figma design exactly
- Use existing design tokens (CSS variables)
- Follow component structure from completed modules

**Step C: Connect to Backend**
- Use Supabase services (similar to `productService.ts`, `saleService.ts`)
- Connect to existing contexts (SalesContext, PurchaseContext, etc.)
- Implement CRUD operations

**Step D: Test Integration**
- Test with real data from Supabase
- Verify all actions work (View, Edit, Delete, etc.)
- Check ledger integration
- Verify accounting integration

#### Priority Order for Remaining Modules:

**HIGH PRIORITY (Complete First):**
1. **Contacts Module** - Complete remaining actions:
   - Edit Contact form
   - View Details drawer
   - Complete all three-dots menu actions

2. **Inventory Module** - Complete stock management:
   - Stock History drawer
   - Adjust Stock dialog
   - Low stock alerts
   - Multi-location inventory

3. **Settings Module** - Complete all settings:
   - User management
   - Permissions
   - All 13 settings categories

**MEDIUM PRIORITY:**
4. **Rentals Module** - Complete rental system:
   - Full booking management
   - Availability calendar
   - Return management
   - Rental accounting

5. **Studio Production Module** - Complete workflow:
   - Production orders
   - Worker management
   - Job card system
   - Cost allocation

6. **Expenses Module** - Complete expense tracking:
   - Approval workflow
   - Receipt attachments
   - Budget tracking
   - Expense analytics

**LOW PRIORITY:**
7. **Accounting Module** - Complete accounting:
   - Full reports
   - Financial statements
   - Account reconciliation

8. **Reports Module** - Complete reporting:
   - All report types
   - Export functionality
   - Custom date ranges

#### Implementation Resources:

**Documentation Files to Read:**
```
📄 figma-extract/IMPLEMENTATION_COMPLETE.md
📄 figma-extract/GLOBAL_PATTERNS_IMPLEMENTATION.md
📄 figma-extract/IMPLEMENTATION_SUMMARY.md
📄 SYSTEM_REBUILD_PROGRESS.md
📄 PRODUCTS_MODULE_SYSTEMATIC_PLAN.md
📄 PURCHASES_MODULE_SYSTEMATIC_PLAN.md
📄 SALES_MODULE_SYSTEMATIC_PLAN.md
```

**Example Implementation (Products Module):**
- See `PRODUCTS_MODULE_COMPLETE.md` for complete implementation guide
- See `src/app/components/products/ProductsPage.tsx` for reference
- See `src/app/services/productService.ts` for service pattern

**Figma Design Files:**
- Extract `Modern ERP POS System compete by figma 18-1-26.zip`
- Review design for each module
- Match components exactly

#### Development Commands:

```powershell
# Start development server
npm run dev

# Check for TypeScript errors
npm run build

# Check linting
npm run lint
```

#### Testing Checklist for Each Module:

- [ ] All CRUD operations work
- [ ] Three-dots menu actions functional
- [ ] Ledger integration works
- [ ] Accounting integration works
- [ ] Payment integration works (if applicable)
- [ ] Forms validate correctly
- [ ] Data persists in Supabase
- [ ] UI matches Figma design
- [ ] Responsive design works
- [ ] Error handling implemented

#### Git Workflow for Module Implementation:

```powershell
# Create feature branch
git checkout -b feature/contacts-module-complete

# Make changes
# ... implement module ...

# Commit changes
git add .
git commit -m "Complete Contacts module: Add edit form and remaining actions"

# Push branch
git push origin feature/contacts-module-complete

# Create Pull Request on GitHub
```

#### Getting Help:

1. **Check Implementation Guides:**
   - `figma-extract/IMPLEMENTATION_COMPLETE.md` - Complete system reference
   - `SYSTEM_REBUILD_PROGRESS.md` - Current status and remaining work

2. **Check Module-Specific Guides:**
   - `PRODUCTS_MODULE_COMPLETE.md` - Products module example
   - `PURCHASES_MODULE_COMPLETE.md` - Purchases module example
   - `SALES_MODULE_COMPLETE.md` - Sales module example

3. **Check Figma Extract Folder:**
   - `figma-extract/src/app/components/` - All component implementations
   - Compare with your implementation

4. **Check Existing Services:**
   - `src/app/services/productService.ts` - Service pattern
   - `src/app/services/saleService.ts` - Service pattern

5. **Check Existing Contexts:**
   - `src/app/context/SalesContext.tsx` - Context pattern
   - `src/app/context/PurchaseContext.tsx` - Context pattern

---

**Happy Coding on Windows! 🎉**

**Remember:** Figma design ko exactly follow karein. Windows ne design banaya hai, ab usko code mein implement karna hai!

**Last Updated**: January 2025
**Windows Version**: Windows 10/11
**Node.js Version**: 18+
