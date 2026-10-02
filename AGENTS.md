# AGENTS.md — Universal AI Governance & Codebase Engineering Standards (C2 Worker)
# Repository: forge-central (C2 Worker)
# Remote: git@github.com:bish-ntx/forge-central.git (branch: main)
# Supported Environments: Cursor, VS Code (NAI / Meta Client / Copilot), OpenCode, Aider
# Author: Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Version: 2.0.0

This file is the single, complete, self-contained source of truth for all AI agents working on `forge-central`.
All editors and assistants (Cursor via `.cursorrules`, Copilot via `.github/copilot-instructions.md`, OpenCode, Aider) follow these instructions without deviation.

---

## 1. Dual-Workspace Architecture & Separation of Concerns

Development operates strictly across two distinct workspaces:
1. **C1 Planning & Governance (Supervisor):** `~/work/Projects/forge-central-plan`
   - Repo: `git@github.com:bish-ntx/forge-central-plan.git` (branch `main`).
   - Role: Product requirements (PRD), feature sequencing, test plan architecture, prompt authoring, off-disk verification, and push coordination.
   - Operating Mode: **Permanently Plan / Supervisor Mode**. C1 never modifies code in `forge-central` directly.
2. **C2 Codebase Execution (Worker — This Repository):** `~/work/git/forge-central`
   - Repo: `git@github.com:bish-ntx/forge-central.git` (branch `main`).
   - Role: FastAPI backend implementation, React 18 / Vite / Tailwind Web Console, scripts, unit tests, and E2E automation.
   - Operating Mode: **Agent / Execution Mode**. C2 executes prompts issued by C1, creates local git commits, and appends execution audit reports.
3. **Core CLI Engine (Read-Only Reference):** `~/work/git/nkp-forge` (`./forge`).
   - Never modify or re-implement CLI logic directly. Delegate all cluster lifecycle operations to `./forge`.

---

## 2. Model Selection & Nutanix Enterprise AI (NAI) Tiering

### Zero-Cost Nutanix Enterprise AI (NAI) Model Tiering
When operating in VS Code, OpenCode, or via the Cursor Meta Client, use the internal Nutanix AI endpoints ($0 token cost):

| NAI Model ID | Display Name | Context Window | Recommended Role |
| :--- | :--- | :--- | :--- |
| **`ntnx-model-high`** | `high` | 1,048,576 (1M) / 128K out | **Architecture & Multi-File Audits:** Deep context scans, complex refactorings, multi-module coordination. |
| **`ntnx-model-auto`** | `auto` | 262,144 (256K) / 32K out | **C2 Primary Code Worker:** Default choice for FastAPI backend, React frontend, and test development. |
| **`ntnx-model-med`** | `medium` | 131,072 (128K) / 32K out | **Targeted Bug Fixes:** Single-file edits, unit test patching, linting, quick script tweaks. |

### Commercial Cloud Fallbacks (When Explicitly Authorized)
- C1 Planner: `gemini-3.8-flash-medium`
- C2 Worker: `claude-sonnet-5-5-high`

---

## 3. Non-Negotiable Engineering Rules

### Backend Engineering (Python 3.12+ / FastAPI)
- **Async-First:** All API route handlers must be `async def`. Non-blocking I/O throughout (`asyncio`, `aiofiles`, `httpx`, `asyncio.to_thread` for blocking file operations).
- **Strict Pydantic Validation:** Every API request and response payload must be defined using explicit Pydantic v2 schemas (`pydantic.BaseModel`).
- **Hypervisor & Infrastructure Abstraction:**
  - Infrastructure provisioning APIs MUST include explicit hypervisor parameters (`HYPERVISOR_TYPE: "proxmox" | "ahv"`).
  - Node onboarding APIs MUST include node infrastructure type parameters (`NODE_INFRA_TYPE: "vm" | "baremetal" | "vbm"`) and deployment mode placeholders (`DEPLOYMENT_MODE: "preprovisioned" | "ironstack_metal"` for Nutanix Foundation Central OS imaging).
  - The upper pre-provisioned NKP cluster lifecycle (`01-05`), PreprovisionedInventory, and Day-2 operations remain 100% invariant regardless of underlying hypervisor or bare metal deployment driver.
