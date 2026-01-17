# User Management Module Documentation

## 1. Module Name & Overview
**Module**: User Management
**Purpose**: Handles system access control, creating staff accounts, assigning roles (Admin, Manager, Cashier), and monitoring user activity/login status.

## 2. UI Architecture (Tailwind & Shadcn)

### General Style Guide
- **Cards**: `GlassCard` style with `backdrop-blur-md` and `bg-white/5`.
- **Table**: Standardized dark table with `hover:bg-gray-800/50`.

### Components

#### Stats Section
- **Cards**: 3 Cards (Total Users, Active Users, Logged In Today).
- **Icons**: Large, opacity-10 background icons (`Users`, `UserCheck`, `LogIn`).
- **Typography**: Value is `text-3xl font-bold`.

#### User Table
- **Avatar**: `dicebear` generated avatars with fallback initials.
- **Role Badges**:
  - Admin: `bg-red-500/10 text-red-400`.
  - Manager: `bg-purple-500/10 text-purple-400`.
  - Default: `bg-blue-500/10 text-blue-400`.
- **Status Pills**:
  - Active: `bg-green-500/10 text-green-500`.
  - Inactive: `bg-gray-800 text-gray-400`.

#### Actions
- **Add User Button**: Blue, shadowed (`shadow-blue-500/20`).
- **Row Actions**: Dropdown Menu (View, Edit, Delete).

## 3. Data & Schema

### User Entity (`profiles` table in Supabase)
- `id` (UUID, PK) - Links to `auth.users`.
- `full_name` (Text).
- `role` (Enum: 'admin', 'manager', 'cashier', 'inventory_clerk').
- `location` (Text) - Branch assignment.
- `status` (Enum: 'active', 'inactive', 'suspended').
- `last_login` (Timestamp).
- `avatar_url` (Text, Optional).

## 4. Interaction & Business Logic

### Creating a User
1. **Action**: Click "Create New User".
2. **Drawer**: Opens `AddUserDrawer` (implied in code via `openDrawer('addUser')`).
3. **Process**:
   - Step 1: Create auth user via Supabase Admin API (email/password).
   - Step 2: Create profile record in `public.profiles`.

### Role Management
- **Admin**: Full access.
- **Manager**: Can manage staff, override prices.
- **Cashier**: POS access only.
- **Inventory Clerk**: Products/Stock access only.

## 5. Edge Cases & Validations

- **Self-Deletion**: A user cannot delete their own account.
- **Duplicate Email**: handled by Supabase Auth.
- **Last Admin**: System must prevent deleting the last Admin account.

## 6. API/Supabase Requirements

- **Auth**: Supabase Auth for login/session.
- **RLS**:
  - `profiles`: Readable by authenticated users. Writable only by Admins.
