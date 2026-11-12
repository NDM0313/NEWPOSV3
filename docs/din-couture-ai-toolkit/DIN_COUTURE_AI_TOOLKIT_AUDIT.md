# DIN Couture AI Toolkit Audit — 2026-11-08

**Operator:** Cursor Agent on Mini PC `dinserver` (`192.168.86.235` / Tailscale `100.127.166.65`)  
**Target Windows host:** Tailscale node `ndm` (`100.102.42.93`, user profile `C:\Users\ndm31\…`, GitHub `NDM0313`)  
**Mode:** Continuous audit + prepare/fix; Windows desktop actuation blocked (see Access).

---

## Access / execution limits (honest status)

| Path | Result |
|---|---|
| Cursor Computer Use (Windows desktop) | **BLOCKED** — `sidecar_unavailable` (`%LOCALAPPDATA%\Cursor\ComputerUse` token/permissions). Check **Cursor Computer Use** output channel, then re-run Phase 1 live probe. |
| SSH to `ndm` | **CLOSED** (port 22 closed; Tailscale ping OK via DERP only) |
| SMB to `ndm` | Ports 445/139 open; guest/null session **ACCESS_DENIED** (credentials required) |
| Mini PC Linux inventory + Graphify CLI/MCP repair prep | **DONE** |
| Project `.cursor/mcp.json` backup + Graphify entry (preserve Jetro) | **DONE** on Mini PC clones |
| 5 DIN `.mdc` specialist rules | **CREATED + installed** into repos |
| Windows global `%USERPROFILE%\.cursor\mcp.json` live edit | **PENDING** — run `scripts/windows_toolkit_audit_and_fix.ps1` on the Windows PC |

---

## Summary table

| Tool | Installed | Connected | Working | Useful | Action |
|---|---|---|---|---|---|
| Jetro MCP | Yes (Windows paths in project `mcp.json`) | Assumed KEEP | Prior working integration | Yes | **KEEP** (untouched credentials) |
| Graphify CLI (`graphifyy` → `graphify`) | Yes on Mini PC `0.9.104`; Windows verify via PS1 | MCP entry added in project configs | CLI help/query verified on Mini PC | Yes (structural graph) | **KEEP & CONFIGURE** |
| Graphify MCP (`graphify-mcp`) | Yes on Mini PC; Windows path `C:\Users\ndm31\.local\bin\graphify-mcp.exe` registered in project mcp | Needs Cursor reload on Windows after PS1 | Query verified via CLI on portal + rebuilt NEWPOSV3 graph | Yes | **CONFIGURE** then reload MCP |
| Cursor native codebase index | Built-in | Yes | Yes | Yes | **KEEP** |
| codebase-memory-mcp | **Not found** on Mini PC PATH / uv tools | N/A | N/A | Overlaps Graphify + Cursor; peak **8–11 GB RSS** on ~6k-file repos | **SKIP** |
| OpenMontage | Not installed (eval only) | N/A | N/A | Full studio stack; overkill for SKU watermark Reels | **SKIP auto-install** |
| FFmpeg | Yes on Mini PC `8.0.1`; Windows status via PS1 / prior PATH unknown | N/A | Proven in AutoUploadAi social watermark work | **Best fit** for DIN Reel logo+SKU | **KEEP / USE** |
| uv | Installed Mini PC `0.13.7`; Windows expected under `%USERPROFILE%\.local\bin` | N/A | Used to install Graphify | Yes | **KEEP** |
| Node / npm / Git / Python | Present on Mini PC; Windows evidenced in Jetro PATH (`nodejs`, `Git`, NVIDIA NvDLISR) | N/A | Assumed | Yes | **KEEP** |
| DIN 5× Cursor rules | Created | Auto-activate via `description` + `globs`, `alwaysApply: false` | N/A | Yes | **KEEP** |
| Google Drive / GitHub MCPs (this agent session) | Present in agent namespaces | Session-dependent | Used for research | Yes | **KEEP** (no credential edits) |

---

## Phase 1 — System inventory

### Mini PC (`dinserver`) — live

| Item | Value |
|---|---|
| OS | Linux Ubuntu kernel `7.0.0-42-generic` |
| CPU | 11th Gen Intel Core i5-11400T (12 threads) |
| GPU | Intel UHD Graphics 730 (integrated) |
| RAM | 14 GiB total · ~6.4 GiB available at audit |
| Disk `/` | 466G · 197G used · 246G free (45%) |
| Python | 3.14.4 |
| Node / npm | v22.22.1 / 9.2.0 |
| Git | 2.53.0 |
| FFmpeg | 8.0.1 |
| uv | 0.13.7 → `~/.local/bin` |
| Graphify | `graphify` + `graphify-mcp` 0.9.104 |

### Windows 11 PC (`ndm` / `ndm31`) — evidence without live WMI

From project MCP `PATH` blobs (Jetro env) and prior docs:

