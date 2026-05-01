import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('purchases')
    .select('total, subtotal, discount_amount, shipping_cost, tax_amount, purchase_charges')
    .limit(1);
  console.log("Error:", error);
}
run();
