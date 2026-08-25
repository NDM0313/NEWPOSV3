# Root cause summary

## Rs. 80,000
- Source: JE-0213 correction_reversal (void pair JE-0204)
- Classification: LEGACY OVERSTATES AR + INTENTIONAL EFFECTIVE_PARTY EXCLUSION
- Data repair needed: **NO**

## Rs. 150
- Source: JV-000203 orphan-ar gl_correction
- Classification: INTENTIONAL EFFECTIVE_PARTY EXCLUSION
- Data repair needed: **NO**

## Fix
Parity comparator uses official_gl (same family as Contacts legacy), not effective_party.
