#!/usr/bin/env node
/**
 * Phase 13 Track C — Extract products with Parent-Variant architecture.
 *
 * Usage:
 *   node migration-tools/extractProducts.js [62547.sql] [--config mapping.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseSqlInsertRows } from './lib/parseSqlInsert.js';
import { loadConfig, resolveDumpPath, resolveOutputDir, TOOLS_ROOT } from './lib/resolvePaths.js';
import { buildParentVariantTree } from './lib/consolidateProducts.js';

function main() {
  const args = process.argv.slice(2);
  const configFlag = args.indexOf('--config');
  const configPath =
    configFlag >= 0 && args[configFlag + 1]
      ? path.resolve(args[configFlag + 1])
      : path.join(TOOLS_ROOT, 'config', 'mapping.example.json');

  const config = fs.existsSync(configPath) ? loadConfig(configPath) : { legacyBusinessId: 2 };
  const businessId = Number(config.legacyBusinessId ?? 2);
  const companyId = String(config.targetCompanyId || '00000000-0000-4000-8000-000000000001');
  const dumpPath = resolveDumpPath(args, config);
  const outDir = resolveOutputDir(config);

  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump not found: ${dumpPath}`);
    process.exit(1);
  }

  console.log(`Reading dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf8');

  const allProducts = parseSqlInsertRows(sql, 'products');
  const allVariations = parseSqlInsertRows(sql, 'variations');
  const productVariationsRows = parseSqlInsertRows(sql, 'product_variations');

  const products = allProducts.filter((p) => Number(p.business_id) === businessId);

  const productIds = new Set(products.map((p) => Number(p.id)));
  const variations = allVariations.filter((v) => productIds.has(Number(v.product_id)));

  const { parents, stats, legacyProductToParent } = buildParentVariantTree(
    products,
    variations,
    productVariationsRows,
  );

  const entries = parents.map((p) => ({
    ...p,
    companyId,
  }));

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'products.json');
  const mapPath = path.join(outDir, 'product_id_map.json');

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        meta: {
          track: 'C',
          documentType: 'products',
          companyId,
          legacyBusinessId: businessId,
          extractedAt: new Date().toISOString(),
          stats,
        },
        entries,
      },
      null,
      2,
    ),
    'utf8',
  );

  fs.writeFileSync(mapPath, JSON.stringify(legacyProductToParent, null, 2), 'utf8');

  console.log(`Wrote ${stats.parentProducts} parent products (${stats.variants} variants) → ${outPath}`);
  console.log(`Wrote product id map → ${mapPath}`);
  console.log(
    `Track C Products: ${stats.parentProducts} parent products, ${stats.variants} variants (${stats.consolidatedGroups} consolidated groups from ${stats.legacySingleProducts} singles, ${stats.legacyVariableProducts} variable products)`,
  );
}

main();
