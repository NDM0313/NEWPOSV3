// Fix adjustment company_id to match the correct company
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fixCompanyId() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    const productId = '18fa8e97-86cd-41ce-afa5-ced19edf513c';
    const wrongCompanyId = '39282972-52f9-4a55-88ea-d2b72f3daef3';
    const correctCompanyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

    console.log('📋 Fixing adjustment company_id...\n');
    console.log(`Product ID: ${productId.substring(0, 8)}...`);
    console.log(`Wrong Company: ${wrongCompanyId.substring(0, 8)}...`);
    console.log(`Correct Company: ${correctCompanyId.substring(0, 8)}...\n`);

    // Find the adjustment first
    const { rows: found } = await client.query(`
      SELECT id, company_id, quantity, movement_type
      FROM stock_movements
      WHERE product_id = $1
      AND company_id = $2
      AND movement_type = 'adjustment'
      LIMIT 1
    `, [productId, wrongCompanyId]);

    if (found.length === 0) {
      console.log('❌ Adjustment with wrong company_id not found\n');
      await client.end();
      return;
    }

    console.log(`Found adjustment: ${found[0].id.substring(0, 8)}... (qty: ${found[0].quantity})\n`);

    // Update company_id
    const { rows: updated } = await client.query(`
      UPDATE stock_movements
      SET company_id = $1
      WHERE id = $2
      RETURNING id, company_id, quantity, movement_type
    `, [correctCompanyId, found[0].id]);

    if (updated.length > 0) {
      console.log('✅ Adjustment updated:');
      console.log(`   ID: ${updated[0].id.substring(0, 8)}...`);
      console.log(`   Company: ${updated[0].company_id.substring(0, 8)}...`);
      console.log(`   Quantity: ${updated[0].quantity}`);
      console.log(`   Type: ${updated[0].movement_type}\n`);
    } else {
      console.log('❌ Adjustment not found\n');
    }

    // Verify
    const { rows: verify } = await client.query(`
      SELECT 
        p.current_stock as dashboard_stock,
        COALESCE(SUM(sm.quantity), 0) as calculated_balance
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.company_id = $1
      WHERE p.id = $2
      GROUP BY p.id, p.current_stock
    `, [correctCompanyId, productId]);

    if (verify.length > 0) {
      const v = verify[0];
      const diff = parseFloat(v.dashboard_stock) - parseFloat(v.calculated_balance);
      console.log('📊 Verification:');
      console.log(`   Dashboard: ${v.dashboard_stock}`);
      console.log(`   Calculated: ${v.calculated_balance}`);
      console.log(`   Difference: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}`);
      console.log(`   Status: ${Math.abs(diff) < 0.01 ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    }

    // Count adjustments
    const { rows: adjCount } = await client.query(`
      SELECT COUNT(*) as count
      FROM stock_movements
      WHERE product_id = $1
      AND company_id = $2
      AND movement_type = 'adjustment'
    `, [productId, correctCompanyId]);

    console.log(`📊 Adjustments with correct company: ${adjCount[0].count}\n`);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
  }
}

fixCompanyId();
