# AGENTS.md — Forge Central (C2 Worker Repository)
# Repo: `git@github.com:bish-ntx/forge-central.git` (branch `main`)
# Supported editors: Cursor, VS Code (Copilot / NAI), OpenCode, Aider
# Author: Bishwajit Kumar <Bishwajit.Kumar@nutanix.com> — Version 1.0.0

This file mirrors the planner governance (`forge-central-plan/AGENTS.md`) for this worker repo. `.cursorrules` holds the detailed engineering rules; this file is the short canonical summary. `.github/copilot-instructions.md` points here.

## 1. Workspace roles
| Role | Path | Mode |
| :--- | :--- | :--- |
| **C1 Planner / Supervisor** | `~/work/Projects/forge-central-plan` | Plans, authors prompts, verifies, pushes. Never edits this repo's code. |
| **C2 Worker (this repo)** | `~/work/git/forge-central` | Implements prompts: FastAPI backend, React web console, scripts, tests, docs. |
| **Core CLI (read-only)** | `~/work/git/nkp-forge` (`./forge`) | Underlying engine. Do not modify or re-implement. |

## 2. Models
- NAI tier (VS Code / OpenCode / Cursor Meta Client, $0): `ntnx-model-high` (large reads/audits), `ntnx-model-auto` (default code worker), `ntnx-model-med` (targeted fixes).
- Commercial fallbacks when authorized: C1 `gemini-3.8-flash-medium`, C2 `claude-sonnet-5-5-high`.

## 3. Engineering rules (non-negotiable)
**Backend (Python 3.11+ / FastAPI)**
- All endpoints `async def`; non-blocking I/O (`asyncio.create_subprocess_exec`, `httpx`, `asyncio.to_thread` for file work).
- Explicit Pydantic v2 request/response schemas; clear docstrings for OpenAPI.
- CLI parity: never re-implement Proxmox/Kubernetes provisioning in Python; shell out to `./forge` (`$FORGE_BIN`) via `ProcessRunner`.
- Zero hardcoded paths: resolve through `api/app/config.py` (`FORGE_HOME`, `FORGE_STATE_DIR`, `FORGE_DATA_DIR`, `FORGE_CACRT_DIR`). Lab/app config lives in `.ini` files, not `.env`.

**Frontend (React 18 / Vite / Tailwind)**
- Components in `ui/src/components/`, pages in `ui/src/pages/`; icons from `lucide-react` only.
- Tailwind `darkMode: 'class'`; every component must work in Dark, Light and System themes.
- Streaming logs go through `<LiveTerminal />` (SSE) with auto-scroll and status indicators.
- Use deterministic `data-testid` attributes (also relied on by Playwright E2E).

**Secrets**
- Never print SSH keys, Proxmox/Prism passwords or registry credentials to logs, stdout or SSE; mask as `***MASKED***`.
- Store credentials via `/api/v1/secrets` (chmod 600 INI under `FORGE_CACRT_DIR`) or lab INI files; never return them from APIs.
- SSH keys reach the container read-only at `/staging/ssh-key`; `docker-entrypoint.sh` copies them into the container user's `~/.ssh` (mode 600). Never chmod/chown host keys.

## 4. Ponytail minimalist discipline
Stop at the first rung that holds: (1) does it need to exist? (2) already in this codebase — reuse; (3) borrow from sibling repos; (4) shell out to `./forge`; (5) use an installed dependency; (6) one line; (7) only then write minimal, deterministic code with proper error handling.

## 5. Task completion protocol
1. Run `pytest api/tests/` and `npm test` (in `ui/`) — both must be 100% green.
2. Update `README.md` and `docs/` (`API-GUIDE.md`, `USER-GUIDE.md`, `DEPLOYMENT-GUIDE.md` as relevant) in the same change as any new endpoint, UI view or config flag.
3. Append an execution report to `my-notes/c2-runs/PRD-v1.0-execution-audit.md`: header `## [C2-P<N>] Task <N> — <Title> (<Date>)`, status `SUCCESS|FAILURE`, acceptance matrix `[x]/[ ]`, pytest + vitest results, commit hash & subject, modified files.
4. Create a **local** conventional commit: `<type>(<scope>): Task-N — <description>`.
5. **NEVER `git push`.** C1 verifies the audit and issues push commands. If a Gerrit remote is ever used, push only to `refs/for/<branch>`, never directly to the branch.
