import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Checking session...");
  // Use user from database
  const { data: { users } } = await supabase.auth.admin?.listUsers() || { data: { users: [] } };
  
  console.log("Done");
}
run();
