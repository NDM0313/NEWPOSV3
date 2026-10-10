#!/usr/bin/env bash
# Bulk replace hardcoded dark Tailwind classes with theme tokens.
# Safe for UI-only light/dark mode pass. Run from repo root.

set -euo pipefail

DIRS=(
  "src/app/components/reports"
  "src/app/components/inventory"
  "src/app/components/products"
  "src/app/components/accounting"
  "src/app/components/admin"
  "src/app/components/contacts"
  "src/app/components/expenses"
  "src/app/components/dashboard"
  "src/app/components/studio"
  "src/app/components/rentals"
  "src/app/components/settings"
  "src/app/components/sales"
  "src/app/components/purchases"
  "src/app/components/shared"
  "src/app/components/transactions"
  "src/app/components/users"
  "src/app/components/bespoke"
  "src/app/components/production"
  "src/app/components/packing"
  "src/app/components/pos"
  "src/app/components/payments"
  "src/app/components/branches"
  "src/app/components/erp-permissions"
  "src/app/features"
  "src/app/modules"
)

for dir in "${DIRS[@]}"; do
  [ -d "$dir" ] || continue
  find "$dir" -name '*.tsx' -o -name '*.ts' -o -name '*.css' | while read -r f; do
    perl -pi -e '
      s/bg-secondary text-white/bg-secondary text-foreground/g;
      s/min-h-screen bg-secondary text-white/min-h-screen bg-secondary text-foreground/g;
      s/min-h-full bg-secondary text-white/min-h-full bg-secondary text-foreground/g;
      s/h-full w-full min-h-full bg-secondary text-white/h-full w-full min-h-full bg-secondary text-foreground/g;
      s/h-full w-full bg-gray-950 text-white/h-full w-full bg-background text-foreground/g;
      s/bg-\[#0F1419\]/bg-muted\/40/g;
      s/bg-\[#1F2937\]\/50/bg-muted\/50/g;
      s/bg-\[#1F2937\]\/30/bg-muted\/40/g;
      s/bg-\[#1F2937\]/bg-card/g;
      s/border-\[#374151\]/border-border/g;
      s/bg-blue-950\/40/bg-primary\/10/g;
      s/bg-blue-950\/30/bg-primary\/10/g;
      s/bg-blue-950\/25/bg-primary\/10/g;
      s/bg-blue-950\/20/bg-primary\/5/g;
      s/hover:bg-blue-950\/30/hover:bg-primary\/10/g;
      s/text-blue-200/text-primary/g;
      s/text-emerald-100\/95/text-emerald-800 dark:text-emerald-100/g;
      s/bg-\[#0B0F17\]/bg-background/g;
      s/bg-\[#0B1019\]/bg-secondary/g;
      s/bg-\[#111827\]/bg-card/g;
      s/border-gray-800\/50/border-border/g;
      s/border-gray-800/border-border/g;
      s/border-gray-700\/50/border-border/g;
      s/border-gray-700/border-border/g;
      s/divide-gray-800\/50/divide-border/g;
      s/divide-gray-800/divide-border/g;
      s/bg-gray-950\/50/bg-muted\/40/g;
      s/bg-gray-950\/30/bg-muted\/30/g;
      s/bg-gray-900\/80/bg-card/g;
      s/bg-gray-900\/60/bg-muted\/60/g;
      s/bg-gray-900\/50/bg-muted\/40/g;
      s/bg-gray-900\/30/bg-muted\/30/g;
      s/bg-gray-800\/80/bg-muted\/80/g;
      s/bg-gray-800\/50/bg-muted\/50/g;
      s/bg-gray-800\/30/bg-accent\/30/g;
      s/bg-gray-800\/20/bg-accent\/20/g;
      s/bg-gray-950/bg-input-background/g;
      s/bg-gray-900/bg-card/g;
      s/bg-gray-800/bg-muted/g;
      s/bg-gray-700/bg-muted/g;
      s/hover:bg-gray-900\/30/hover:bg-accent\/50/g;
      s/hover:bg-gray-800\/50/hover:bg-accent\/50/g;
      s/hover:bg-gray-800\/30/hover:bg-accent\/30/g;
      s/hover:bg-gray-800\/20/hover:bg-accent\/20/g;
      s/hover:bg-gray-800/hover:bg-accent/g;
      s/hover:bg-gray-700/hover:bg-accent/g;
      s/focus:bg-gray-950/focus:bg-input-background/g;
      s/text-gray-600/text-muted-foreground/g;
      s/text-gray-500/text-muted-foreground/g;
      s/text-gray-400/text-muted-foreground/g;
      s/text-gray-300/text-muted-foreground/g;
      s/hover:text-white/hover:text-foreground/g;
      s/data-\[state=active\]:bg-gray-800/data-[state=active]:bg-card/g;
      s/TabsList className="bg-gray-900 border border-gray-800/TabsList className="bg-muted border border-border/g;
      s/DropdownMenuContent([^>]*?)bg-gray-900 border-border text-white/DropdownMenuContent$1bg-popover border-border text-popover-foreground/g;
      s/DropdownMenuContent([^>]*?)bg-gray-900 border-gray-800 text-white/DropdownMenuContent$1bg-popover border-border text-popover-foreground/g;
      s/AlertDialogContent className="bg-gray-900 border-border text-white/AlertDialogContent className="bg-background border-border text-foreground/g;
      s/DialogContent className="bg-gray-900 border-border text-white/DialogContent className="bg-background border-border text-foreground/g;
      s/DialogContent className="bg-secondary border-border text-white/DialogContent className="bg-background border-border text-foreground/g;
      s/PopoverContent className="([^"]*?)bg-gray-900 border-gray-800/PopoverContent className="$1bg-popover border-border/g;
      s/PopoverContent className="([^"]*?)bg-gray-950 border-gray-800/PopoverContent className="$1bg-popover border-border/g;
      s/SelectContent className="bg-gray-900 border-gray-800 text-white/SelectContent className="bg-popover border-border text-popover-foreground/g;
      s/SelectTrigger className="([^"]*?)bg-gray-900 border-gray-800 text-white/SelectTrigger className="$1bg-input-background border-border text-foreground/g;
      s/Card className="bg-gray-900 border-gray-800/Card className="bg-card border-border/g;
      s/Card className="bg-gray-900\/80 border-gray-800/Card className="bg-card border-border/g;
      s/from-gray-900\/90 via-gray-900\/70 to-gray-950\/90/from-card via-card to-muted/g;
      s/from-gray-900\/80 to-gray-900\/50/from-muted\/60 to-muted\/40/g;
      s/Command className="bg-gray-950 text-white"/Command className="bg-popover text-popover-foreground"/g;
      s/Separator className="bg-gray-800"/Separator className="bg-border"/g;
      s/AlertDialogCancel className="bg-gray-800([^"]*?)text-white/AlertDialogCancel className="bg-muted$1text-foreground/g;
      s/AlertDialogCancel className="bg-gray-800 border-border text-white hover:bg-gray-700/AlertDialogCancel className="bg-muted border-border text-foreground hover:bg-accent/g;
      s/DialogTitle className="([^"]*?)text-white/DialogTitle className="$1text-foreground/g;
      s/text-lg font-bold text-white/text-lg font-bold text-foreground/g;
      s/text-sm font-semibold text-white/text-sm font-semibold text-foreground/g;
      s/text-2xl font-bold text-white/text-2xl font-bold text-foreground/g;
      s/font-semibold text-white/font-semibold text-foreground/g;
      s/font-medium text-white/font-medium text-foreground/g;
      s/<span className="text-white">/<span className="text-foreground">/g;
      s/<strong className="text-white">/<strong className="text-foreground">/g;
      s/px-4 py-3 text-sm text-white/px-4 py-3 text-sm text-foreground/g;
      s/px-4 py-2 text-sm text-white/px-4 py-2 text-sm text-foreground/g;
      s/text-green-400/text-[var(--erp-money-positive)]/g;
      s/\? '\''bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'\''/? '\''bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'\''/g;
      s/\? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"/? "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"/g;
      s/: '\''bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'\''/: '\''bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'\''/g;
      s/: "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"/: "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"/g;
      s/statusFilter === tab\.value \? '\''bg-gray-800 text-white/ statusFilter === tab.value ? '\''bg-muted text-foreground/g;
      s/no-print rounded-lg border border-gray-800 bg-gray-900\/50/no-print rounded-lg border border-border bg-card/g;
    ' "$f"
  done
done

echo "Light mode token pass complete."
