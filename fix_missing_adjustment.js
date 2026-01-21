// Script to create missing adjustment for balance mismatch
// Run with: node fix_missing_adjustment.js

import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fixMissingAdjustment() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Step 1: Find products with balance mismatch
    console.log('📋 Step 1: Finding products with balance mismatch...\n');
    
    // First, check specifically for "Bridal Jewelry Set" if user mentioned it
    const bridalJewelryCheck = await client.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.current_stock as dashboard_stock,
        COALESCE(SUM(sm.quantity), 0) as calculated_balance,
        (p.current_stock - COALESCE(SUM(sm.quantity), 0)) as difference
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE p.name ILIKE '%bridal jewelry%' OR p.sku ILIKE '%BJ-SET%'
      GROUP BY p.id, p.name, p.sku, p.current_stock
    `);
    
    if (bridalJewelryCheck.rows.length > 0) {
      console.log('🔍 Found Bridal Jewelry Set products:');
      bridalJewelryCheck.rows.forEach(p => {
        const diff = parseFloat(p.difference) || 0;
        console.log(`   ${p.name} (${p.sku}): Dashboard ${p.dashboard_stock} vs Calculated ${p.calculated_balance} (diff: ${diff > 0 ? '+' : ''}${diff.toFixed(2)})`);
      });
      console.log('');
    }
    
    const mismatchQuery = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        p.current_stock as dashboard_stock,
        COALESCE(SUM(sm.quantity), 0) as calculated_balance,
        (p.current_stock - COALESCE(SUM(sm.quantity), 0)) as difference
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      GROUP BY p.id, p.name, p.sku, p.current_stock
      HAVING ABS(p.current_stock - COALESCE(SUM(sm.quantity), 0)) > 0.01
      ORDER BY ABS(p.current_stock - COALESCE(SUM(sm.quantity), 0)) DESC
      LIMIT 10;
    `;

    const { rows: mismatches } = await client.query(mismatchQuery);
    
    if (mismatches.length === 0) {
      console.log('✅ No balance mismatches found!\n');
      await client.end();
      return;
    }

    console.log(`Found ${mismatches.length} products with balance mismatch:\n`);
    mismatches.forEach((m, i) => {
      console.log(`${i + 1}. ${m.product_name} (${m.sku})`);
      console.log(`   Dashboard Stock: ${m.dashboard_stock}`);
      console.log(`   Calculated Balance: ${m.calculated_balance}`);
      console.log(`   Difference: ${m.difference > 0 ? '+' : ''}${m.difference}`);
      console.log('');
    });

    // Step 2: Get company and branch info
    console.log('📋 Step 2: Getting company and branch info...\n');
    
    const { rows: companyRows } = await client.query(`
      SELECT id, name FROM companies LIMIT 1
    `);
    
    if (companyRows.length === 0) {
      console.log('❌ No company found');
      await client.end();
      return;
    }

    const companyId = companyRows[0].id;
    console.log(`Company: ${companyRows[0].name} (${companyId.substring(0, 8)}...)\n`);

    // Get branch - try with company_id first, then get any branch
    let { rows: branchRows } = await client.query(`
      SELECT id, name FROM branches WHERE company_id = $1 LIMIT 1
    `, [companyId]);
    
    // If no branch found with company_id, get any branch
    if (branchRows.length === 0) {
      console.log('⚠️  No branch found with company_id, trying to get any branch...');
      const { rows: anyBranch } = await client.query(`
        SELECT id, name FROM branches LIMIT 1
      `);
      if (anyBranch.length > 0) {
        branchRows = anyBranch;
      }
    }
    
    if (branchRows.length === 0) {
      console.log('❌ No branch found in database');
      console.log('   Creating adjustments without branch_id...\n');
    } else {
      const branchId = branchRows[0].id;
      console.log(`Branch: ${branchRows[0].name} (${branchId.substring(0, 8)}...)\n`);
    }

    // Step 3: Create missing adjustments
    console.log('📋 Step 3: Creating missing adjustment records...\n');
    
    let created = 0;
    let skipped = 0;

    for (const mismatch of mismatches) {
      const difference = parseFloat(mismatch.difference);
      
      // Skip if difference is too small or zero
      if (Math.abs(difference) < 0.01) {
        skipped++;
        continue;
      }

      // Check if adjustment already exists for this product
      const existingCheck = await client.query(`
        SELECT id FROM stock_movements
        WHERE product_id = $1
        AND company_id = $2
        AND movement_type = 'adjustment'
        AND ABS(quantity - $3) < 0.01
        AND created_at > NOW() - INTERVAL '1 day'
        LIMIT 1
      `, [mismatch.product_id, companyId, difference]);

      if (existingCheck.rows.length > 0) {
        console.log(`⏭️  Skipping ${mismatch.product_name}: Adjustment already exists`);
        skipped++;
        continue;
      }

      // Create adjustment movement
      try {
        const branchIdValue = branchRows.length > 0 ? branchRows[0].id : null;
        
        const insertResult = await client.query(`
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
          branchIdValue,
          mismatch.product_id,
          difference,
          `Balance correction: ${difference > 0 ? '+' : ''}${difference.toFixed(2)} units to match dashboard stock`
        ]);

        console.log(`✅ Created adjustment for ${mismatch.product_name}:`);
        console.log(`   Quantity: ${difference > 0 ? '+' : ''}${difference.toFixed(2)}`);
        console.log(`   Movement ID: ${insertResult.rows[0].id.substring(0, 8)}...`);
        console.log(`   Created at: ${insertResult.rows[0].created_at}`);
        console.log('');

        created++;
      } catch (error) {
        console.error(`❌ Error creating adjustment for ${mismatch.product_name}:`, error.message);
      }
    }

    // Step 4: Verify fixes
    console.log('📋 Step 4: Verifying fixes...\n');
    
    const verifyQuery = `
      SELECT 
        p.id,
        p.name,
        p.current_stock as dashboard_stock,
        COALESCE(SUM(sm.quantity), 0) as calculated_balance,
        (p.current_stock - COALESCE(SUM(sm.quantity), 0)) as difference
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE p.id = ANY($1::uuid[])
      GROUP BY p.id, p.name, p.current_stock
    `;

    const productIds = mismatches.map(m => m.product_id);
    const { rows: verified } = await client.query(verifyQuery, [productIds]);

    console.log('Verification Results:');
    verified.forEach(v => {
      const diff = parseFloat(v.difference) || 0;
      const diffAbs = Math.abs(diff);
      const status = diffAbs < 0.01 ? '✅ MATCH' : '❌ MISMATCH';
      console.log(`${status} ${v.name}: Dashboard ${v.dashboard_stock} vs Calculated ${v.calculated_balance} (diff: ${diff > 0 ? '+' : ''}${diff.toFixed(2)})`);
    });

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Created: ${created} adjustments`);
    console.log(`   Skipped: ${skipped} (already exist or zero difference)`);
    console.log(`   Total checked: ${mismatches.length}`);
    console.log('\n🔄 Please reload the app and check Full Stock Ledger View');
    console.log('   Balance should now match dashboard stock!');

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
    await client.end();
    process.exit(1);
  }
}

fixMissingAdjustment();
