# ROLLBACK.md

1. Do **not** merge without exact phrase `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`.
2. If merged and issues appear: revert feature commits or disable unified loader flags.
3. No migrations applied → **no SQL rollback**.
4. Leave dirty original `main` WIP untouched.
5. APK rollback: reinstall prior store/debug build; identity `93cd8436` / SHA `d15114fc…` is the candidate APK for this program.
