// Script to backfill stock_movements from existing purchases and sales
// Run with: node backfill_stock_movements.js

import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function backfillStockMovements() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Step 1: Backfill from Purchases
    console.log('📋 Step 1: Backfilling stock_movements from purchases...');
    
    const purchaseItems = await client.query(`
      SELECT 
        pi.id as item_id,
        pi.purchase_id,
        pi.product_id,
        pi.quantity,
        pi.unit_price,
        pi.total,
        p.company_id,
        p.branch_id,
        p.status,
        p.po_date,
        p.created_by
      FROM purchase_items pi
      INNER JOIN purchases p ON pi.purchase_id = p.id
      WHERE p.status IN ('received', 'final')
      ORDER BY p.po_date DESC, pi.id
    `);

    console.log(`   Found ${purchaseItems.rows.length} purchase items to process`);

    let purchaseInserted = 0;
    let purchaseSkipped = 0;

    for (const item of purchaseItems.rows) {
      // Check if stock_movement already exists for this purchase item
      const existing = await client.query(
        `SELECT id FROM stock_movements 
         WHERE reference_type = 'purchase' 
         AND reference_id = $1 
         AND product_id = $2
         LIMIT 1`,
        [item.purchase_id, item.product_id]
      );

      if (existing.rows.length > 0) {
        purchaseSkipped++;
        continue;
      }

      // Insert stock movement
      // Use unit_price as unit_cost for stock movements
      const unitCost = parseFloat(item.unit_price) || 0;
      const totalCost = parseFloat(item.total) || (parseFloat(item.quantity) * unitCost);
      
      await client.query(
        `INSERT INTO stock_movements (
          id, company_id, branch_id, product_id, movement_type,
          quantity, unit_cost, total_cost, reference_type, reference_id,
          created_by, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'purchase',
          $4, $5, $6, 'purchase', $7,
          $8, $9
        )`,
        [
          item.company_id,
          item.branch_id,
          item.product_id,
          item.quantity,
          unitCost,
          totalCost,
          item.purchase_id,
          item.created_by,
          item.po_date || new Date()
        ]
      );
      purchaseInserted++;
    }

    console.log(`   ✅ Inserted ${purchaseInserted} purchase movements`);
    console.log(`   ⏭️  Skipped ${purchaseSkipped} (already exist)\n`);

    // Step 2: Backfill from Sales
    console.log('📋 Step 2: Backfilling stock_movements from sales...');
    
    const saleItems = await client.query(`
      SELECT 
        si.id as item_id,
        si.sale_id,
        si.product_id,
        si.quantity,
        s.company_id,
        s.branch_id,
        s.type,
        s.status,
        s.invoice_date,
        s.created_by
      FROM sale_items si
      INNER JOIN sales s ON si.sale_id = s.id
      WHERE s.type = 'invoice' AND s.status = 'final'
      ORDER BY s.invoice_date DESC, si.id
    `);

    console.log(`   Found ${saleItems.rows.length} sale items to process`);

    let saleInserted = 0;
    let saleSkipped = 0;

    for (const item of saleItems.rows) {
      // Check if stock_movement already exists for this sale item
      const existing = await client.query(
        `SELECT id FROM stock_movements 
         WHERE reference_type = 'sale' 
         AND reference_id = $1 
         AND product_id = $2
         LIMIT 1`,
        [item.sale_id, item.product_id]
      );

      if (existing.rows.length > 0) {
        saleSkipped++;
        continue;
      }

      // Get average cost from existing purchase movements
      const avgCostResult = await client.query(
        `SELECT COALESCE(AVG(unit_cost), 0) as avg_cost
         FROM stock_movements
         WHERE product_id = $1
         AND company_id = $2
         AND quantity > 0`,
        [item.product_id, item.company_id]
      );
      const avgCost = parseFloat(avgCostResult.rows[0].avg_cost) || 0;
      const totalCost = avgCost * parseFloat(item.quantity);

      // Insert stock movement (negative for OUT)
      const quantity = parseFloat(item.quantity) || 0;
      const negativeQuantity = -quantity;
      const negativeTotalCost = -totalCost;
      
      await client.query(
        `INSERT INTO stock_movements (
          id, company_id, branch_id, product_id, movement_type,
          quantity, unit_cost, total_cost, reference_type, reference_id,
          created_by, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'sale',
          $4::DECIMAL(15,2), $5::DECIMAL(15,2), $6::DECIMAL(15,2), 'sale', $7,
          $8, $9
        )`,
        [
          item.company_id,
          item.branch_id,
          item.product_id,
          negativeQuantity,
          avgCost,
          negativeTotalCost,
          item.sale_id,
          item.created_by,
          item.invoice_date || new Date()
        ]
      );
      saleInserted++;
    }

    console.log(`   ✅ Inserted ${saleInserted} sale movements`);
    console.log(`   ⏭️  Skipped ${saleSkipped} (already exist)\n`);

    // Step 3: Summary
    console.log('📋 Step 3: Final summary...');
    const totalResult = await client.query(
      `SELECT COUNT(*) as total FROM stock_movements`
    );
    const productResult = await client.query(
      `SELECT COUNT(DISTINCT product_id) as products FROM stock_movements`
    );

    console.log(`\n✅ Backfill completed successfully!`);
    console.log(`   Total stock_movements: ${totalResult.rows[0].total}`);
    console.log(`   Products with movements: ${productResult.rows[0].products}`);
    console.log(`\n🔄 Please reload the app and check Full Stock Ledger View for all products`);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
    await client.end();
    process.exit(1);
  }
}

backfillStockMovements();
