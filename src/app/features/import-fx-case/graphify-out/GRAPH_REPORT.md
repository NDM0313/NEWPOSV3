# Graph Report - import-fx-case  (2026-08-12)

## Corpus Check
- 1 files · ~3,140 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 15 nodes · 22 edges · 2 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a8799ab9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]

## God Nodes (most connected - your core abstractions)
1. `runBusy()` - 8 edges
2. `numOrNull()` - 2 edges
3. `draftPayload()` - 2 edges
4. `handleCreate()` - 2 edges
5. `handleSaveDraft()` - 2 edges
6. `handleConfirmArrangement()` - 2 edges
7. `handleCancel()` - 2 edges
8. `handleLinkSupplier()` - 2 edges
9. `handleLinkPurchase()` - 2 edges
10. `handleRegisterAttachment()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `handleConfirmArrangement()` --calls--> `runBusy()`  [EXTRACTED]
  ImportFxCaseWorkspace.tsx → ImportFxCaseWorkspace.tsx  _Bridges community 1 → community 0_

## Communities (2 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.29
Nodes (3): draftPayload(), handleConfirmArrangement(), numOrNull()

### Community 1 - "Community 1"
Cohesion: 0.29
Nodes (7): handleCancel(), handleCreate(), handleLinkPurchase(), handleLinkSupplier(), handleRegisterAttachment(), handleSaveDraft(), runBusy()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runBusy()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._