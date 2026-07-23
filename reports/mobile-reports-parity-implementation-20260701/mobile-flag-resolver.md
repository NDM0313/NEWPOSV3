# Mobile flag resolver

**Result:** PASS — read-only `feature_flags` queries; no writes.

Triple-gate unified resolution: loader + engine + screen flags. Kill switch → legacy. Missing flags → legacy/unavailable.
