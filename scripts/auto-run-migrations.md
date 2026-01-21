# Automatic Migration Runner

## Overview
Ab app automatically SQL migrations run karta hai via Supabase MCP server. Manual SQL Editor me jaane ki zaroorat nahi.

## How It Works
1. Jab bhi migration file `migrations/` folder me add hoti hai
2. AI assistant automatically `mcp_supabase_apply_migration` use karke migration apply kar deta hai
3. Verification queries bhi automatically run hoti hain

## Migration File Format
```sql
-- migrations/your_migration_name.sql
-- Migration description

UPDATE table_name SET column = value WHERE condition;

-- Verification query
SELECT COUNT(*) FROM table_name WHERE condition;
```

## Recent Migrations Applied
✅ `fix_stock_movements_company_id` - Fixed company_id mismatches in stock_movements table

## Connection Details
- **Database**: Supabase PostgreSQL
- **Connection**: Auto via MCP server
- **No manual SQL Editor needed**

## Future Migrations
Jab bhi naya migration file banega, automatically apply ho jayega. Sirf migration file create karein, baaki kaam automatically ho jayega.