- **CLI Subprocess Execution:** NEVER re-implement Proxmox VE, Nutanix AHV, or Nutanix CAPI cluster provisioning logic in Python. ALWAYS delegate write operations to the underlying `./forge` CLI engine (`~/work/git/nkp-forge/forge` or `$FORGE_BIN`) using `ProcessRunner` / `asyncio.create_subprocess_exec`.
- **SSE Terminal Log Streaming:** Async pipeline executions must broadcast stdout and stderr line-by-line over Server-Sent Events (`sse_starlette` or native FastAPI `EventSourceResponse`) to allow real-time Web Console terminal rendering.
- **Error Handling:** Return standard HTTP status codes (`400 Bad Request`, `404 Not Found`, `500 Internal Server Error`) with structured JSON error bodies (`{"detail": "..."}`).
- **Interactive OpenAPI & Help Docstrings:** All FastAPI routes MUST include clear Python docstrings for automatic OpenAPI (`/docs`) interactive documentation.

### Dynamic Path Configuration & Anti-Dotenv Discipline
- **Zero Hardcoded Paths:** NEVER hardcode absolute or home-relative paths like `~/forge-data/`, `~/forge-central-data/`, `/cacrt/`, or `~/work/git/nkp-forge/forge` in Python code, shell wrappers, or React components.
- **Centralized `app/config.py` Settings Engine:** All paths must resolve through dynamic settings:
  - `FORGE_HOME` & `FORGE_STATE_DIR`: defaults to `~/forge-state` (symlink to `forge-data`).
  - `FORGE_DATA_DIR`: canonical cluster state & configs (`~/forge-data`).
  - `FORGE_CENTRAL_DATA_DIR`: Product 1 DB, audit logs & telemetry (`~/forge-central-data`).
  - `FORGE_CACRT_DIR`: shared TLS certificates & registry secrets (`~/cacrt` or `/cacrt`).
  - `FORGE_BIN`: path to `./forge` binary (container default `/nkp-forge/forge`).
- **Structured INI Configuration Standard:** Main application parameters and lab cluster settings MUST be stored in simple, human-readable **`.ini`** files (`forge.ini`, `lab-config.ini`, `~/forge-data/*.ini`). Avoid `.conf` extensions (reserved for system files like `kubeconfig.conf`) for uniformity with `nkp-forge`'s CLI INI engine.
- **Anti-Dotenv Discipline:** Do NOT rely on `.env` files for operational or application state. `.env` files are strictly reserved for low-level developer environment overrides (e.g. local port bindings) and MUST NOT store cluster or lab configuration.

### Frontend Engineering (React 18 / Vite / Tailwind CSS)
- **Component Architecture:** Keep UI components modular under `ui/src/components/` (`layout/`, `cluster/`, `vms/`, `common/`, `settings/`) and route pages under `ui/src/pages/`.
- **Theme Support:** Tailwind configured with `darkMode: 'class'`. Every component must render cleanly across Dark, Light, and System modes. Default to dark mode styling (`bg-slate-900`, `text-slate-100`) matching Nutanix & Proxmox control panels.
- **Icons:** Use `lucide-react` exclusively.
- **Real-Time Logs:** Streaming subprocess logs visualized via the `<LiveTerminal />` SSE component with auto-scroll and execution status indicators.
- **Deterministic Test Selectors:** Always use explicit `data-testid` attributes on interactive elements (buttons, inputs, tables, tabs) to support both Vitest unit tests and Playwright E2E automation.

### Security, Secret Leakage & SSH Credential Hygiene
- **Zero Secret Leakage:** Never write plain-text SSH private keys, Proxmox passwords, Prism credentials, or registry tokens to stdout, console logs, or SSE streams.
- **Masking:** Mask all sensitive tokens (`***MASKED***`) before logging or returning API responses.
- **Credential Storage:** Store sensitive values in encrypted local storage (`/api/v1/secrets`, mode 600 INI under `FORGE_CACRT_DIR`) or out-of-band environment variables.
- **In-Container SSH Staging Protocol:** Host SSH keys are mounted read-only at `/staging/ssh-key:ro`. The container entrypoint (`docker-entrypoint.sh`) copies keys into `/home/forgecentral/.ssh` with permissions `600` owned by `forgecentral` (UID 1000) and executes via `gosu`. NEVER modify permissions or ownership of host SSH keys.

