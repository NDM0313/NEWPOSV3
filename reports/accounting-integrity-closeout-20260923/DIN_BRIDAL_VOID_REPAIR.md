# DIN BRIDAL void JE repair

| JE | Invoice | Pre Diff | Operation |
|----|---------|----------|-----------|
| `ec281abf…` | SL-0013 | +1000 | Sales 4000 credit 38000→39000 |
| `e0712d12…` | SL-0013 | +1000 | Sales 4000 credit 38000→39000 (keep both void JEs) |
| `ef161c9d…` | SL-0015 | +700 | Sales 4000 credit 14600→15300 |
| `b3acd30e…` | SL-0021 | −5000 | DELETE 2 duplicate 4120 lines |
| `f5757490…` | SL-0041 | −20000 | DELETE 2 duplicate 4120 lines |

Live balanced JEs for same sales left untouched. Bridal all-incl-void: −35920 → **0**.
