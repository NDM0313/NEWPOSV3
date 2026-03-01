# ERP Standard Permission Architecture

A comprehensive 4-layer permission system for Enterprise Resource Planning (ERP) applications built with React, TypeScript, and Tailwind CSS.

## 🎯 Overview

This system implements a robust permission architecture that manages access control across multiple dimensions:
- **Role-based access control** (4 hierarchical roles)
- **Branch-level access** (multi-location support)
- **Module-level permissions** (8 business modules)
- **Row-level security** (visibility rules)

## 🏗️ Architecture

### 4-Layer Permission System

1. **Role Layer**
   - Owner: Full company access, all privileges
   - Admin: Company-wide management capabilities
   - Manager: Branch-level oversight
   - Salesman: Individual/branch-level operations

2. **Branch Access Layer**
   - Multi-branch assignment per user
   - Location-based data filtering
   - Hierarchical branch visibility

3. **Module Permissions Layer**
   - Sales Management
   - Payment Processing
   - Ledger Access
   - Inventory Control
   - Accounts Management
   - Reports & Analytics
   - User Management
   - System Settings

4. **Visibility Rules (RLS)**
   - Company-wide: View all data across organization
   - Branch-level: View data from assigned branches
   - Own data: View only self-created records

## 🎨 Features

### 6 Main Sections

#### 1. Dashboard
- Role hierarchy visualization
- Statistics and metrics
- Permission distribution charts
- Real-time system overview
- Dark mode support

#### 2. Roles Management
- Capability matrix for all roles
- Hierarchical level system (Level 1-4)
- Role descriptions and icons
- Permission comparison view

#### 3. Permissions Matrix
- Interactive permission table
- Real-time permission toggling
- Module-wise permission control
- Action-level granularity (view, create, edit, delete)
- Visual permission indicators

#### 4. Users Management
- Complete user directory
- Role assignment interface
- Branch allocation per user
- User activation/deactivation
- Email and contact management

#### 5. Branch Access
- Visual branch representation
- Geographic distribution
- User-to-branch mapping
- Branch status management
- Multi-branch assignment interface

#### 6. RLS Simulator
- Row-Level Security policy testing
- Real-time visibility simulation
- Sample data with different ownership
- Role-based filtering demonstration
- Policy validation tool

## 🎨 Design System

### Color Scheme

