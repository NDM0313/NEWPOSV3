# 🍎 MacBook Setup Guide

**Complete guide to set up and run Din Collection ERP on MacBook**

---

## 📋 Prerequisites

### 1. Install Homebrew (Package Manager)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Node.js

```bash
# Using Homebrew
brew install node

# Or download from nodejs.org
# https://nodejs.org/
```

Verify installation:
```bash
node --version  # Should be v18 or higher
npm --version
```

### 3. Install Git

```bash
# Usually pre-installed, but if not:
brew install git

# Verify
git --version
```

---

## 🚀 Quick Setup

### Step 1: Clone Repository

```bash
cd ~/Desktop  # Or your preferred location
git clone https://github.com/NDM0313/NEWPOSV3.git
cd NEWPOSV3
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages. Wait for completion.

### Step 3: Create Environment File

```bash
touch .env.local
```

Open `.env.local` in your editor and add:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 4: Start Development Server

```bash
npm run dev
```

Open browser: `http://localhost:5173`

---

## 🗄 Database Setup (MacBook)

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **SQL Editor**
4. Run scripts in this order:
   - `supabase-extract/schema.sql`
   - `supabase-extract/functions.sql`
   - `supabase-extract/rls-policies.sql`

### Option 2: Using psql (Command Line)

#### Install PostgreSQL Client

```bash
brew install postgresql@15
```

#### Connect to Supabase

```bash
# Set connection string
export PGHOST="aws-1-ap-southeast-1.pooler.supabase.com"
export PGPORT="6543"
export PGDATABASE="postgres"
export PGUSER="postgres.pcxfwmbcjrkgzibgdrlz"
export PGPASSWORD="your-password"

# Run SQL scripts
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f supabase-extract/schema.sql
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f supabase-extract/functions.sql
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f supabase-extract/rls-policies.sql
```

---

## 🛠 Development Commands

```bash
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

## 🔧 MacBook-Specific Tips

### 1. Terminal Setup

**Recommended Terminal**: iTerm2
```bash
brew install --cask iterm2
```

**Recommended Shell**: Zsh (default on macOS)
```bash
# Install Oh My Zsh (optional)
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### 2. Code Editor

**VS Code** (Recommended):
```bash
brew install --cask visual-studio-code
```

**Cursor** (AI-powered):
- Download from [cursor.sh](https://cursor.sh/)

### 3. Git Configuration

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 4. Port Management

If port 5173 is busy:
```bash
# Find process using port
lsof -i :5173

# Kill process
kill -9 <PID>
```

---

## 📦 Package Management

### Using npm (Default)

```bash
npm install <package>
npm uninstall <package>
npm update
```

### Using yarn (Alternative)

```bash
# Install yarn
npm install -g yarn

# Use yarn
yarn install
yarn add <package>
yarn remove <package>
```

---

## 🔐 Environment Variables

### Create `.env.local`

```bash
# In project root
touch .env.local
```

### Add Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://pcxfwmbcjrkgzibgdrlz.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**⚠️ Important**: Never commit `.env.local` to Git!

---

## 🐛 Troubleshooting

### Issue 1: Permission Denied

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Issue 2: Node Version Mismatch

```bash
# Use nvm (Node Version Manager)
brew install nvm
nvm install 18
nvm use 18
```

### Issue 3: Port Already in Use

```bash
# Find and kill process
lsof -ti:5173 | xargs kill -9
```

### Issue 4: Module Not Found

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue 5: Git Authentication

```bash
# Use SSH instead of HTTPS
git remote set-url origin git@github.com:NDM0313/NEWPOSV3.git

# Generate SSH key (if needed)
ssh-keygen -t ed25519 -C "your.email@example.com"
# Add to GitHub: Settings → SSH and GPG keys
```

---

## 📱 Recommended Tools

### Development Tools

1. **VS Code Extensions**:
   - ESLint
   - Prettier
   - Tailwind CSS IntelliSense
   - TypeScript Vue Plugin

2. **Browser Extensions**:
   - React Developer Tools
   - Redux DevTools

3. **Database Tools**:
   - TablePlus (GUI for PostgreSQL)
   - DBeaver (Free alternative)

### Install TablePlus

```bash
brew install --cask tableplus
```

---

## 🔄 Git Workflow

### Daily Workflow

```bash
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

### Branch Workflow

```bash
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

```bash
npm run build
```

Output will be in `dist/` folder.

### Deploy Options

1. **Vercel** (Recommended):
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Netlify**:
   - Connect GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **GitHub Pages**:
   - Use `gh-pages` package
   - Configure in `package.json`

---

## 📝 Notes

- **Line Endings**: Git is configured to handle CRLF/LF automatically
- **File Permissions**: macOS handles file permissions automatically
- **Path Separators**: Use `/` in all paths (macOS uses Unix-style paths)
- **Case Sensitivity**: macOS file system is case-insensitive by default

---

## ✅ Verification Checklist

- [ ] Node.js installed (v18+)
- [ ] Git installed and configured
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` created with Supabase credentials
- [ ] Database schema applied
- [ ] Development server runs (`npm run dev`)
- [ ] Application opens in browser
- [ ] Can login/create business
- [ ] Products module works
- [ ] Purchases module works
- [ ] Sales module works

---

## 🆘 Getting Help

1. Check [README.md](./README.md) for general info
2. Check module-specific guides:
   - `PRODUCTS_MODULE_COMPLETE.md`
   - `PURCHASES_MODULE_COMPLETE.md`
   - `SALES_MODULE_COMPLETE.md`
3. Check [GitHub Issues](https://github.com/NDM0313/NEWPOSV3/issues)
4. Review error messages in browser console
5. Check Supabase logs in dashboard

---

**Happy Coding! 🎉**
