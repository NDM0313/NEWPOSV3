# Operator business decision form — DIN BRIDAL 1100

**Amount:** PKR 136,500 credit on control 1100  
**Source:** JE-0155 + JE-0157 (cancelled HQ-SL-0001 / HQ-SL-0002)

---

## Questions (operator must answer)

1. **Is Rs 136,500 a real customer receivable, customer advance, or wrong/orphan amount?**  
   _Diagnostic finding: wrong allocation — sale cancellation credits on control 1100 instead of party AR._

2. **If real, which customer/contact should it belong to?**  
   - Miss NAGHMANA RAJA — PKR 78,750 (HQ-SL-0001)  
   - ASIM — PKR 57,750 (HQ-SL-0002)

3. **If wrong, clear against opening equity/adjustment or correct another way?**  
   _Not recommended — customers are identified; Option C reclass preferred._

4. **Keep in control 1100 for audit history, or move to customer sub-ledger?**  
   _Recommend: move to `AR-CUS0056` / `AR-CUS0012` via scoped gl_correction._

5. **Is apply approval granted?**  
   **Default: NO** — complete approval template in `future-apply-approval-template.md` before any apply phase.