- Profile: `C:\Users\ndm31\` (not `ndm31.local` in live configs)
- Dev root: `C:\Users\ndm31\dev\Corusr\{NEW POSV3, AutoUploadAi, …}`
- Tooling present in PATH strings: **Node.js**, **Git**, **PostgreSQL 18**, **Docker Desktop**, **Ollama**, **Cursor**, **`.local\bin`**, **NVIDIA NvDLISR** (NVIDIA stack present — discrete GPU likely; confirm with PS1)
- Global `%USERPROFILE%\.cursor\mcp.json` was **not readable** from Mini PC (no mount/SSH/Computer Use)

**Action for live Windows numbers:** run  
`docs/din-couture-ai-toolkit/scripts/windows_toolkit_audit_and_fix.ps1`  
→ writes Desktop report with OS/CPU/GPU/RAM/disk + toolchain JSON.

---

## Phase 2 — Graphify diagnosis & fix

### Why “unknown command”?

Verified against Graphify CLI **0.9.104**:

- CLI shape is **`graphify <subcommand>`** (`install`, `update`, `query`, `explain`, `path`, …).
- **`graphify graph_stats` → `error: unknown command 'graph_stats'`** — `graph_stats` is an **MCP tool**, not a CLI subcommand.
- `graphify --version` / `graphify version` both print `graphify 0.9.104` on this release; older/broken wrappers or wrong binary names can still confuse operators.
- Official package name is **`graphifyy`** (two y’s); command remains **`graphify`**.
- MCP server binary is **`graphify-mcp`**, installed via:  
  `uv tool install "graphifyy[mcp]"`

### Registration before / after

| Location | Before | After |
|---|---|---|
| Project `repos/NEWPOSV3/.cursor/mcp.json` | Jetro only | **Jetro + graphify** |
| Project `repos/AutoUploadAi/.cursor/mcp.json` | Jetro only | **Jetro + graphify** |
| `din-couture-portal/.cursor/mcp.json` | Jetro only | **Jetro + graphify** |
| Windows global `~\.cursor\mcp.json` | Not reachable | Apply via PS1 (merge-only) |

Graphify MCP entry applied:

```json
"graphify": {
  "command": "C:\\Users\\ndm31\\.local\\bin\\graphify-mcp.exe",
  "args": [
    "C:\\Users\\ndm31\\dev\\Corusr\\NEW POSV3\\graphify-out\\graph.json"
  ]
}
```

### Index / query verification (Mini PC)

| Check | Result |
|---|---|
| Installed | **Yes** (`uv tool list` → graphifyy 0.9.104) |
| Configured | **Yes** in project mcp.json (+ fragment for global merge) |
| Connected (Cursor UI on Windows) | **Pending reload** after PS1 / sync |
| Indexed | **Yes** — rebuilt `repos/NEWPOSV3/graphify-out/graph.json` (~50 MB, AST `--no-cluster`) · portal graph also present (272 MB, 171979 nodes) |
| Query verified | **Yes** — `graphify query "journal entry balance accounting"` and portal accounting query returned journal/accounting nodes |

**Status vector:** Installed ✅ | Configured ✅ (project) | Connected ⏳ Windows reload | Indexed ✅ | Query Verified ✅

---

## Phase 3 — codebase-memory-mcp → SKIP

- Not installed on Mini PC (`PATH` / `uv tool list` / shallow home search).
- Cursor already provides semantic indexing; Graphify covers structural graph / impact queries.
- Public reports: codebase-memory-mcp can hit **8–11 GB RSS** indexing ~6k files; Mini PC has **14 GB RAM** and Windows likely shares RAM with Cursor (often **4–8 GB+** steady for large repos) + Docker/Ollama.
- **Decision: SKIP** unless Graphify becomes completely unusable.

**RAM overhead comparison (order-of-magnitude):**

| Layer | Typical extra RAM |
|---|---|
| Cursor native index (large repo) | ~4–8 GB steady; higher during rebuild |
| Graphify CLI extract / MCP serve | Burst during `update`; MCP serves on-disk `graph.json` (low steady vs full in-RAM CBM) |
| codebase-memory-mcp full index | Often **8–11 GB** peak on mid repos; graph held in memory before SQLite dump |

---

## Phase 4 — Five DIN Couture specialist rules

Canonical copies: `docs/din-couture-ai-toolkit/rules/*.mdc`  
Also installed into:

| Rule | `alwaysApply` | Auto-activation | Installed into |
|---|---|---|---|
| `din-erp-database-architect.mdc` | false | description + globs (`migrations`, `sql`, ledger/account) | NEWPOSV3 (+ Accounts-Manager via Windows PS1 if folder exists) |
| `din-n8n-omnichannel-engineer.mdc` | false | workflows / n8n / meta / whatsapp globs | din-couture-n8n, NEWPOSV3, din-ai-sales-v3 |
| `din-couture-sales-marketing-specialist.mdc` | false | captions / marketing / woocommerce / social | NEWPOSV3, AutoUploadAi, din-couture-n8n, din-ai-sales-v3 |
| `din-video-reel-producer.mdc` | false | AutoUploadAi / ai-studio / ffmpeg / reel globs | AutoUploadAi, NEWPOSV3 |
| `din-qa-security-auditor.mdc` | false | tests / secrets / `.env*` / workflow JSON | all of the above |

Cursor loads each rule when the **description matches the task** or **open files match globs** — not on every chat (`alwaysApply: false` keeps tokens low).

Agency-agents repo (`msitarzewski/agency-agents`) was inspected at high level; we shipped **focused DIN-specific** rules instead of bloating context with a full agency pack.

---

## Phase 5 — OpenMontage vs local FFmpeg

### OpenMontage (`OpenMontageInc/OpenMontage` / calesthio lineage)

- Agent-driven video studio: Remotion, HyperFrames, FFmpeg post, optional TTS/stock/AI providers.
- Needs Python 3.10+, FFmpeg, modern Node (22.x patched line), `make setup`.
- Powerful, but **heavy** vs the DIN need: raw dress clip → logo + **`Article Code: SKU`** + luxury caption → 9:16 MP4 for n8n.
- Risk of pulling large optional AI assets — **not auto-downloaded** in this audit.

### Recommendation for this fleet

| Machine | Hardware profile | Reel builder choice |
|---|---|---|
| Mini PC | i5-11400T + UHD 730 · 14 GB RAM · FFmpeg present | **Local FFmpeg script** (CPU x264). Avoid OpenMontage + Remotion concurrent with Docker/ERP. |
| Windows `ndm` | NVIDIA stack in PATH + Node/Git/Ollama/Docker | Still prefer **FFmpeg watermark** for production SKU OCR reliability; consider OpenMontage later only for creative montages, not for every article Reel. |

Ready script: `docs/din-couture-ai-toolkit/scripts/ffmpeg_din_reel_watermark.sh`  
(no LUTs / no color-shifting filters; 1080×1920 pad; SKU drawtext; optional logo overlay).

AutoUploadAi already has social SKU watermark patterns — keep that path as source of truth for storefront sidecars.

---

## Rollback instructions

### Project MCP (Mini PC clones)

Backups:

- `docs/din-couture-ai-toolkit/backups/NEWPOSV3_mcp.json.<timestamp>.bak`
- `docs/din-couture-ai-toolkit/backups/AutoUploadAi_mcp.json.<timestamp>.bak`
- `docs/din-couture-ai-toolkit/backups/din-couture-portal_mcp.json.<timestamp>.bak`

```bash
cp docs/din-couture-ai-toolkit/backups/NEWPOSV3_mcp.json.YYYYMMDDTHHMMSSZ.bak \
   repos/NEWPOSV3/.cursor/mcp.json
# same pattern for AutoUploadAi / din-couture-portal
```

Or remove only the `graphify` key and leave `jetro` intact.

### Windows global MCP (after PS1)

```powershell
Copy-Item "$env:USERPROFILE\.cursor\mcp.json.bak.<stamp>" "$env:USERPROFILE\.cursor\mcp.json" -Force
```

Then reload MCP / restart Cursor.

### Rules

Delete the five `din-*.mdc` files from each `.cursor/rules/` if undesired; other rules (`graphify.mdc`, AutoUploadAi operating rules, etc.) were not removed.

### Graphify package (Mini PC)

```bash
uv tool uninstall graphifyy   # optional
```

`graphify-out/` rebuild can be left or deleted; portal’s older large graph was not deleted.

---

## Exact next step on Windows (one command)

Copy toolkit folder to the Windows PC (or open the synced repo), then:

```powershell
cd C:\Users\ndm31\dev\Corusr\...   # or wherever this toolkit landed
powershell -ExecutionPolicy Bypass -File .\docs\din-couture-ai-toolkit\scripts\windows_toolkit_audit_and_fix.ps1
```

Also fix Computer Use if you want agent-driven desktop actuation:

1. Open Cursor → Output → **Cursor Computer Use**
2. Repair permissions under `%LOCALAPPDATA%\Cursor\ComputerUse`
3. Re-run this audit’s Phase 1 live WMI probe

---

## Artifact index

| Path | Purpose |
|---|---|
| `docs/din-couture-ai-toolkit/DIN_COUTURE_AI_TOOLKIT_AUDIT.md` | This report |
| `docs/din-couture-ai-toolkit/rules/*.mdc` | 5 specialists |
| `docs/din-couture-ai-toolkit/scripts/windows_toolkit_audit_and_fix.ps1` | Windows audit + Graphify MCP merge |
| `docs/din-couture-ai-toolkit/scripts/ffmpeg_din_reel_watermark.sh` | Color-safe SKU Reel builder |
| `docs/din-couture-ai-toolkit/mcp/graphify-mcp.fragment.json` | Merge fragment |
| `docs/din-couture-ai-toolkit/backups/*mcp.json*.bak` | Pre-edit MCP backups |
| `repos/NEWPOSV3/graphify-out/graph.json` | Rebuilt AST graph (~50 MB) |
