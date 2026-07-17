# ERROR_AND_FALLBACK_POLICY.md

1. RPC / HTTP / permission / malformed → typed error UI; never `0` / `[]` as success.
2. Genuine empty → `resultKind: empty`; not “owes nothing” messaging without identity checks.
3. Legacy after unified fail → visible banner + `fallbackReason` in debug meta.
4. Offline / unreachable → do not fabricate zero balances (stale indicator via refresh epoch / existing offline list meta).
5. Admin-only loader/basis badge; easy hub hides debug chrome.
