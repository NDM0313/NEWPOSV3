// Script to create missing +1.00 adjustment for Bridal Jewelry Set
// Run with: node fix_bridal_jewelry_adjustment.js

import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fixBridalJewelryAdjustment() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Find Bridal Jewelry Set product
    console.log('📋 Finding Bridal Jewelry Set product...\n');
    
    const { rows: products } = await client.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.current_stock as dashboard_stock,
        COALESCE(SUM(sm.quantity), 0) as calculated_balance,
        (p.current_stock - COALESCE(SUM(sm.quantity), 0)) as difference
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE (p.name ILIKE '%bridal jewelry%' OR p.sku ILIKE '%BJ-SET%')
      GROUP BY p.id, p.name, p.sku, p.current_stock
    `);

    if (products.length === 0) {
      console.log('❌ Bridal Jewelry Set product not found');
      await client.end();
      return;
    }

    const product = products[0];
    const difference = parseFloat(product.difference) || 0;

    console.log(`Product: ${product.name} (${product.sku})`);
    console.log(`Dashboard Stock: ${product.dashboard_stock}`);
    console.log(`Calculated Balance: ${product.calculated_balance}`);
    console.log(`Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(2)}\n`);

    if (Math.abs(difference) < 0.01) {
      console.log('✅ Balance already matches! No adjustment needed.\n');
      await client.end();
      return;
    }

    // Get company and branch
    const { rows: companyRows } = await client.query(`
      SELECT id FROM companies LIMIT 1
    `);
    const companyId = companyRows[0].id;

    const { rows: branchRows } = await client.query(`
      SELECT id FROM branches LIMIT 1
    `);
    const branchId = branchRows.length > 0 ? branchRows[0].id : null;

    // Check if adjustment already exists
    const { rows: existing } = await client.query(`
      SELECT id, quantity, created_at
      FROM stock_movements
      WHERE product_id = $1
      AND movement_type = 'adjustment'
      AND ABS(quantity - $2) < 0.01
      ORDER BY created_at DESC
      LIMIT 1
    `, [product.id, difference]);

    if (existing.length > 0) {
      console.log('⚠️  Adjustment already exists:');
      console.log(`   ID: ${existing[0].id.substring(0, 8)}...`);
      console.log(`   Quantity: ${existing[0].quantity}`);
      console.log(`   Created: ${existing[0].created_at}`);
      console.log('\n✅ Adjustment record exists. Please reload the app.\n');
      await client.end();
      return;
    }

    // Create adjustment
    console.log('📋 Creating adjustment record...\n');
    
    const { rows: inserted } = await client.query(`
      INSERT INTO stock_movements (
        id,
        company_id,
        branch_id,
        product_id,
        movement_type,
        quantity,
        unit_cost,
        total_cost,
        reference_type,
        notes,
        created_at
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        'adjustment',
        $4,
        0,
        0,
        'adjustment',
        $5,
        NOW()
      )
      RETURNING id, quantity, created_at
    `, [
      companyId,
      branchId,
      product.id,
      difference,
      `Balance correction: ${difference > 0 ? '+' : ''}${difference.toFixed(2)} units to match dashboard stock (${product.dashboard_stock})`
    ]);

    console.log('✅ Adjustment created successfully!');
    console.log(`   Movement ID: ${inserted[0].id.substring(0, 8)}...`);
    console.log(`   Quantity: ${difference > 0 ? '+' : ''}${inserted[0].quantity}`);
    console.log(`   Created at: ${inserted[0].created_at}\n`);

    // Note: The trigger may have updated product.current_stock
    // We need to keep it at the original dashboard_stock value
    // (Adjustment is for ledger correction, not stock change)
    console.log('📋 Correcting product stock (keeping at original value)...\n');
    
    await client.query(`
      UPDATE products
      SET current_stock = $1
      WHERE id = $2
    `, [product.dashboard_stock, product.id]);

    console.log(`✅ Product stock set back to ${product.dashboard_stock}\n`);

    // Verify
    const { rows: verified } = await client.query(`
      SELECT 
        p.current_stock as dashboard_stock,
        COALESCE(SUM(sm.quantity), 0) as calculated_balance,
        (p.current_stock - COALESCE(SUM(sm.quantity), 0)) as difference
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, p.current_stock
    `, [product.id]);

    const verifiedDiff = parseFloat(verified[0].difference) || 0;
    const verifiedDiffAbs = Math.abs(verifiedDiff);
    const status = verifiedDiffAbs < 0.01 ? '✅ MATCH' : '❌ MISMATCH';

    console.log('📊 Verification:');
    console.log(`   ${status}`);
    console.log(`   Dashboard: ${verified[0].dashboard_stock}`);
    console.log(`   Calculated: ${verified[0].calculated_balance}`);
    console.log(`   Difference: ${verifiedDiff > 0 ? '+' : ''}${verifiedDiff.toFixed(2)}\n`);

    console.log('🔄 Next Steps:');
    console.log('   1. Reload the app');
    console.log('   2. Open Full Stock Ledger View for Bridal Jewelry Set');
    console.log('   3. Verify:');
    console.log('      - Adjustment row visible');
    console.log('      - Current Balance = 75.00');
    console.log('      - Running balance correct\n');

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
    await client.end();
    process.exit(1);
  }
}

fixBridalJewelryAdjustment();