- **Emerald/Green** (#10b981): Primary actions, success states, Owner role
- **Purple** (#8b5cf6): Branches, secondary information
- **Blue** (#3b82f6): User icons, edit actions, Admin role
- **Orange** (#f97316): Salesman role, warnings
- **Amber** (#f59e0b): Manager role
- **Red** (#ef4444): Errors, delete actions, critical operations
- **Slate/Gray**: Neutral elements, backgrounds, borders

### Dark Mode
- Full dark mode support across all components
- Consistent color contrast ratios
- Smooth theme transitions
- System preference detection

## 👥 Role Hierarchy

### Level 4 - Owner 👑
- **Access**: Full company access
- **Branches**: All branches
- **Modules**: All modules with full permissions
- **Special**: Override capabilities, system configuration
- **Color**: Emerald Green

### Level 3 - Admin 🛡️
- **Access**: Company-wide
- **Branches**: All assigned branches
- **Modules**: Full access except critical system settings
- **Special**: User management, system configuration
- **Color**: Blue

### Level 2 - Manager 📊
- **Access**: Branch-level
- **Branches**: Specific assigned branches
- **Modules**: Sales, Payments, Ledger, Inventory, Reports
- **Restrictions**: Cannot manage users or access company-wide data
- **Color**: Amber

### Level 1 - Salesman 💼
- **Access**: Own/Branch-level (configurable)
- **Branches**: Assigned branches only
- **Modules**: Sales (own), Payments (receive), Ledger (own)
- **Restrictions**: Limited edit/delete capabilities
- **Color**: Orange

## 🚀 Technology Stack

- **Frontend**: React 18+ with TypeScript
- **Routing**: React Router v7 (Data Mode)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **State Management**: React Context API
- **Build Tool**: Vite

## 📦 Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── Header.tsx          # Top navigation with icons
│   │   ├── Layout.tsx          # Main layout wrapper
│   │   └── Modal.tsx           # Reusable modal component
│   ├── context/
│   │   ├── DataContext.tsx     # Global data state
│   │   └── ThemeContext.tsx    # Dark mode state
│   ├── data/
│   │   └── mockData.ts         # Sample data (roles, users, branches)
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── RolesManagement.tsx
│   │   ├── PermissionsMatrix.tsx
│   │   ├── UsersManagement.tsx
│   │   ├── BranchAccess.tsx
│   │   └── RLSSimulator.tsx
│   ├── types/
│   │   └── permission.ts       # TypeScript interfaces
│   ├── App.tsx
│   └── routes.tsx
├── styles/
│   ├── index.css
│   ├── tailwind.css
│   └── theme.css
└── imports/                     # Figma imports (if any)
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ or 20+
- pnpm (recommended) or npm

### Install Dependencies
```bash
pnpm install
# or
npm install
```

### Run Development Server
```bash
pnpm dev
# or
npm run dev
```

### Build for Production
```bash
pnpm build
# or
npm run build
```

## 📖 Usage Guide

### Permission Management

1. **Viewing Permissions**
   - Navigate to "Permissions Matrix"
   - View all roles and their module permissions
   - Toggle permissions using the interactive switches

2. **Managing Users**
   - Go to "Users Management"
   - Add new users with role assignment
   - Assign branches to users
   - Activate/deactivate user accounts

3. **Configuring Branches**
   - Access "Branch Access" section
   - View branch distribution
   - Assign users to branches
   - Monitor branch activity

4. **Testing RLS Policies**
   - Open "RLS Simulator"
   - Select a role to simulate
   - View filtered data based on visibility rules
   - Validate row-level security implementation

### Navigation

The system uses a modern top header navigation with icon-based menu:
- 🏠 Dashboard
- 🛡️ Roles
- ⊞ Matrix
- 👥 Users
- 🏢 Branch
- </> RLS

## 🔒 Security Features

- Role-based access control (RBAC)
- Row-level security (RLS) policies
- Branch-level data isolation
- Action-level permissions
- Hierarchical role system
- Real-time permission validation

## 📊 Data Structure

### User Object
```typescript
{
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'salesman';
  branches: string[];
  active: boolean;
}
```

### Permission Object
```typescript
{
  role: string;
  module: string;
  action: string;
  allowed: boolean;
}
```

### Branch Object
```typescript
{
  id: string;
  name: string;
  code: string;
  location: string;
  active: boolean;
}
```

## 🎯 Key Features Highlights

✅ 4-layer permission architecture  
✅ Interactive permissions matrix  
✅ Real-time role simulation  
✅ Multi-branch support  
✅ Dark mode throughout  
✅ Responsive design  
✅ TypeScript type safety  
✅ Modern UI/UX  
✅ Comprehensive documentation  
✅ Easy to extend and customize  

## 🔄 Customization

### Adding New Roles
1. Update `roleConfigs` in `/src/app/data/mockData.ts`
2. Add permission mappings in `defaultPermissions`
3. Update TypeScript types in `/src/app/types/permission.ts`

### Adding New Modules
1. Add module to permission matrix
2. Define actions for the module
3. Set default permissions per role
4. Update UI components as needed

### Modifying Color Scheme
- Primary colors are defined in `/src/styles/theme.css`
- Update component-specific colors in individual page files
- Maintain consistency with the established color system

## 📝 License

This project is provided as-is for educational and demonstration purposes.

## 🤝 Contributing

This is a demonstration project. Feel free to fork and modify for your own use cases.

## 📧 Support

For questions or issues, refer to the inline documentation and comments throughout the codebase.

---

**Built with ❤️ using React + TypeScript + Tailwind CSS**
