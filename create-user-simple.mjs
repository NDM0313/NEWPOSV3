// ============================================
// CREATE DEMO USER - SIMPLE VERSION
// ============================================
// This version uses fetch API (no dependencies)
// Run: node create-user-simple.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local
let supabaseUrl = '';
let serviceRoleKey = '';

try {
  const envFile = readFileSync(join(__dirname, '.env.local'), 'utf8');
  const lines = envFile.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=') || line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      serviceRoleKey = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error('❌ Error reading .env.local file');
  process.exit(1);
}

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL not found');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  console.error('');
  console.error('Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

async function createUser() {
  console.log('');
  console.log('Creating user: admin@dincollection.com');
  console.log('');

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@dincollection.com',
        password: 'admin123',
        email_confirm: true,
        user_metadata: {
          full_name: 'Admin User',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.error?.message?.includes('already registered')) {
        console.log('✅ User already exists');
      } else {
        throw new Error(data.error?.message || 'Failed to create user');
      }
    } else {
      console.log('✅ User created successfully!');
      console.log('   User ID:', data.user?.id);
    }

    // Link to database
    console.log('');
    console.log('Linking to database...');
    
    const linkResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: data.user?.id || '00000000-0000-0000-0000-000000000001',
        company_id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@dincollection.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
      }),
    });

    if (linkResponse.ok) {
      console.log('✅ Linked to database');
    } else {
      console.log('⚠️  Could not link to database (may already exist)');
    }

    console.log('');
    console.log('✅ Done! You can now login.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Manual steps:');
    console.error('  1. Supabase Dashboard → Authentication → Users');
    console.error('  2. Add user: admin@dincollection.com / admin123');
    console.error('');
  }
}

createUser();
