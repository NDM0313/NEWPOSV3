// ============================================
// CREATE DEMO USER IN SUPABASE AUTH
// ============================================
// Run this script to automatically create the demo user
// Usage: node create-user.js

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: VITE_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.error('');
  console.error('📝 To get your Service Role Key:');
  console.error('   1. Go to Supabase Dashboard');
  console.error('   2. Project Settings → API');
  console.error('   3. Copy "service_role" key (NOT anon key!)');
  console.error('   4. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your-key-here');
  console.error('');
  console.error('⚠️  WARNING: Service Role Key is SECRET - never commit to Git!');
  process.exit(1);
}

// Create admin client (with service role key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createDemoUser() {
  console.log('');
  console.log('============================================');
  console.log('  Creating Demo User in Supabase Auth');
  console.log('============================================');
  console.log('');

  const email = 'admin@dincollection.com';
  const password = 'admin123';

  try {
    // Create user using Admin API
    console.log('📧 Creating user:', email);
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'Admin User',
        role: 'admin',
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('✅ User already exists in Auth');
        console.log('   Attempting to link with database...');
      } else {
        throw authError;
      }
    } else {
      console.log('✅ User created in Supabase Auth');
      console.log('   User ID:', authUser.user.id);
    }

    // Get user ID (either new or existing)
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const user = existingUser?.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('User not found after creation');
    }

    const userId = user.id;

    // Link to public.users table
    console.log('');
    console.log('🔗 Linking to database...');
    
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        company_id: '00000000-0000-0000-0000-000000000001',
        email: email,
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
      }, {
        onConflict: 'id',
      });

    if (dbError) {
      console.error('⚠️  Warning: Could not link to database:', dbError.message);
      console.log('   You may need to run the SQL script manually');
    } else {
      console.log('✅ User linked to database');
    }

    console.log('');
    console.log('============================================');
    console.log('  ✅ SUCCESS! User Created');
    console.log('============================================');
    console.log('');
    console.log('Login Credentials:');
    console.log('  Email: admin@dincollection.com');
    console.log('  Password: admin123');
    console.log('');
    console.log('🚀 You can now login to the application!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error creating user:', error.message);
    console.error('');
    console.error('Alternative: Create user manually in Supabase Dashboard');
    console.error('  1. Go to: https://supabase.com/dashboard');
    console.error('  2. Authentication → Users → Add user');
    console.error('  3. Email: admin@dincollection.com');
    console.error('  4. Password: admin123');
    console.error('  5. Auto Confirm: Yes');
    console.error('');
    process.exit(1);
  }
}

createDemoUser();
