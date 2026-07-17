# EMULATOR_QA.md

**Result:** `EMULATOR_ENVIRONMENT_UNAVAILABLE`

Single health probe (no CDP retry loop):

| Check | Result |
|-------|--------|
| `boot_completed` | 1 |
| Repeated `adb shell echo` | 3/3 OK |
| Focus | `Application Not Responding: system` |
| Screenshot | `emu-health.png` — system ANR dialog over counter PIN screen |
| Authenticated report QA | **Not attempted** |

Emulator is **not** PASS. Do not treat as native APK acceptance evidence.
