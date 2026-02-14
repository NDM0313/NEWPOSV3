#!/bin/bash
# Export Laravel MySQL data for migration
# Usage: ./export_mysql.sh [DB_NAME]
# Output: ./mysql_export/*.csv

set -e
DB_NAME="${1:-laravel_erp}"
DB_USER="${DB_USER:-root}"
OUT_DIR="$(dirname "$0")/mysql_export"
mkdir -p "$OUT_DIR"

echo "Exporting from MySQL: $DB_NAME"
echo "Output: $OUT_DIR"

# Tables to export (adjust to match your Laravel schema)
# Common: users, customers, suppliers, products, categories, purchases, sales, expenses, payments
TABLES="customers suppliers products categories purchases sales sale_items purchase_items expenses payments"

for t in $TABLES; do
  # Tab-separated; use tr for simple CSV (no commas in data) or mysqldump for complex
  mysql -u "$DB_USER" -p "$DB_NAME" -B -e "SELECT * FROM $t" 2>/dev/null | \
  tr '\t' ',' > "$OUT_DIR/${t}.csv" 2>/dev/null || true
  if [ -s "$OUT_DIR/${t}.csv" ]; then
    echo "  $t: $(wc -l < "$OUT_DIR/${t}.csv") rows"
  else
    rm -f "$OUT_DIR/${t}.csv"
    echo "  $t: skip (not found or empty)"
  fi
done

# Row counts
echo ""
echo "Row counts (from information_schema):"
mysql -u "$DB_USER" -p "$DB_NAME" -e "
SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = '$DB_NAME' AND table_rows > 0
ORDER BY table_rows DESC;
" 2>/dev/null

echo ""
echo "Done. Files in $OUT_DIR"
