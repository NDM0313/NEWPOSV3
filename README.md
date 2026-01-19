# 🏢 Din Collection ERP - Complete POS System

**Modern ERP & POS System with Supabase Backend**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/NDM0313/NEWPOSV3)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-green)](https://github.com/NDM0313/NEWPOSV3)

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Module Status](#module-status)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## ✨ Features

### ✅ Completed Modules (100%)

1. **Products Module**
   - Full CRUD operations
   - Product variations & packing
   - Stock management
   - Price adjustments
   - Barcode support
   - Category management

2. **Purchases Module**
   - Purchase order management
   - Supplier management
   - Payment tracking
   - Stock receiving
   - Ledger integration

3. **Sales Module**
   - Invoice generation
   - Customer management
   - Payment receiving
   - Shipping status tracking
   - Ledger integration

### 🚧 In Progress Modules

- Contacts Module (Partially Complete)
- Inventory Module
- Rentals Module
- Studio Production Module
- Expenses Module
- Accounting Module
- Reports Module
- Settings Module

---

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Backend**: Supabase (PostgreSQL)
- **State Management**: React Context API
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Icons**: Lucide React
- **Build Tool**: Vite

---

## 📦 Prerequisites

### For Windows:
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- PowerShell 5.1+

### For MacBook:
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- Terminal (Built-in)

### For Linux:
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- Bash

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/NDM0313/NEWPOSV3.git
cd NEWPOSV3
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Setup

Create a `.env.local` file in the root directory:

```bash
# For Windows (PowerShell)
New-Item -Path .env.local -ItemType File

# For MacBook/Linux
touch .env.local
```

Add the following environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Get your Supabase credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy Project URL and anon/public key
5. Copy service_role key (keep it secret!)

---

## 🗄 Database Setup

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to SQL Editor
4. Run the following scripts in order:

   - `supabase-extract/schema.sql` - Creates all tables
   - `supabase-extract/functions.sql` - Creates functions & triggers
   - `supabase-extract/rls-policies.sql` - Sets up Row Level Security
   - `supabase-extract/seed.sql` - (Optional) Demo data

### Option 2: Using psql (Command Line)

#### For MacBook/Linux:

```bash
# Set environment variables
export PGHOST=your-supabase-host
export PGPORT=6543
export PGDATABASE=postgres
export PGUSER=postgres.pcxfwmbcjrkgzibgdrlz
export PGPASSWORD=your-password

# Run SQL scripts
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f supabase-extract/schema.sql
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f supabase-extract/functions.sql
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f supabase-extract/rls-policies.sql
```

#### For Windows (PowerShell):

```powershell
# Set environment variables
$env:PGHOST="your-supabase-host"
$env:PGPORT="6543"
$env:PGDATABASE="postgres"
$env:PGUSER="postgres.pcxfwmbcjrkgzibgdrlz"
$env:PGPASSWORD="your-password"

# Run SQL scripts
psql -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -f supabase-extract/schema.sql
```

---

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

The application will start at: `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## 📊 Module Status

| Module | Status | Features |
|--------|--------|----------|
| Products | ✅ 100% | CRUD, Variations, Stock, Pricing |
| Purchases | ✅ 100% | PO Management, Payments, Ledger |
| Sales | ✅ 100% | Invoices, Payments, Shipping |
| Contacts | 🟡 80% | CRUD, Payments, Ledger |
| Inventory | 🟡 60% | Dashboard, Stock Tracking |
| Rentals | 🟡 50% | Booking, Management |
| Studio | 🟡 50% | Production, Workers |
| Expenses | 🟡 50% | Tracking, Categories |
| Accounting | 🟡 50% | Entries, Reports |
| Reports | 🟡 40% | Dashboards, Charts |
| Settings | 🟡 60% | Company, Users, Permissions |

---

## 📁 Project Structure

```
NEWPOSV3/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── auth/          # Authentication
│   │   │   ├── contacts/      # Contacts module
│   │   │   ├── products/      # Products module ✅
│   │   │   ├── purchases/     # Purchases module ✅
│   │   │   ├── sales/         # Sales module ✅
│   │   │   ├── inventory/     # Inventory module
│   │   │   ├── rentals/       # Rentals module
│   │   │   ├── studio/        # Studio module
│   │   │   ├── expenses/      # Expenses module
│   │   │   ├── accounting/    # Accounting module
│   │   │   ├── reports/       # Reports module
│   │   │   ├── settings/      # Settings module
│   │   │   ├── pos/           # POS system
│   │   │   ├── layout/        # Layout components
│   │   │   ├── shared/        # Shared components
│   │   │   └── ui/            # UI components
│   │   ├── context/           # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/           # API services
│   │   └── utils/              # Utilities
│   └── lib/
│       └── supabase.ts         # Supabase client
├── supabase-extract/           # Database scripts
├── .env.local                  # Environment variables
├── package.json
└── README.md
```

---

## 🔧 Development Workflow

### Working from MacBook

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NDM0313/NEWPOSV3.git
   cd NEWPOSV3
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Git Workflow

```bash
# Check status
git status

# Add changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. **Port Already in Use**
```bash
# Kill process on port 5173 (MacBook/Linux)
lsof -ti:5173 | xargs kill -9

# Or change port in vite.config.ts
```

#### 2. **Supabase Connection Error**
- Check `.env.local` file exists
- Verify Supabase URL and keys are correct
- Check internet connection
- Verify Supabase project is active

#### 3. **Module Not Found Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 4. **Database Connection Issues**
- Verify Supabase credentials
- Check RLS policies are set correctly
- Ensure database schema is applied

---

## 📝 Environment Variables Reference

```env
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional (for admin operations)
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👥 Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/NDM0313/NEWPOSV3/issues)
- Check documentation in `/docs` folder
- Review module-specific guides in root directory

---

## 🎯 Next Steps

1. Complete remaining modules (Contacts, Inventory, etc.)
2. Add comprehensive testing
3. Optimize performance
4. Add more reports and analytics
5. Mobile app development

---

**Last Updated**: January 2025
**Version**: 3.0.0
**Status**: Production Ready (Core Modules)