### Testing & Platform Execution Rules
- **Pytest Suite:** Keep all backend tests passing 100% (`pytest api/tests/` and `pytest tests/scripts/`).
- **Vitest Suite:** Keep all frontend tests passing 100% (`npm test` in `ui/`).
- **Playwright E2E Automation:** E2E tests live in `tests/e2e/`. Dual execution modes supported via `test-config.ini`:
  - `ui-only` (or `dry-run`): fast UI regression under 60 seconds (no physical VM provisioning).
  - `live-proxmox`: full-stack hypervisor VM validation (`qm status`), Kubernetes readiness (`kubectl`), Helm charts (`helm`), and NKP dashboard (`nkp get dashboard`).
  - Strict IPAM Safety Guard: aborts with exit code 2 if cluster name or VIP/MetalLB ranges conflict with active allocations in `GET /api/v1/ipam`.
- **macOS Apple Silicon (arm64):** Run Playwright browser binaries natively (`playwright install chromium`) in non-sandboxed host runtime to avoid x64 emulation bottlenecks.

### Documentation & Help-As-You-Go Discipline
- **C2-Owned Documentation:** `README.md` and tracked guides under `docs/` (`docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `docs/DEPLOYMENT-GUIDE.md`, `docs/ADMIN-GUIDE.md`, `docs/E2E-PLAYWRIGHT-TESTING-GUIDE.md`) are **C2-owned**.
- **Synchronous Updates:** Every new API endpoint, UI view, or config flag introduced by a task MUST be documented in `README.md` and `docs/` within the same commit.

---

## 4. The Ponytail Minimalist Edit Discipline

Before generating or modifying any code, all agents must stop at the first rung that holds:
1. **Does this need to exist?** -> No: Skip it (YAGNI).
2. **Already in this codebase?** -> Reuse existing functions, schemas, or hooks.
3. **Borrow from sibling repos?** -> Borrow from `nkp-foundry` or `nkp-forge`.
4. **Native REST / Shell?** -> Execute `./forge` CLI wrapper via `ProcessRunner`.
5. **Installed dependency?** -> Use existing libraries (Lucide, Tailwind, Axios, pytest).
6. **One line?** -> Keep it concise, idiomatic, and clean.
7. **Only then:** -> Write minimal, deterministic code with robust error handling.

---

## 5. Zero Copy-Paste Execution Audit & Task Completion Protocol

1. **Verify 100% Test Pass Rate:**
   - Backend: `pytest api/tests/` (and `pytest tests/scripts/` if scripts touched).
   - Frontend: `npm test` in `ui/`.
   - E2E (if applicable): `./scripts/run-e2e-suite.sh --mode ui-only`.
2. **Update Documentation:** Sync `README.md` and relevant guides under `docs/`.
3. **Append Consolidated Audit Report:** Upon completing any task, append the execution report to `my-notes/c2-runs/PRD-v1.0-execution-audit.md`:
   - Task Header: `## [C2-P<N>] Task <N> — <Title> (<Date>)`
   - Execution Status: `SUCCESS | FAILURE`
   - Acceptance Criteria Matrix: `[x]` / `[ ]`
   - Test Results: Pytest, scripts, and Vitest summary logs
   - Local Git Commit Hash & Subject
   - List of Modified Files
4. **Create Local Conventional Commit:**
   - Commit format: `<type>(<scope>): Task-N — <description>`
   - Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.
5. **NEVER Push Directly:**
   - **NEVER** run `git push origin main` or push directly from C2.
   - C1 verifies tests, diffs, and audit reports off disk, appends its approval verdict, and authorizes the push.
   - If a Gerrit remote is ever used, push only to `refs/for/<branch>`, never directly to the branch.
