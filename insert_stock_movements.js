// Script to insert test stock movements data
// Run with: node insert_stock_movements.js

import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const COMPANY_ID = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';
const PRODUCT_ID = '18fa8e97-86cd-41ce-afa5-ced19edf513c';

async function insertTestData() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Step 1: Get branch_id for the company
    console.log('\n📋 Step 1: Getting branch_id for company...');
    const branchResult = await client.query(
      `SELECT id, name FROM branches 
       WHERE company_id = $1 
       ORDER BY name 
       LIMIT 1`,
      [COMPANY_ID]
    );

    if (branchResult.rows.length === 0) {
      console.error('❌ No branch found for company:', COMPANY_ID);
      await client.end();
      return;
    }

    const branchId = branchResult.rows[0].id;
    const branchName = branchResult.rows[0].name;
    console.log(`✅ Found branch: ${branchName} (${branchId})`);

    // Step 2: Check if product exists
    console.log('\n📋 Step 2: Verifying product exists...');
    const productResult = await client.query(
      `SELECT id, name, sku FROM products WHERE id = $1`,
      [PRODUCT_ID]
    );

    if (productResult.rows.length === 0) {
      console.error('❌ Product not found:', PRODUCT_ID);
      await client.end();
      return;
    }

    const product = productResult.rows[0];
    console.log(`✅ Found product: ${product.name} (${product.sku})`);

    // Step 3: Check existing movements
    console.log('\n📋 Step 3: Checking existing movements...');
    const existingResult = await client.query(
      `SELECT COUNT(*) as count FROM stock_movements 
       WHERE product_id = $1 AND company_id = $2`,
      [PRODUCT_ID, COMPANY_ID]
    );
    const existingCount = parseInt(existingResult.rows[0].count);
    console.log(`📊 Existing movements: ${existingCount}`);

    // Step 4: Insert test movements
    console.log('\n📋 Step 4: Inserting test movements...');

    // Movement 1: Purchase (IN) - Today
    const insert1 = await client.query(
      `INSERT INTO stock_movements (
        id, company_id, branch_id, product_id, movement_type, 
        quantity, unit_cost, total_cost, reference_type, reference_id, 
        notes, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'purchase',
        50.00, 100.00, 5000.00, 'purchase', gen_random_uuid(),
        'Test purchase movement for verification', NOW()
      ) RETURNING id, quantity, movement_type, created_at`,
      [COMPANY_ID, branchId, PRODUCT_ID]
    );
    console.log(`✅ Inserted Purchase: +${insert1.rows[0].quantity} units (${insert1.rows[0].id.substring(0, 8)}...)`);

    // Movement 2: Sale (OUT) - Today
    const insert2 = await client.query(
      `INSERT INTO stock_movements (
        id, company_id, branch_id, product_id, movement_type,
        quantity, unit_cost, total_cost, reference_type, reference_id,
        notes, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'sale',
        -20.00, 150.00, -3000.00, 'sale', gen_random_uuid(),
        'Test sale movement for verification', NOW()
      ) RETURNING id, quantity, movement_type, created_at`,
      [COMPANY_ID, branchId, PRODUCT_ID]
    );
    console.log(`✅ Inserted Sale: ${insert2.rows[0].quantity} units (${insert2.rows[0].id.substring(0, 8)}...)`);

    // Movement 3: Purchase (IN) - Yesterday
    const insert3 = await client.query(
      `INSERT INTO stock_movements (
        id, company_id, branch_id, product_id, movement_type,
        quantity, unit_cost, total_cost, reference_type, reference_id,
        notes, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'purchase',
        30.00, 110.00, 3300.00, 'purchase', gen_random_uuid(),
        'Test purchase movement 2', NOW() - INTERVAL '1 day'
      ) RETURNING id, quantity, movement_type, created_at`,
      [COMPANY_ID, branchId, PRODUCT_ID]
    );
    console.log(`✅ Inserted Purchase: +${insert3.rows[0].quantity} units (${insert3.rows[0].id.substring(0, 8)}...)`);

    // Step 5: Verify inserted data
    console.log('\n📋 Step 5: Verifying inserted data...');
    const verifyResult = await client.query(
      `SELECT 
        id, movement_type, quantity, unit_cost, total_cost, 
        reference_type, created_at
       FROM stock_movements
       WHERE product_id = $1 AND company_id = $2
       ORDER BY created_at DESC`,
      [PRODUCT_ID, COMPANY_ID]
    );

    console.log(`\n✅ Total movements now: ${verifyResult.rows.length}`);
    console.log('\n📊 Movement Details:');
    verifyResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.movement_type.toUpperCase()}: ${row.quantity > 0 ? '+' : ''}${row.quantity} units (${new Date(row.created_at).toLocaleString()})`);
    });

    // Calculate totals
    const totals = verifyResult.rows.reduce((acc, row) => {
      const qty = parseFloat(row.quantity);
      if (qty > 0) acc.in += qty;
      else acc.out += Math.abs(qty);
      acc.balance += qty;
      return acc;
    }, { in: 0, out: 0, balance: 0 });

    console.log('\n📈 Summary:');
    console.log(`  Quantity In: ${totals.in.toFixed(2)}`);
    console.log(`  Quantity Out: ${totals.out.toFixed(2)}`);
    console.log(`  Current Balance: ${totals.balance.toFixed(2)}`);

    console.log('\n✅ Test data insertion completed successfully!');
    console.log('🔄 Please reload the app and open Full Stock Ledger View');

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
    await client.end();
    process.exit(1);
  }
}

insertTestData();
