#!/bin/bash
curl -s https://erp.dincouture.pk/ -o /tmp/erp-index.html
BUNDLE=$(grep -oE 'assets/index-[^"]+\.js' /tmp/erp-index.html | head -1)
echo "bundle=$BUNDLE"
if [ -n "$BUNDLE" ]; then
  curl -s "https://erp.dincouture.pk/$BUNDLE" -o /tmp/erp-bundle.js
  echo "bundle_bytes=$(wc -c < /tmp/erp-bundle.js)"
  for s in "Unified engine preview" "phase2-compare-ledger-v2" "unified-ledger-tieout" "Load MR JALIL" "ledger_v2"; do
    if grep -q "$s" /tmp/erp-bundle.js; then echo "found:$s"; else echo "missing:$s"; fi
  done
fi
