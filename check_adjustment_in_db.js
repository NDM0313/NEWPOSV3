// Check if adjustment exists in database and why it's not being fetched
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkAdjustment() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    const productId = '18fa8e97-86cd-41ce-afa5-ced19edf513c';
    const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

    console.log('📋 Checking all stock movements for product...\n');
    console.log(`Product ID: ${productId}`);
    console.log(`Company ID: ${companyId}\n`);

    // Check all movements
    const { rows: allMovements } = await client.query(`
      SELECT 
        id,
        company_id,
        product_id,
        movement_type,
        quantity,
        created_at,
        notes
      FROM stock_movements
      WHERE product_id = $1
      ORDER BY created_at DESC
    `, [productId]);

    console.log(`Total movements in DB: ${allMovements.length}\n`);

    allMovements.forEach((m, i) => {
      const type = m.movement_type || 'unknown';
      console.log(`${i + 1}. ID: ${m.id.substring(0, 8)}...`);
      console.log(`   Type: ${type}`);
      console.log(`   Quantity: ${m.quantity}`);
      console.log(`   Company ID: ${m.company_id}`);
      console.log(`   Created: ${m.created_at}`);
      console.log(`   Notes: ${m.notes || 'N/A'}`);
      console.log(`   Company Match: ${m.company_id === companyId ? '✅' : '❌'}`);
      console.log('');
    });

    // Check specifically for adjustments
    const { rows: adjustments } = await client.query(`
      SELECT 
        id,
        company_id,
        product_id,
        movement_type,
        quantity,
        created_at
      FROM stock_movements
      WHERE product_id = $1
      AND movement_type = 'adjustment'
      ORDER BY created_at DESC
    `, [productId]);

    console.log(`\n📊 Adjustments found: ${adjustments.length}`);
    adjustments.forEach(a => {
      console.log(`   ID: ${a.id.substring(0, 8)}...`);
      console.log(`   Quantity: ${a.quantity}`);
      console.log(`   Company: ${a.company_id}`);
      console.log(`   Match: ${a.company_id === companyId ? '✅' : '❌'}`);
    });

    // Check with company filter (like the query does)
    const { rows: filteredMovements } = await client.query(`
      SELECT 
        id,
        movement_type,
        quantity,
        company_id
      FROM stock_movements
      WHERE product_id = $1
      AND company_id = $2
      ORDER BY created_at DESC
    `, [productId, companyId]);

    console.log(`\n📊 Movements with company filter (${companyId}): ${filteredMovements.length}`);
    filteredMovements.forEach(m => {
      const type = m.movement_type || 'unknown';
      console.log(`   ${type}: ${m.quantity} (ID: ${m.id.substring(0, 8)}...)`);
    });

    // Calculate balance
    const { rows: balance } = await client.query(`
      SELECT 
        SUM(quantity) as total
      FROM stock_movements
      WHERE product_id = $1
      AND company_id = $2
    `, [productId, companyId]);

    console.log(`\n📊 Calculated Balance: ${balance[0].total || 0}`);

    // Check product current_stock
    const { rows: product } = await client.query(`
      SELECT current_stock FROM products WHERE id = $1
    `, [productId]);

    console.log(`📊 Dashboard Stock: ${product[0]?.current_stock || 0}`);
    console.log(`📊 Difference: ${(product[0]?.current_stock || 0) - (balance[0].total || 0)}\n`);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
  }
}

checkAdjustment();
