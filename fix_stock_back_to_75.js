// Quick fix: Set Bridal Jewelry Set stock back to 75
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fixStock() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    // Find and fix Bridal Jewelry Set
    const { rows } = await client.query(`
      UPDATE products
      SET current_stock = 75.00
      WHERE (name ILIKE '%bridal jewelry%' OR sku ILIKE '%BJ-SET%')
      RETURNING id, name, sku, current_stock
    `);

    if (rows.length > 0) {
      console.log('✅ Stock fixed:');
      rows.forEach(p => {
        console.log(`   ${p.name} (${p.sku}): ${p.current_stock}`);
      });
    } else {
      console.log('❌ Product not found');
    }

    // Verify balance
    const { rows: verify } = await client.query(`
      SELECT 
        p.name,
        p.current_stock as dashboard_stock,
        COALESCE(SUM(sm.quantity), 0) as calculated_balance
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE (p.name ILIKE '%bridal jewelry%' OR p.sku ILIKE '%BJ-SET%')
      GROUP BY p.id, p.name, p.current_stock
    `);

    if (verify.length > 0) {
      const v = verify[0];
      const diff = parseFloat(v.dashboard_stock) - parseFloat(v.calculated_balance);
      console.log('\n📊 Balance Check:');
      console.log(`   Dashboard: ${v.dashboard_stock}`);
      console.log(`   Calculated: ${v.calculated_balance}`);
      console.log(`   Difference: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}`);
      console.log(`   Status: ${Math.abs(diff) < 0.01 ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
  }
}

fixStock();
