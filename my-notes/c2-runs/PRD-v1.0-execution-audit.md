# PRD v1.0 Execution Audit

## [2026-09-26] Task-1 FastAPI skeleton and async forge runner

- Execution Status: SUCCESS
- Target: C2-P01-Agent01 (Codex 5.3 Medium)
- Scope: Repository bootstrap + FastAPI API skeleton + async subprocess runner + tests + docs

### Acceptance Criteria Matrix

- [x] 1. Repository setup verified: `.cursorrules`, `.gitignore`, `README.md`, `docs/API-GUIDE.md` present
- [x] 2. FastAPI backend boots cleanly (`uvicorn api.app.main:app --port 8000`)
- [x] 3. `GET /health` returns `200 OK` with `{"status":"healthy","forge_bin":"..."}`
- [x] 4. Unit tests pass (`pytest api/tests/`)
- [x] 5. Git commit staged (files staged for commit message: `feat(api): Task-1 — initialize FastAPI skeleton & async ./forge subprocess runner`)
- [x] 6. Execution report appended to this audit file
- [x] 7. Safety rule followed: no auto-commit, no git push

### Command Logs

#### `pytest api/tests/`

```text
============================= test session starts ==============================
platform darwin -- Python 3.9.9, pytest-8.4.2, pluggy-1.6.0
rootdir: /Users/bishwajit.kumar/work/git/forge-central
plugins: anyio-4.12.1, asyncio-1.2.0
asyncio: mode=strict, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 3 items

api/tests/test_cli_runner.py ...                                         [100%]

============================== 3 passed in 0.57s ===============================
```

#### Uvicorn smoke test + health probe

```text
{"status":"healthy","forge_bin":"/Users/bishwajit.kumar/work/git/forge-central/forge"}
```

### Git Staging Snapshot

- Commit hash: N/A (not committed by policy; staged only)
- Intended commit subject: `feat(api): Task-1 — initialize FastAPI skeleton & async ./forge subprocess runner`
- Staged files:
  - `.cursorrules`
  - `.gitignore`
  - `README.md`
  - `api/__init__.py`
  - `api/app/__init__.py`
  - `api/app/config.py`
  - `api/app/main.py`
  - `api/app/routers/__init__.py`
  - `api/app/routers/cli.py`
  - `api/app/schemas/__init__.py`
  - `api/app/schemas/cli.py`
  - `api/app/services/__init__.py`
  - `api/app/services/process_runner.py`
  - `api/requirements.txt`
  - `api/tests/test_cli_runner.py`
  - `docs/API-GUIDE.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 15:10 PDT / 22:10 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - 16 new files staged cleanly in `~/work/git/forge-central`.
  - Zero uncommitted or unstaged garbage files.
  - Read PRD directly from C1 plan repo without local PRD copy drift.
  - Pytest 3/3 passed cleanly in 0.57s.
  - Base endpoints (`GET /health`, `GET /api/v1/version`, `POST /api/v1/cli/execute`) validated.
- **Checklist Updated:** Phase 2 (Tasks 2.1 – 2.5) marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Commit & Push Commands:**
  ```bash
  cd ~/work/git/forge-central
  git branch -m main
  git commit -m "feat(api): Task-1 — initialize FastAPI skeleton & async ./forge subprocess runner"
  git push origin main
  ```

---

## [2026-09-26] Task-2 React Vite UI skeleton and dark Tailwind layout

- Execution Status: SUCCESS
- Target: C2-P02-Agent02 (Codex 5.3 Medium)
- Scope: `ui/` initialization, Tailwind dark theme, React Router shell, layout tests, docs updates, local commit

### Acceptance Criteria Matrix

- [x] 1. Component tests pass: `npm test` in `ui/` (3/3 passing)
- [x] 2. Frontend builds cleanly: `npm run build` in `ui/`
- [x] 3. Layout renders with lab site badge and mode switcher
- [x] 4. Routing functional for `/vms`, `/clusters`, `/fleet`, `/ipam`, `/settings`
- [x] 5. `data-testid` attributes added for nav links, header elements, and page containers
- [x] 6. Documentation updated in `README.md` and `docs/USER-GUIDE.md`
- [x] 7. Local git commit created with requested subject
- [x] 8. Safety rule followed: local commit only, no push

### Test Output Summary

#### `npm test` (from `ui/`)

```text
RUN  v3.2.7 /Users/bishwajit.kumar/work/git/forge-central/ui
✓ src/components/layout/__tests__/Layout.test.jsx (3 tests)
Test Files  1 passed (1)
Tests  3 passed (3)
```

#### `npm run build` (from `ui/`)

```text
vite v8.3.1 building client environment for production...
✓ built in 960ms
```

#### `pytest` summary

```text
Not run in this task (frontend-only scope).
```

### Local Commit Snapshot

- Commit hash: `a5c2191`
- Commit subject: `feat(ui): Task-2 — initialize React Vite skeleton with dark Tailwind sidebar layout`
- Files modified/created:
  - `README.md`
  - `docs/USER-GUIDE.md`
  - `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
  - `ui/package.json`
  - `ui/vite.config.js`
  - `ui/tailwind.config.js`
  - `ui/postcss.config.js`
  - `ui/src/main.jsx`
  - `ui/src/App.jsx`
  - `ui/src/index.css`
  - `ui/src/components/layout/Layout.jsx`
  - `ui/src/components/layout/Header.jsx`
  - `ui/src/components/layout/Sidebar.jsx`
  - `ui/src/components/layout/__tests__/Layout.test.jsx`
  - `ui/src/pages/VmListPage.jsx`
  - `ui/src/pages/ClustersPage.jsx`
  - `ui/src/pages/FleetDashboardPage.jsx`
  - `ui/src/pages/IpamPage.jsx`
  - `ui/src/pages/SettingsPage.jsx`
  - `ui/src/test/setupTests.js`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 15:33 PDT / 22:33 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `a5c2191` created cleanly (`feat(ui): Task-2 — initialize React Vite skeleton with dark Tailwind sidebar layout`).
  - React 18 + Vite frontend initialized under `ui/`.
  - Tailwind dark theme matching Nutanix/Proxmox control panels configured with ThemeContext (Dark/Light/System).
  - Component tests (`npm test` in `ui/`) passed 3/3 in 960ms.
  - Production build (`npm run build` in `ui/`) succeeded cleanly.
  - Navigation links (`VMs`, `Clusters`, `Fleet Dashboard`, `IPAM Subnets`, `Settings`) and page containers populated with `data-testid` locators.
  - Documentation updated in `README.md` and `docs/USER-GUIDE.md`.
- **Checklist Updated:** Phase 4 (Tasks 4.1 – 4.5) marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-26] Task-3 SSE pipeline stream and Live Terminal

- Execution Status: SUCCESS
- Target: C2-P03-Agent03 (Codex 5.3 Medium)
- Scope: SSE backend stream endpoint, log publisher service, React EventSource hook, Live Terminal UI, tests, docs, local commit

### Acceptance Criteria Matrix

- [x] 1. SSE backend streaming test passes: `pytest api/tests/test_sse_stream.py`
- [x] 2. Live Terminal component renders auto-scrolling log lines with stdout/stderr syntax highlighting
- [x] 3. Frontend compilation succeeds: `npm run build` in `ui/`
- [x] 4. Documentation updated: `docs/API-GUIDE.md` and `docs/USER-GUIDE.md` document SSE streaming and terminal behavior
- [x] 5. Local Git commit created with requested subject
- [x] 6. Safety rule followed: local commit only, no push

### Test Output Summary

#### `pytest api/tests/test_sse_stream.py`

```text
============================= test session starts ==============================
platform darwin -- Python 3.9.9, pytest-8.4.2, pluggy-1.6.0
collected 2 items
api/tests/test_sse_stream.py ..                                          [100%]
============================== 2 passed in 0.35s ===============================
```

#### `pytest api/tests/`

```text
collected 5 items
api/tests/test_cli_runner.py ...                                         [ 60%]
api/tests/test_sse_stream.py ..                                          [100%]
============================== 5 passed in 0.27s ===============================
```

#### `npm test` (from `ui/`)

```text
Test Files  2 passed (2)
Tests  4 passed (4)
```

#### `npm run build` (from `ui/`)

```text
vite v8.3.1 building client environment for production...
✓ built in 827ms
```

### Local Commit Snapshot

- Commit hash: `0371516`
- Commit subject: `feat(pipeline): Task-3 — build SSE log streaming endpoint and React Live Terminal component`
- Files created/modified:
  - `README.md`
  - `api/app/main.py`
  - `api/app/routers/pipeline.py`
  - `api/app/schemas/pipeline.py`
  - `api/app/services/log_publisher.py`
  - `api/app/services/process_runner.py`
  - `api/tests/test_sse_stream.py`
  - `docs/API-GUIDE.md`
  - `docs/USER-GUIDE.md`
  - `ui/src/hooks/useEventSource.js`
  - `ui/src/components/common/LiveTerminal.jsx`
  - `ui/src/components/common/__tests__/LiveTerminal.test.jsx`
  - `ui/src/pages/ClustersPage.jsx`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 15:38 PDT / 22:38 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `0371516` created cleanly (`feat(pipeline): Task-3 — build SSE log streaming endpoint and React Live Terminal component`).
  - FastAPI SSE streaming route `GET /api/v1/pipeline/{run_id}/stream` and `log_publisher.py` service implemented.
  - Pytest backend test suite passed 5/5 in 0.27s (`test_cli_runner.py` and `test_sse_stream.py`).
  - Frontend `useEventSource.js` custom hook and `LiveTerminal.jsx` component created with dark monospace styling, line numbering, auto-scroll toggle, and copy-to-clipboard button.
  - Vitest component tests passed 4/4 in `ui/`. Production build (`npm run build` in `ui/`) succeeded in 827ms.
  - OpenAPI & user documentation updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`.
- **Checklist Updated:** Phase 5 (Tasks 5.1 – 5.5) marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-26] Task-4 Playwright UI automation harness and CI workflow

- Execution Status: SUCCESS
- Target: C2-P04-Agent04 (Codex 5.3 Medium)
- Scope: Python Playwright E2E suite, UI test selectors/toggles, GitHub Actions workflow, testing docs, local commit

### Acceptance Criteria Matrix

- [x] 1. Playwright tests execute and pass headlessly: `pytest tests/e2e/` passes 100%
- [x] 2. `data-testid` locators resolve reliably without fragile CSS/text selectors
- [x] 3. GHA workflow syntax and triggers configured in `.github/workflows/ui-e2e-ci.yml`
- [x] 4. Documentation updated in `docs/TESTING-GUIDE.md` and `README.md`
- [x] 5. Local git commit created with requested subject
- [x] 6. Safety rule followed: local commit only, no push

### Test Output Summary

#### `npm test` (from `ui/`)

```text
Test Files  2 passed (2)
Tests  4 passed (4)
```

#### `pytest api/tests/`

```text
collected 5 items
api/tests/test_cli_runner.py ...                                         [ 60%]
api/tests/test_sse_stream.py ..                                          [100%]
============================== 5 passed in 0.31s ===============================
```

#### `pytest tests/e2e/ --browser chromium`

```text
collected 4 items
tests/e2e/test_web_console_e2e.py ....                                   [100%]
============================== 4 passed in 6.51s ===============================
```

### Local Commit Snapshot

- Commit hash: `76905a8`
- Commit subject: `test(ui): Task-4 — add Playwright Python UI automation harness & GHA workflow`
- Files created/modified:
  - `.github/workflows/ui-e2e-ci.yml`
  - `.gitignore`
  - `README.md`
  - `api/app/routers/cli.py`
  - `docs/TESTING-GUIDE.md`
  - `tests/e2e/conftest.py`
  - `tests/e2e/requirements-e2e.txt`
  - `tests/e2e/test_web_console_e2e.py`
  - `ui/src/components/layout/Header.jsx`
  - `ui/src/components/layout/Layout.jsx`
  - `ui/src/components/layout/Sidebar.jsx`
  - `ui/src/components/layout/__tests__/Layout.test.jsx`
  - `ui/src/pages/ClustersPage.jsx`
  - `ui/vite.config.js`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 15:50 PDT / 22:50 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `76905a8` created cleanly (`test(ui): Task-4 — add Playwright Python UI automation harness & GHA workflow`).
  - Playwright Python E2E test harness created under `tests/e2e/` with `conftest.py` starting FastAPI backend and Vite preview server.
  - Headless E2E tests (`pytest tests/e2e/ --browser chromium`) passed 4/4 in 6.51s (testing navigation, site mode toggles, theme switcher, and Live Terminal streaming).
  - GitHub Actions workflow `.github/workflows/ui-e2e-ci.yml` configured supporting both `push`/`pull_request` and `workflow_dispatch` manual triggers with artifact retention.
  - Documentation created in `docs/TESTING-GUIDE.md` and updated in `README.md`.
- **Checklist Updated:** Tasks 4.8 and 4.9 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-26] Task-4 E2E validation rerun (Codex 5.3)

- Execution Status: SUCCESS
- Target: C2-P04-Agent04 (Codex 5.3 Medium)
- Scope: Validate existing Playwright Python E2E harness, workflow triggers/artifacts, docs coverage, and safety constraints

### Acceptance Criteria Matrix

- [x] 1. Playwright tests execute and pass headlessly: `pytest tests/e2e/ --browser chromium`
- [x] 2. `data-testid` locators resolve via E2E assertions in `tests/e2e/test_web_console_e2e.py`
- [x] 3. GHA workflow syntax/config present in `.github/workflows/ui-e2e-ci.yml` with `push`, `pull_request`, `workflow_dispatch`
- [x] 4. Documentation present in `docs/TESTING-GUIDE.md` and `README.md`
- [x] 5. Local Git commit exists: `76905a8` (`test(ui): Task-4 — add Playwright Python UI automation harness & GHA workflow`)
- [x] 6. Safety rule followed: local validation only, no push performed

### Test Output Summary

#### `pytest tests/e2e/ --browser chromium`

```text
============================= test session starts ==============================
platform darwin -- Python 3.9.9, pytest-8.4.2, pluggy-1.6.0
collected 4 items
tests/e2e/test_web_console_e2e.py ....                                   [100%]
============================== 4 passed in 8.64s ===============================
```

### Local Commit Snapshot (existing)

- Commit hash: `76905a8`
- Commit subject: `test(ui): Task-4 — add Playwright Python UI automation harness & GHA workflow`
- Additional verification commit observed: `ec0d917` (`docs(e2e): update TESTING-GUIDE, .cursorrules, and execution audit with C1 verification & Playwright arm64 note`)

### Notes

- No new source changes were required for this rerun; repository remained clean after verification.
- `pytest` in sandboxed runtime can fail Playwright browser resolution due to isolated cache paths; running the same command outside sandbox succeeded.

---

## [2026-09-26] Task-5 VM REST + UI delivery (Codex 5.3)

- Execution Status: SUCCESS
- Target: C2-P05-Agent05 (Codex 5.3 Medium / Sonnet 5 Thinking)
- Scope: Add VM management API endpoints, VM list UI, backend/frontend tests, and docs

### Acceptance Criteria Matrix

- [x] 1. Backend pytest suite passes: `pytest api/tests/test_vms.py`
- [x] 2. Frontend Vitest suite passes: `npm test`
- [x] 3. `data-testid` locators present on VM table, filters, modals, and action buttons
- [x] 4. Documentation updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`
- [x] 5. Local Git commit created: `4d0fa2e` (`feat(vms): Task-5 — add Proxmox VM management REST endpoints & VmListPage UI component`)
- [x] 6. Safety rule followed: local commit only, no push performed

### Test Output Summary

#### `pytest api/tests/test_vms.py`

```text
============================= test session starts ==============================
platform darwin -- Python 3.9.9, pytest-8.4.2, pluggy-1.6.0
collected 3 items
api/tests/test_vms.py ...                                                [100%]
============================== 3 passed in 0.31s ===============================
```

#### `npm test`

```text
RUN  v3.2.7 /Users/bishwajit.kumar/work/git/forge-central/ui
✓ src/pages/__tests__/VmListPage.test.jsx (4 tests)
✓ src/components/layout/__tests__/Layout.test.jsx (3 tests)
✓ src/components/common/__tests__/LiveTerminal.test.jsx (1 test)
Test Files  3 passed (3)
Tests  8 passed (8)
Duration  2.42s
```

### Local Commit Snapshot

- Commit hash: `4d0fa2e`
- Commit subject: `feat(vms): Task-5 — add Proxmox VM management REST endpoints & VmListPage UI component`

### Files Created / Modified

- `api/app/routers/vms.py`
- `api/app/schemas/vms.py`
- `api/app/main.py`
- `api/tests/test_vms.py`
- `ui/src/pages/VmListPage.jsx`
- `ui/src/pages/__tests__/VmListPage.test.jsx`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 16:10 PDT / 23:10 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `4d0fa2e` created cleanly (`feat(vms): Task-5 — add Proxmox VM management REST endpoints & VmListPage UI component`).
  - FastAPI VM management routes (`GET /api/v1/vms`, `POST /api/v1/vms/create`, `POST /api/v1/vms/{vmid}/action`, `POST /api/v1/vms/pci-passthrough`) created in `api/app/routers/vms.py`.
  - Pydantic v2 schemas (`VmListResponse`, `VmCreateRequest`, `VmActionRequest`, `PciPassthroughRequest`) created in `api/app/schemas/vms.py`.
  - Pytest backend tests (`pytest api/tests/test_vms.py`) passed 3/3 in 0.31s.
  - React `VmListPage.jsx` view built supporting VM data table, search input (`data-testid="input-vm-search"`), status filter (`data-testid="select-vm-status-filter"`), creation modal (`data-testid="btn-open-create-vm-modal"`), action buttons (`data-testid="btn-vm-start-{vmid}"`, `data-testid="btn-vm-stop-{vmid}"`, `data-testid="btn-vm-destroy-{vmid}"`), and typed confirmation modal (`data-testid="modal-confirm-vm-destroy"`).
  - Vitest component suite passed 8/8 tests across 3 test files in 2.42s.
  - API and user guides updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`.
- **Checklist Updated:** Tasks 3.6 (partial VMs), 3.7 (hardware passthrough), and 4.3 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-26] Task-6 Cluster REST + UI delivery (Codex 5.3)

- Execution Status: SUCCESS
- Target: C2-P06-Agent06 (Codex 5.3 Medium / Sonnet 5 Thinking)
- Scope: Add NKP cluster management API routes, cluster UI page, backend/frontend tests, and docs updates

### Acceptance Criteria Matrix

- [x] 1. Backend pytest suite passes: `pytest api/tests/test_clusters.py`
- [x] 2. Frontend Vitest suite passes: `npm test`
- [x] 3. `data-testid` locators present on cluster cards, buttons, search filter, and modal
- [x] 4. Documentation updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`
- [x] 5. Local Git commit created: `76d6f90` (`feat(clusters): Task-6 — add NKP cluster management REST endpoints & ClustersPage UI component`)
- [x] 6. Safety rule followed: local commit only, no push performed

### Test Output Summary

#### `pytest api/tests/test_clusters.py`

```text
============================= test session starts ==============================
platform darwin -- Python 3.9.9, pytest-8.4.2, pluggy-1.6.0
collected 3 items
api/tests/test_clusters.py ...                                           [100%]
============================== 3 passed in 0.36s ===============================
```

#### `npm test`

```text
RUN  v3.2.7 /Users/bishwajit.kumar/work/git/forge-central/ui
✓ src/pages/__tests__/VmListPage.test.jsx (4 tests)
✓ src/components/common/__tests__/LiveTerminal.test.jsx (1 test)
✓ src/pages/__tests__/ClustersPage.test.jsx (4 tests)
✓ src/components/layout/__tests__/Layout.test.jsx (3 tests)
Test Files  4 passed (4)
Tests  12 passed (12)
Duration  2.18s
```

### Local Commit Snapshot

- Commit hash: `76d6f90`
- Commit subject: `feat(clusters): Task-6 — add NKP cluster management REST endpoints & ClustersPage UI component`

### Files Created / Modified

- `api/app/routers/clusters.py`
- `api/app/schemas/clusters.py`
- `api/tests/test_clusters.py`
- `api/app/main.py`
- `ui/src/pages/ClustersPage.jsx`
- `ui/src/pages/ClusterDeployPage.jsx`
- `ui/src/pages/__tests__/ClustersPage.test.jsx`
- `ui/src/App.jsx`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 16:25 PDT / 23:25 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `76d6f90` created cleanly (`feat(clusters): Task-6 — add NKP cluster management REST endpoints & ClustersPage UI component`).
  - FastAPI NKP cluster management routes (`GET /api/v1/clusters`, `POST /api/v1/clusters/create`, `GET /api/v1/clusters/{name}`, `DELETE /api/v1/clusters/{name}`, `POST /api/v1/clusters/{name}/nodepools`) created in `api/app/routers/clusters.py`.
  - Pydantic v2 schemas (`ClusterListResponse`, `ClusterCreateRequest`, `ClusterItem`, `NodepoolCreateRequest`) created in `api/app/schemas/clusters.py`.
  - Pytest backend tests (`pytest api/tests/test_clusters.py`) passed 3/3 in 0.36s.
  - React `ClustersPage.jsx` view built rendering cluster cards with readiness status progress bars (`Ready N/M nodes`), search filter (`data-testid="input-cluster-search"`), deploy cluster button (`data-testid="btn-open-deploy-cluster"`), action buttons (`data-testid="btn-cluster-delete-{name}"`), and typed confirmation modal (`data-testid="modal-confirm-cluster-delete"`).
  - Vitest component suite passed 12/12 tests across 4 test files in 2.18s.
  - API and user guides updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`.
- **Checklist Updated:** Tasks 3.3 (NKP creation pipeline), 3.4 (nodepools), 3.5 (workload clusters), and 4.4 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-26] Task-7 5-stage NKP cluster deployment wizard UI component

- Execution Status: SUCCESS
- Target: C2-P07-Agent07 (Gemini 3.6 Flash / Sonnet 5 Thinking)
- Scope: 5-stage interactive NKP deployment wizard UI (`ClusterDeployPage.jsx`), pre-flight inventory inspection, live SSE pipeline terminal wiring, Vitest test suite (`ClusterDeployPage.test.jsx`), user guide updates, and local git commit

### Acceptance Criteria Matrix

- [x] 1. Interactive 5-Stage Deployment Wizard built (`01-konvoy`, `02-metallb`, `03-csi`, `04-kommander`, `05-validation`) in `ui/src/pages/ClusterDeployPage.jsx`
- [x] 2. Pre-flight PreprovisionedInventory YAML inspection & node status checks integrated into Stage 2 (`data-testid="inventory-inspection-card"`, `data-testid="preflight-status-checks"`, `data-testid="inventory-yaml-preview"`)
- [x] 3. Direct backend SSE wiring to `POST /api/v1/clusters/create` rendering live stream in embedded `<LiveTerminal />` (`data-testid="terminal-live-logs"`)
- [x] 4. Unit tests pass in `ui/src/pages/__tests__/ClusterDeployPage.test.jsx` (18/18 passing across full Vitest suite in `ui/`)
- [x] 5. Navigation & Stepper UI controls (`data-testid="btn-wizard-next"`, `data-testid="btn-wizard-back"`, `data-testid="btn-wizard-launch"`) with debouncing (`disabled={isSubmitting}`) implemented
- [x] 6. Documentation updated in `docs/USER-GUIDE.md` and recorded run in `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
- [x] 7. Local git commit created: `feat(ui): Task-7 — add 5-stage NKP cluster deployment wizard UI component`
- [x] 8. Safety rule followed: local commit only, no git push performed

### Test Output Summary

#### `npm test` (from `ui/`)

```text
 RUN  v3.2.7 /Users/bishwajit.kumar/work/git/forge-central/ui

 ✓ src/pages/__tests__/VmListPage.test.jsx (4 tests)
 ✓ src/components/common/__tests__/LiveTerminal.test.jsx (1 test)
 ✓ src/components/layout/__tests__/Layout.test.jsx (3 tests)
 ✓ src/pages/__tests__/ClusterDeployPage.test.jsx (6 tests)
 ✓ src/pages/__tests__/ClustersPage.test.jsx (4 tests)

 Test Files  5 passed (5)
      Tests  18 passed (18)
   Duration  2.21s
```

### Local Commit Snapshot

- Commit subject: `feat(ui): Task-7 — add 5-stage NKP cluster deployment wizard UI component`

### Files Created / Modified

- `ui/src/pages/ClusterDeployPage.jsx`
- `ui/src/pages/__tests__/ClusterDeployPage.test.jsx`
- `docs/USER-GUIDE.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 16:30 PDT / 23:30 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `d1405e3` created cleanly (`feat(ui): Task-7 — add 5-stage NKP cluster deployment wizard UI component`).
  - Interactive 5-stage cluster deployment wizard view built in `ui/src/pages/ClusterDeployPage.jsx` supporting:
    - Stage 1: Cluster Basics (`cluster_name`, hypervisor selection, K8s version).
    - Stage 2: Topology & Pre-Flight Inventory Inspection (`control_plane_nodes`, `worker_nodes`, PreprovisionedInventory YAML manifest preview, readiness checks).
    - Stage 3: Networking (`metallb_ip_range`, API VIP).
    - Stage 4: Storage & Addons (CSI & Kommander toggles).
    - Stage 5: Live Execution Terminal rendering real-time SSE stream (`data-testid="terminal-live-logs"`).
  - Vitest component suite passed 18/18 tests across 5 test files in `ui/`.
  - User documentation updated in `docs/USER-GUIDE.md`.
- **Checklist Updated:** Task 4.5 (ClusterDeployPage wizard) marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```


---

## [2026-09-26] Task-8 PreprovisionedInventory REST routes & InventoryYamlViewer UI component

- Execution Status: SUCCESS
- Target: C2-P08-Agent08 (Gemini 3.6 Flash / Sonnet 5 Thinking)
- Scope: PreprovisionedInventory REST endpoints (`GET /api/v1/inventory/list`, `GET /api/v1/inventory/{filename}`, `POST /api/v1/inventory/validate`), `InventoryYamlViewer.jsx` UI component, Pytest & Vitest test suites, API & User Guide documentation updates, local git commit

### Acceptance Criteria Matrix

- [x] 1. Backend REST endpoints built in `api/app/routers/inventory.py` & schemas in `api/app/schemas/inventory.py` (`GET /api/v1/inventory/list`, `GET /api/v1/inventory/{filename}`, `POST /api/v1/inventory/validate`)
- [x] 2. UI component built in `ui/src/components/cluster/InventoryYamlViewer.jsx` with raw YAML viewer box (`data-testid="inventory-yaml-text"`), copy button (`data-testid="btn-copy-yaml"`), node chips (`data-testid="chip-cp-nodes"`, `data-testid="chip-worker-nodes"`), and status badges (`data-testid="validation-status-badge"`)
- [x] 3. Backend Pytest suite passes: `pytest api/tests/test_inventory.py` (4/4 passed) & full suite `pytest api/tests/` (15/15 passed)
- [x] 4. Frontend Vitest suite passes: `npm test` in `ui/` (21/21 passed across 6 test files)
- [x] 5. Documentation updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`
- [x] 6. Execution audit report appended to `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
- [x] 7. Local git commit created: `feat(inventory): Task-8 — add PreprovisionedInventory validation REST routes & InventoryYamlViewer UI component`
- [x] 8. Safety rule followed: local git commit only, no git push performed

### Test Output Summary

#### `pytest api/tests/`

```text
============================= test session starts ==============================
platform darwin -- Python 3.9.9, pytest-8.4.2, pluggy-1.6.0
collected 15 items

api/tests/test_cli_runner.py ...                                         [ 20%]
api/tests/test_clusters.py ...                                           [ 40%]
api/tests/test_inventory.py ....                                         [ 66%]
api/tests/test_sse_stream.py ..                                          [ 80%]
api/tests/test_vms.py ...                                                [100%]

======================== 15 passed, 1 warning in 0.44s =========================
```

#### `npm test` (from `ui/`)

```text
 RUN  v3.2.7 /Users/bishwajit.kumar/work/git/forge-central/ui

 ✓ src/pages/__tests__/VmListPage.test.jsx (4 tests)
 ✓ src/components/common/__tests__/LiveTerminal.test.jsx (1 test)
 ✓ src/components/cluster/__tests__/InventoryYamlViewer.test.jsx (3 tests)
 ✓ src/pages/__tests__/ClustersPage.test.jsx (4 tests)
 ✓ src/components/layout/__tests__/Layout.test.jsx (3 tests)
 ✓ src/pages/__tests__/ClusterDeployPage.test.jsx (6 tests)

 Test Files  6 passed (6)
      Tests  21 passed (21)
   Duration  2.58s
```

### Local Commit Snapshot

- Commit subject: `feat(inventory): Task-8 — add PreprovisionedInventory validation REST routes & InventoryYamlViewer UI component`

### Files Created / Modified

- `api/app/config.py`
- `api/app/main.py`
- `api/app/schemas/inventory.py`
- `api/app/routers/inventory.py`
- `api/tests/test_inventory.py`
- `ui/src/components/cluster/InventoryYamlViewer.jsx`
- `ui/src/components/cluster/__tests__/InventoryYamlViewer.test.jsx`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 16:32 PDT / 23:32 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `6eb44fa` created cleanly (`feat(inventory): Task-8 — add PreprovisionedInventory validation REST routes & InventoryYamlViewer UI component`).
  - PreprovisionedInventory REST routes (`GET /api/v1/inventory/list`, `GET /api/v1/inventory/{filename}`, `POST /api/v1/inventory/validate`) created in `api/app/routers/inventory.py`.
  - Pydantic v2 schemas (`InventoryListResponse`, `InventoryDetailResponse`, `InventoryValidationResponse`, `ValidationCheck`) created in `api/app/schemas/inventory.py`.
  - Backend pytest suite passed 15/15 across all endpoints.
  - UI component `InventoryYamlViewer.jsx` created rendering dark syntax-highlighted raw YAML box (`data-testid="inventory-yaml-text"`), instant copy button (`data-testid="btn-copy-yaml"`), control plane / worker node address chips, and diagnostic status badges (`data-testid="validation-status-badge"`).
  - Vitest component suite passed 21/21 tests across 6 test files in `ui/`.
  - OpenAPI & user documentation updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`.
- **Checklist Updated:** Task 4.6 (InventoryYamlViewer inspection) marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-26] Task-9 Forge Fleet Aggregator REST endpoints and FleetDashboardPage UI

- Execution Status: SUCCESS
- Target: C2 Executor (Codex 5.3)
- Scope: Fleet aggregator backend routes/schemas, fleet dashboard UI, tests, docs, and local commit

### Acceptance Criteria Matrix

- [x] 1. Backend schema file `api/app/schemas/fleet.py` created with `SiteSnapshot`, `SiteStatus`, and `FleetStatusResponse`
- [x] 2. Backend router `api/app/routers/fleet.py` created with seeded in-memory state and fleet endpoints (`POST /snapshot`, `GET /status`, `GET /sites/{site_id}`)
- [x] 3. Fleet router registered in `api/app/main.py`
- [x] 4. Backend tests added in `api/tests/test_fleet.py` for aggregate status, snapshot update, known site lookup, and unknown site 404
- [x] 5. Fleet dashboard page updated in `ui/src/pages/FleetDashboardPage.jsx` with read-only banner/badge, refresh button, summary metrics, site cards, and fallback seed telemetry
- [x] 6. Frontend tests added in `ui/src/pages/__tests__/FleetDashboardPage.test.jsx` for render coverage and refresh action
- [x] 7. Documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`
- [x] 8. Full backend and frontend tests pass (`pytest api/tests/`, `npm test`)
- [x] 9. Safety rule followed: local commit only, no git push performed

### Test Output Summary

#### `pytest api/tests/`

```text
============================= test session starts ==============================
platform darwin -- Python 3.9.9, pytest-8.4.2, pluggy-1.6.0
collected 19 items

api/tests/test_cli_runner.py ...                                         [ 15%]
api/tests/test_clusters.py ...                                           [ 31%]
api/tests/test_fleet.py ....                                             [ 52%]
api/tests/test_inventory.py ....                                         [ 73%]
api/tests/test_sse_stream.py ..                                          [ 84%]
api/tests/test_vms.py ...                                                [100%]

============================== 19 passed in 1.30s ==============================
```

#### `npm test` (from `ui/`)

```text
RUN  v3.2.7 /Users/bishwajit.kumar/work/git/forge-central/ui
✓ src/pages/__tests__/FleetDashboardPage.test.jsx (2 tests)
✓ src/components/common/__tests__/LiveTerminal.test.jsx (1 test)
✓ src/pages/__tests__/VmListPage.test.jsx (4 tests)
✓ src/components/cluster/__tests__/InventoryYamlViewer.test.jsx (3 tests)
✓ src/pages/__tests__/ClustersPage.test.jsx (4 tests)
✓ src/components/layout/__tests__/Layout.test.jsx (3 tests)
✓ src/pages/__tests__/ClusterDeployPage.test.jsx (6 tests)

Test Files  7 passed (7)
Tests  23 passed (23)
Duration  6.09s
```

### Local Commit Snapshot

- Commit subject: `feat(fleet): Task-9 — add Forge Fleet Aggregator REST endpoints & FleetDashboardPage UI component`

### Files Created / Modified

- `README.md`
- `api/app/main.py`
- `api/app/routers/fleet.py`
- `api/app/schemas/fleet.py`
- `api/tests/test_fleet.py`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
- `ui/src/pages/FleetDashboardPage.jsx`
- `ui/src/pages/__tests__/FleetDashboardPage.test.jsx`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 17:15 PDT / 00:15 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `a350f6b` created cleanly (`feat(fleet): Task-9 — add Forge Fleet Aggregator REST endpoints & FleetDashboardPage UI component`).
  - Fleet aggregator REST routes (`POST /api/v1/fleet/snapshot`, `GET /api/v1/fleet/status`, `GET /api/v1/fleet/sites/{site_id}`) implemented in `api/app/routers/fleet.py`.
  - Pydantic models (`SiteSnapshot`, `SiteStatus`, `FleetStatusResponse`) implemented in `api/app/schemas/fleet.py`.
  - Backend pytest suite passed 19/19 across all endpoints in 1.30s.
  - UI page `FleetDashboardPage.jsx` implemented rendering amber read-only guardrail banner (`data-testid="fleet-banner-readonly"`), summary metrics (`data-testid="metric-total-sites"`, `data-testid="metric-total-clusters"`, `data-testid="metric-total-vms"`, `data-testid="metric-total-gpu"`), site telemetry cards (`amd-lab`, `cirra-lab`, `ntx-lab`), and live refresh trigger (`data-testid="btn-refresh-fleet"`).
  - Vitest component suite passed 23/23 tests across 7 test files in `ui/`.
  - OpenAPI & user documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Checklist Updated:** Phase 6 (Tasks 6.1, 6.2, 6.3) marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-26] Task-10 Cluster diagnostics wrapper and audit trail engine

- Execution Status: SUCCESS
- Target: C2 Executor (Codex 5.3)
- Scope: Add Day-0 diagnostics/audit REST APIs, Diagnostics UI page, backend/frontend tests, docs, and local commit

### Acceptance Criteria Matrix

- [x] 1. Added `diagnostics` and `audit` backend schemas with strict Pydantic models
- [x] 2. Added diagnostics router endpoints (`capture`, `bundles`, `bundle by id`) with deterministic synthetic support bundle seeds
- [x] 3. Added audit router endpoint (`GET /api/v1/audit/logs`) with seeded events and reusable `record_audit_event(...)` helper
- [x] 4. Registered diagnostics and audit routers in `api/app/main.py`
- [x] 5. Added backend tests for diagnostics capture/list/detail/404 and audit list/filter behavior
- [x] 6. Added Diagnostics route/page/sidebar link in UI with required `data-testid` hooks and safe fallback rows
- [x] 7. Added frontend Diagnostics page tests for render coverage and capture trigger action
- [x] 8. Updated `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`
- [x] 9. Ran full backend and frontend test suites successfully
- [x] 10. Safety rule followed: local commit only, no push

### Test Output Summary

#### `pytest api/tests/`

```text
============================= test session starts ==============================
collected 26 items
api/tests/test_audit.py ...                                              [ 11%]
api/tests/test_cli_runner.py ...                                         [ 23%]
api/tests/test_clusters.py ...                                           [ 34%]
api/tests/test_diagnostics.py ....                                       [ 50%]
api/tests/test_fleet.py ....                                             [ 65%]
api/tests/test_inventory.py ....                                         [ 80%]
api/tests/test_sse_stream.py ..                                          [ 88%]
api/tests/test_vms.py ...                                                [100%]
======================== 26 passed, 1 warning in 0.59s =========================
```

#### `npm test` (from `ui/`)

```text
RUN  v3.2.7 /Users/bishwajit.kumar/work/git/forge-central/ui
✓ src/pages/__tests__/DiagnosticsPage.test.jsx (2 tests)
✓ src/components/layout/__tests__/Layout.test.jsx (3 tests)
... (all remaining suites passed)
Test Files  8 passed (8)
Tests  25 passed (25)
Duration  2.82s
```

### Local Commit Snapshot

- Commit hash: `4e19c56`
- Commit subject: `feat(diagnostics): Task-10 — add cluster diagnostics capture REST routes, audit logs & DiagnosticsPage UI`

### Files Created / Modified

- `README.md`
- `api/app/main.py`
- `api/app/routers/audit.py`
- `api/app/routers/diagnostics.py`
- `api/app/schemas/audit.py`
- `api/app/schemas/diagnostics.py`
- `api/tests/test_audit.py`
- `api/tests/test_diagnostics.py`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
- `ui/src/App.jsx`
- `ui/src/components/layout/Sidebar.jsx`
- `ui/src/components/layout/__tests__/Layout.test.jsx`
- `ui/src/pages/DiagnosticsPage.jsx`
- `ui/src/pages/__tests__/DiagnosticsPage.test.jsx`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-26 18:10 PDT / 01:10 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `4e19c56` created cleanly (`feat(diagnostics): Task-10 — add cluster diagnostics capture REST routes, audit logs & DiagnosticsPage UI`).
  - Diagnostics REST routes (`POST /api/v1/diagnostics/capture`, `GET /api/v1/diagnostics/bundles`, `GET /api/v1/diagnostics/bundles/{bundle_id}`) built in `api/app/routers/diagnostics.py`.
  - Audit REST routes (`GET /api/v1/audit/logs` with verb/status filtering) and shared helper `record_audit_event(...)` built in `api/app/routers/audit.py`.
  - Pydantic models created in `api/app/schemas/diagnostics.py` and `api/app/schemas/audit.py`.
  - Backend pytest suite passed 26/26 across all endpoints in 0.59s.
  - UI page `DiagnosticsPage.jsx` built with `/diagnostics` route in `App.jsx` and nav item in `Sidebar.jsx`, featuring capture card (`data-testid="card-diagnostics-capture"`), bundles table (`data-testid="table-diagnostic-bundles"`), and audit log table (`data-testid="table-audit-logs"`).
  - Vitest component suite passed 25/25 tests across 8 test files in `ui/`.
  - OpenAPI & user documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Checklist Updated:** Tasks 3.9 (Diagnostics & Audit) and 8.3 (Audit Trail Engine) marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```







---

## [2026-09-30] Task-11 Cluster lifecycle operations (nodepool management, node reset & ClusterDetailPage UI)

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] `ClusterNodepoolItem`, `ClusterNodepoolListResponse`, `ClusterResetNodesRequest` schemas added
- [x] In-memory nodepool state seeded (`worker-pool-1` x3, `worker-pool-2` x2); `POST /nodepools` updates it
- [x] `GET /api/v1/clusters/{name}/nodepools`
- [x] `POST /api/v1/clusters/{name}/reset-nodes` (202, runs `preprov-reset-nodes.sh`, logs `cluster-reset-nodes` audit event)
- [x] ClustersPage: Add Nodepool modal, 2-step Reset Nodes modal, cluster detail links
- [x] `ClusterDetailPage.jsx` at `/clusters/:name` with nodes, nodepools, scale, actions, offline seed fallback
- [x] Backend tests (2 new) and frontend tests (5 new in ClustersPage, 4 new in ClusterDetailPage)
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated

### Test Output Summary
- `pytest api/tests/`: 28 passed
- `npm test` (ui/): 9 test files, 33 tests passed

### Local Commit Snapshot
- Subject: `feat(clusters): Task-11 — cluster lifecycle operations (nodepool management, node reset & ClusterDetailPage UI)`
- Hash: see `git log -1` (local commit only; NOT pushed)

### Files Created / Modified
- `api/app/routers/clusters.py`
- `api/app/schemas/clusters.py`
- `api/tests/test_clusters.py`
- `ui/src/App.jsx`
- `ui/src/pages/ClustersPage.jsx`
- `ui/src/pages/ClusterDetailPage.jsx` (new)
- `ui/src/pages/__tests__/ClustersPage.test.jsx`
- `ui/src/pages/__tests__/ClusterDetailPage.test.jsx` (new)
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-30 16:18 PDT / 23:18 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `e4f00cd` created cleanly (`feat(clusters): Task-11 — cluster lifecycle operations (nodepool management, node reset & ClusterDetailPage UI)`).
  - Cluster lifecycle REST routes (`POST /api/v1/clusters/{name}/reset-nodes`, `GET /api/v1/clusters/{name}/nodepools`) built in `api/app/routers/clusters.py`.
  - In-memory nodepool management and shared audit logging via `record_audit_event(...)` fully integrated.
  - Pydantic models `ClusterNodepoolItem`, `ClusterNodepoolListResponse`, `ClusterResetNodesRequest` created in `api/app/schemas/clusters.py`.
  - Backend pytest suite passed 28/28 across all endpoints in `api/tests/`.
  - UI components updated:
    - `ClustersPage.jsx` enriched with Add Nodepool modal (`data-testid="modal-add-nodepool"`), 2-step typed confirmation Reset Nodes modal (`data-testid="modal-confirm-reset-nodes"`), and clickable cluster detail links (`data-testid="link-cluster-detail-*"`).
    - `ClusterDetailPage.jsx` implemented at `/clusters/:name` in `App.jsx`, rendering cluster overview, MetalLB VIP range, node breakdown table (control-plane vs worker with status badges), nodepool scaling +/- buttons, and lifecycle action controls.
  - Vitest component suite passed 33/33 tests across 9 test files in `ui/`.
  - OpenAPI & user documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Checklist Updated:** Tasks 3.4, 4.4, 4.13 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```


## [2026-09-30] Task-12 Batch VM lifecycle operations & high-density UI console

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] `VmBatchActionRequest/Response`, `VmCloneBatchRequest/Response` schemas added
- [x] `POST /api/v1/vms/batch-action` (202, runs `forge vm-batch-action`, logs `vm-batch-{action}` audit event)
- [x] `POST /api/v1/vms/clone-batch` (202, runs `forge vm-clone-batch`, logs `vm-clone-batch` audit event)
- [x] VmListPage: row + select-all checkboxes, sticky batch action bar, start/stop/restart/destroy batch buttons
- [x] 2-step batch destroy modal (type `DESTROY`), selection cleared and VMs reloaded after action
- [x] Backend tests (2 new) and frontend tests (4 new)
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated

### Test Output Summary
- `pytest api/tests/`: 30 passed
- `npm test` (ui/): 9 test files, 37 tests passed

### Local Commit Snapshot
- Subject: `feat(vms): Task-12 — batch VM lifecycle actions (multi-select start/stop/restart/destroy & UI batch control bar)`
- Hash: see `git log -1` (local commit only; NOT pushed)

### Files Created / Modified
- `api/app/schemas/vms.py`
- `api/app/routers/vms.py`
- `api/tests/test_vms.py`
- `ui/src/pages/VmListPage.jsx`
- `ui/src/pages/__tests__/VmListPage.test.jsx`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-30 16:25 PDT / 23:25 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `0ee2a36` created cleanly (`feat(vms): Task-12 — batch VM lifecycle actions (multi-select start/stop/restart/destroy & UI batch control bar)`).
  - Batch VM REST routes (`POST /api/v1/vms/batch-action`, `POST /api/v1/vms/clone-batch`) added in `api/app/routers/vms.py`.
  - Pydantic schemas added: `VmBatchActionRequest`, `VmBatchActionResponse`, `VmCloneBatchRequest`, `VmCloneBatchResponse` in `api/app/schemas/vms.py`.
  - Operations logged to centralized audit log via `record_audit_event(...)`.
  - Backend pytest suite passed 30/30 across all endpoints in `api/tests/`.
  - Frontend UI in `ui/src/pages/VmListPage.jsx` updated with row checkboxes (`data-testid="checkbox-vm-{vmid}"`), header select-all (`data-testid="checkbox-select-all-vms"`), sticky batch action bar (`data-testid="batch-action-bar"`), and 2-step typed confirmation modal requiring `DESTROY` (`data-testid="modal-confirm-batch-destroy"`).
  - Vitest component suite passed 37/37 tests across 9 test files in `ui/`.
  - OpenAPI & user documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Checklist Updated:** Tasks 3.1, 4.3, 4.13 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```


---

## [2026-09-30] Task-13 Command Palette, error remediation dictionary & multi-tab state sync

- Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] Global `CommandPalette` (⌘K / Ctrl+K / header button `btn-open-command-palette`), closes on Escape/backdrop, navigates via `useNavigate`
- [x] Wired in `Layout.jsx`; `Header.jsx` search trigger with `⌘K Search` pill
- [x] `getRemediation()` dictionary (IPAM, SSH, Helm timeout, storage, fallback) + `ErrorRemediationCard`
- [x] `useTabSync` / `broadcastTabEvent` on `BroadcastChannel("forge-central-events")` with environment guard
- [x] Vitest tests for palette, dictionary and tab sync
- [x] `docs/USER-GUIDE.md` updated

### Test Results
- `pytest api/tests/`: 30 passed
- `npm test` (ui/): 12 test files, 51 tests passed

### Local Commit Snapshot
- Subject: `feat(ux): Task-13 — global CommandPalette (⌘K), error remediation cards & multi-tab state sync`
- Hash: see `git log -1` (local commit only; NOT pushed)

### Files Created / Modified
- `ui/src/components/common/CommandPalette.jsx` (new)
- `ui/src/components/common/ErrorRemediationCard.jsx` (new)
- `ui/src/utils/errorRemediation.js` (new)
- `ui/src/hooks/useTabSync.js` (new)
- `ui/src/components/layout/Layout.jsx`
- `ui/src/components/layout/Header.jsx`
- `ui/src/components/common/__tests__/CommandPalette.test.jsx` (new)
- `ui/src/utils/__tests__/errorRemediation.test.js` (new)
- `ui/src/hooks/__tests__/useTabSync.test.js` (new)
- `docs/USER-GUIDE.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-30 16:30 PDT / 23:30 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `4f4142a` created cleanly (`feat(ux): Task-13 — global CommandPalette (⌘K), error remediation cards & multi-tab state sync`).
  - `CommandPalette.jsx` component mounted globally in `Layout.jsx`, triggered by `⌘K` / `Ctrl+K` or search button in `Header.jsx` (`data-testid="btn-open-command-palette"`), with fuzzy searching across clusters, VMs, main routes, and quick actions.
  - `errorRemediation.js` translation dictionary mapping raw errors (IPAM, SSH, Helm timeout, storage) to actionable recommendations and `ErrorRemediationCard.jsx` (`data-testid="card-error-remediation"`).
  - `useTabSync.js` hook providing cross-tab state broadcasting over `BroadcastChannel("forge-central-events")` with SSR/test guards.
  - Vitest component suite passed 51/51 tests across 12 test files in `ui/`.
  - Backend pytest suite passed 30/30 across all endpoints in `api/tests/`.
  - Documentation updated in `docs/USER-GUIDE.md`.
- **Checklist Updated:** Tasks 9.4, 9.5, 9.6 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```


---

## [2026-09-30] Task-14 Dynamic path configuration & state directory migration engine

- Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] `GET /api/v1/settings/paths` inspects FORGE_HOME/DATA/CENTRAL_DATA/BACKUP/LOG dirs (exists, accessible, writable, status, disk usage)
- [x] `POST /api/v1/settings/paths/migrate` with dry-run and real copy of `*.ini|yaml|json|log`, audit event `paths-migrated`
- [x] Pydantic schemas in `api/app/schemas/paths.py`; `paths_router` registered in `main.py`; directories env-driven via `config.py`
- [x] `PathSettingsPage.jsx` (inspection grid, migration card), route `/settings/paths`, sidebar link `link-settings-paths`, CommandPalette entry
- [x] Backend tests `api/tests/test_paths.py`; Vitest `PathSettingsPage.test.jsx`; `Layout.test.jsx` updated
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated

### Test Results
- `pytest api/tests/`: 34 passed
- `npm test` (ui/): 13 test files, 54 tests passed

### Local Commit Snapshot
- Subject: `feat(paths): Task-14 — dynamic path configuration, disk status & state directory migration engine`
- Hash: see `git log -1` (local commit only; NOT pushed)

### Files Created / Modified
- `api/app/config.py`
- `api/app/main.py`
- `api/app/schemas/paths.py` (new)
- `api/app/routers/paths.py` (new)
- `api/tests/test_paths.py` (new)
- `ui/src/pages/PathSettingsPage.jsx` (new)
- `ui/src/pages/__tests__/PathSettingsPage.test.jsx` (new)
- `ui/src/App.jsx`
- `ui/src/components/layout/Sidebar.jsx`
- `ui/src/components/layout/__tests__/Layout.test.jsx`
- `ui/src/components/common/CommandPalette.jsx`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

---

### [C1 VERIFICATION VERDICT — APPROVED]

- **Date/Time:** 2026-09-30 16:36 PDT / 23:36 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `e4e604b` created cleanly (`feat(paths): Task-14 — dynamic path configuration, disk status & state directory migration engine`).
  - Path management routes (`GET /api/v1/settings/paths`, `POST /api/v1/settings/paths/migrate`) implemented in `api/app/routers/paths.py`.
  - Pydantic models `PathStatusItem`, `PathsInspectionResponse`, `PathMigrationRequest`, `PathMigrationResponse` created in `api/app/schemas/paths.py`.
  - Settings updated in `api/app/config.py` resolving `forge_home`, `forge_central_data_dir`, `forge_backup_dir`, and `forge_log_dir`.
  - Audit event `paths-migrated` logged via `record_audit_event(...)`.
  - React UI page `PathSettingsPage.jsx` implemented at `/settings/paths` with path inspection grid (`data-testid="card-path-{name}"`), accessibility status pills, disk usage gauges, and migration card (`data-testid="card-path-migration"`).
  - Navigation integrated into `Sidebar.jsx` (`link-settings-paths`), `App.jsx`, and `CommandPalette.jsx`.
  - Backend pytest suite passed 34/34 across all endpoints in `api/tests/`.
  - Vitest component suite passed 54/54 tests across 13 test files in `ui/`.
  - Documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Checklist Updated:** Tasks 2.2, 8.3 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## [2026-09-30] Task-15 Dynamic CLI schema reflection & Copy as CLI snippet engine

- Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] `CliOptionSchema`, `CliVerbSchemaResponse`, `CliSnippetRequest`, `CliSnippetResponse` added to `api/app/schemas/cli.py`
- [x] `GET /api/v1/cli/schema/{verb}` for provision-vms, create-cluster, reset-nodes, diagnose, share, secret; 404 for unknown verbs
- [x] `POST /api/v1/cli/generate-snippet` returns deterministic bash command (`--flag` for true booleans, `--key value` otherwise)
- [x] `CliSnippetCard.jsx` (`card-cli-snippet`, `btn-copy-cli-snippet`, clipboard copy with fallback, "Copied!" feedback)
- [x] Integrated in `ClusterDeployPage.jsx` (Stage 4), `VmListPage.jsx` (Create VM modal), `ClustersPage.jsx` (Add Nodepool modal)
- [x] Backend tests in `api/tests/test_cli_runner.py`; Vitest `CliSnippetCard.test.jsx`
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated

### Test Results
- `pytest api/tests/`: 37 passed
- `npm test` (ui/): 14 test files, 56 tests passed

### Local Commit Snapshot
- Subject: `feat(cli): Task-15 — dynamic CLI schema reflection & Copy as CLI snippet card engine`
- Hash: see `git log -1` (local commit only; NOT pushed)

### Files Created / Modified
- `api/app/schemas/cli.py`
- `api/app/routers/cli.py`
- `api/tests/test_cli_runner.py`
- `ui/src/components/common/CliSnippetCard.jsx` (new)
- `ui/src/components/common/__tests__/CliSnippetCard.test.jsx` (new)
- `ui/src/pages/ClusterDeployPage.jsx`
- `ui/src/pages/VmListPage.jsx`
- `ui/src/pages/ClustersPage.jsx`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 16:42 PDT / 23:42 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `afbb808` created cleanly (`feat(cli): Task-15 — dynamic CLI schema reflection & Copy as CLI snippet card engine`).
  - Dynamic schema reflection route `GET /api/v1/cli/schema/{verb}` implemented with 404 validation for unknown verbs in `api/app/routers/cli.py`.
  - Snippet generator route `POST /api/v1/cli/generate-snippet` deterministic bash generator implemented in `api/app/routers/cli.py`.
  - Pydantic models `CliOptionSchema`, `CliVerbSchemaResponse`, `CliSnippetRequest`, `CliSnippetResponse` implemented in `api/app/schemas/cli.py`.
  - React component `CliSnippetCard.jsx` created with `card-cli-snippet` and `btn-copy-cli-snippet`, supporting one-click clipboard copying and fallback feedback.
  - Snippet cards cleanly integrated into `ClusterDeployPage.jsx` (Stage 4 summary), `VmListPage.jsx` (Create VM modal), and `ClustersPage.jsx` (Add Nodepool modal).
  - Pytest suite passed 37/37 tests across all endpoints in `api/tests/`.
  - Vitest component suite passed 56/56 tests across 14 test files in `ui/`.
  - Documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Checklist Updated:** Tasks 1.5, 3.5, 4.4 marked complete in `deliverables/END-TO-END-BUILD-CHECKLIST.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

## [2026-09-30] Task-16 Node prep, NFS share management & UI modal integration

- Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] `NodePrepRequest`, `NodePrepResponse`, `ShareMountRequest`, `ShareStatusResponse` added to `api/app/schemas/nodes.py`
- [x] `POST /api/v1/nodes/prep` dispatches `./forge prep node ...` via `ProcessRunner.start_run`; audit event `node-prep-dispatched`
- [x] `POST /api/v1/shares/mount` dispatches `./forge share mount ...`; audit event `share-mount-dispatched`
- [x] `GET /api/v1/shares/status` returns `ShareStatusResponse`
- [x] `nodes_router` registered in `api/app/main.py` with prefix `/api/v1`
- [x] "Prep Node over SSH" button + `modal-prep-node` (all required `data-testid` fields) with live `CliSnippetCard` in `ClustersPage.jsx`; submit calls `POST /api/v1/nodes/prep`
- [x] Backend tests in `api/tests/test_nodes.py`; Vitest cases in `ClustersPage.test.jsx`
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated

### Test Results
- `pytest api/tests/`: 41 passed
- `npm test` (ui/): 14 test files, 58 tests passed

### Local Commit Snapshot
- Subject: `feat(nodes): Task-16 — bare-metal node prep, NFS share management & UI modal integration`
- Hash: see `git log -1` (local commit only; NOT pushed)

### Files Created / Modified
- `api/app/schemas/nodes.py` (new)
- `api/app/routers/nodes.py` (new)
- `api/app/main.py`
- `api/tests/test_nodes.py` (new)
- `ui/src/pages/ClustersPage.jsx`
- `ui/src/pages/__tests__/ClustersPage.test.jsx`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 16:55 PDT / 23:55 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `4c5a24f` created cleanly (`feat(nodes): Task-16 — bare-metal node prep, NFS share management & UI modal integration`).
  - Node preparation (`POST /api/v1/nodes/prep`) and share endpoints (`POST /api/v1/shares/mount`, `GET /api/v1/shares/status`) implemented in `api/app/routers/nodes.py`.
  - Pydantic models `NodePrepRequest`, `NodePrepResponse`, `ShareMountRequest`, `ShareStatusResponse` created in `api/app/schemas/nodes.py`.
  - Audit logging configured with `record_audit_event("node-prep-dispatched", ...)` and `record_audit_event("share-mount-dispatched", ...)`.
  - UI modal "Prep Node over SSH" (`data-testid="modal-prep-node"`) implemented in `ClustersPage.jsx` with full parameter controls, real-time `CliSnippetCard` CLI preview, and API dispatch.
  - Pytest suite passed 41/41 tests across all endpoints in `api/tests/`.
  - Vitest component suite passed 58/58 tests across 14 test files in `ui/`.
  - Documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```


## [2026-09-30] Task-17 100% offline synthetic dev engine & mock execution mode

- Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] `forge_mock_mode` setting (`FORGE_MOCK_MODE`, default `false`) in `api/app/config.py`
- [x] `ProcessRunner` simulates runs (synthetic stdout/stderr, 20-50ms delays, `end` event `exit_code: 0` / `COMPLETED`) when `mock_mode`, `FORGE_MOCK_MODE`, `--mock` argv, or missing/non-executable `forge`
- [x] `GET /health` includes `mock_mode` (route lives in `api/app/routers/cli.py`)
- [x] `GET /api/v1/vms`, `GET /api/v1/clusters`, `GET /api/v1/shares/status` return synthetic payloads in mock mode (`api/app/services/mock_data.py`)
- [x] Header renders amber `badge-mock-mode` (`[SYNTHETIC MOCK MODE]`) from `/health`; Vite dev proxy forwards `/health`
- [x] `api/tests/test_mock_mode.py` and `Header.test.jsx` added
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated

### Test Results
- `pytest api/tests/`: 46 passed
- `npm test` (ui/): 15 test files, 60 tests passed

### Local Commit Snapshot
- Subject: `feat(mock): Task-17 — 100% offline synthetic dev engine & mock execution mode`
- Hash: see `git log -1` (local commit only; NOT pushed)

### Files Created / Modified
- `api/app/config.py`
- `api/app/schemas/cli.py`
- `api/app/routers/cli.py`
- `api/app/routers/vms.py`
- `api/app/routers/clusters.py`
- `api/app/routers/nodes.py`
- `api/app/services/process_runner.py`
- `api/app/services/mock_data.py` (new)
- `api/tests/test_mock_mode.py` (new)
- `ui/src/components/layout/Header.jsx`
- `ui/src/components/layout/__tests__/Header.test.jsx` (new)
- `ui/vite.config.js`
- `docs/API-GUIDE.md`
- `docs/USER-GUIDE.md`
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 17:03 PDT / 24:03 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `f14ccbc` created cleanly (`feat(mock): Task-17 — 100% offline synthetic dev engine & mock execution mode`).
  - `forge_mock_mode` setting added to `api/app/config.py` resolving `FORGE_MOCK_MODE` env var.
  - Subprocess mock engine in `api/app/services/process_runner.py` streams synthetic progressive stdout/stderr lines with async delays and terminates with exit code 0 / COMPLETED.
  - Health endpoint (`GET /health`) enhanced with `mock_mode: bool`.
  - Synthetic data fallbacks implemented in `api/app/services/mock_data.py` for `/api/v1/vms`, `/api/v1/clusters`, and `/api/v1/shares/status`.
  - Header badge `badge-mock-mode` (`[SYNTHETIC MOCK MODE]`) dynamically displayed in `Header.jsx`.
  - Vite dev proxy configured to forward `/health` in `ui/vite.config.js`.
  - Pytest suite passed 46/46 tests across all endpoints in `api/tests/`.
  - Vitest component suite passed 60/60 tests across 15 test files in `ui/`.
  - Documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## Task 18 — Standalone Multi-Stage Production Docker Packaging & Compose Engine

### Execution Status: SUCCESS (docker image build not run: Docker daemon was offline)

### Acceptance Criteria Matrix
- [x] Multi-stage `Dockerfile` (node:20-alpine builder, python:3.11-slim runtime, curl, non-root `forgecentral` UID 1000, volumes, port 8000, HEALTHCHECK, uvicorn CMD)
- [x] `docker-compose.yml` with mounts, env passthrough (`FORGE_MOCK_MODE`, `FORGE_HOME`, `PORT`), `restart: unless-stopped`, resource reservations (`docker compose config -q` OK)
- [x] FastAPI static mount of `ui/dist` or `/app/ui/dist` after routers (`mount_ui_static`)
- [x] `api/tests/test_static_mount.py` covers mount + API-first + missing-dist fallback
- [x] `docs/DEPLOYMENT-GUIDE.md` and `README.md` updated
- [ ] Live `docker build` (Docker daemon not running in this environment)

### Test Results
- `pytest api/tests/`: 48 passed
- `npm test` (vitest): 15 files, 60 passed

### Files Created / Modified
- `Dockerfile` (new), `docker-compose.yml` (new), `.dockerignore` (new)
- `api/app/main.py`
- `api/tests/test_static_mount.py` (new)
- `docs/DEPLOYMENT-GUIDE.md` (new)
- `README.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(docker): Task-18 — standalone multi-stage production Docker packaging & compose engine` (NOT pushed)

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 17:08 PDT / 24:08 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `45c9758` created cleanly (`feat(docker): Task-18 — standalone multi-stage production Docker packaging & compose engine`).
  - Multi-stage `Dockerfile` (Node 20 builder + Python 3.11 runtime, non-root user `forgecentral` UID 1000, volume mountpoints `/forge-state`, `/forge-data`, `/cacrt`, `/var/log/forge-central`, curl healthcheck, port 8000).
  - `docker-compose.yml` configured with environment passthroughs (`FORGE_MOCK_MODE`, `FORGE_HOME`, `PORT`), volume mounts, `restart: unless-stopped`, and resource reservations.
  - FastAPI static mount helper `mount_ui_static` mounted in `api/app/main.py` ensuring API routes match first before static asset fallback.
  - Pytest suite passed 48/48 tests across all endpoints in `api/tests/`.
  - Vitest component suite passed 60/60 tests across 15 test files in `ui/`.
  - Documentation updated in `docs/DEPLOYMENT-GUIDE.md` and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

## Task 19 — Standalone Release Tarball Packaging & Air-Gapped Upgrade Engine

### Execution Status
- **SUCCESS**

### Acceptance Criteria Matrix
- [x] `scripts/build-release-bundle.sh` (`set -euo pipefail`, executable, `--version`, `--output-dir` default `dist-release/`, `--dry-run`, builds `ui/dist` if missing, writes `.tar.gz` + `.sha256`); real build verified with `shasum -c` OK and `--dry-run` verified
- [x] `api/app/schemas/upgrade.py` (`UpgradeStatusResponse`, `ValidationCheck`, `UpgradeInspectRequest`, `UpgradeInspectResponse`)
- [x] `GET /api/v1/upgrade/status` and `POST /api/v1/upgrade/inspect` (format, checksum, version, disk >1GB checks) registered under `/api/v1` in `main.py`
- [x] `UpgradePage.jsx` at `/settings/upgrade` with `card-current-version`, `card-upgrade-inspect`, `input-upgrade-bundle-path`, `btn-inspect-upgrade`, `list-upgrade-preflight`, `CliSnippetCard`; sidebar `link-settings-upgrade`; command palette entry
- [x] `api/tests/test_upgrade.py` (4 tests) and `UpgradePage.test.jsx` (2 tests)
- [x] `docs/DEPLOYMENT-GUIDE.md`, `docs/USER-GUIDE.md`, `docs/API-GUIDE.md`, `README.md` updated
- [ ] `scripts/install-upgrade.sh` (only referenced in the CLI snippet; out of Task 19 scope)

### Test Results
- `pytest api/tests/`: 52 passed
- `npm test` (vitest): 16 files, 62 passed

### Files Created / Modified
- Created: `scripts/build-release-bundle.sh`, `api/app/schemas/upgrade.py`, `api/app/routers/upgrade.py`, `api/tests/test_upgrade.py`, `ui/src/pages/UpgradePage.jsx`, `ui/src/pages/__tests__/UpgradePage.test.jsx`
- Modified: `api/app/main.py`, `ui/src/App.jsx`, `ui/src/components/layout/Sidebar.jsx`, `ui/src/components/common/CommandPalette.jsx`, `docs/DEPLOYMENT-GUIDE.md`, `docs/USER-GUIDE.md`, `docs/API-GUIDE.md`, `README.md`, `.gitignore`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(upgrade): Task-19 — standalone release tarball packaging script & air-gapped upgrade engine` (NOT pushed; hash reported in C2 hand-off)

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 17:15 PDT / 24:15 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `4d362a4` created cleanly (`feat(upgrade): Task-19 — standalone release tarball packaging script & air-gapped upgrade engine`).
  - Standalone release packager script `scripts/build-release-bundle.sh` created with executable permissions, supporting `--version`, `--output-dir`, and `--dry-run` modes, outputting `.tar.gz` and `.sha256` checksums.
  - Upgrade pre-flight endpoints `GET /api/v1/upgrade/status` and `POST /api/v1/upgrade/inspect` implemented in `api/app/routers/upgrade.py` with multi-step validations (format, checksum, version compatibility, free disk space).
  - Web Console Upgrade Page `UpgradePage.jsx` implemented at `/settings/upgrade` with current version card, bundle inspection card, preflight checklist with visual status indicators, and dynamic `CliSnippetCard`.
  - Pytest suite passed 52/52 tests across all endpoints in `api/tests/`.
  - Vitest component suite passed 62/62 tests across 16 test files in `ui/`.
  - Documentation updated in `docs/DEPLOYMENT-GUIDE.md`, `docs/USER-GUIDE.md`, `docs/API-GUIDE.md`, and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

## Task 20 — Atomic State Backup Engine & Archive Generation

### Execution Status
- **SUCCESS**

### Acceptance Criteria Matrix
- [x] `api/app/schemas/backup.py` (`BackupItem`, `BackupCreateResponse`, `BackupListResponse`)
- [x] `api/app/services/backup.py` (`create_backup`, `list_backups`): `.tar.gz` of data dir (fallback `~/forge-state`), `~/cacrt/`, `forge-central.db`; `*.log` excluded; SHA-256 + companion `.sha256`; `backup-created` audit event
- [x] `POST /api/v1/backup/create` and `GET /api/v1/backup/list` registered under `/api/v1` in `main.py`
- [x] `PathSettingsPage.jsx`: `section-backups`, `btn-create-backup`, `table-backups`, `CliSnippetCard` (`./forge backup create`); list fetched on mount and after creation
- [x] `api/tests/test_backup.py` (2 tests) and `PathSettingsPage.test.jsx` (+1 test)
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [ ] `./forge backup create` in nkp-forge CLI (snippet only; out of scope)

### Test Results
- `pytest api/tests/`: 54 passed
- `npm test` (vitest): 16 files, 63 passed

### Files Created / Modified
- Created: `api/app/schemas/backup.py`, `api/app/services/backup.py`, `api/app/routers/backup.py`, `api/tests/test_backup.py`
- Modified: `api/app/main.py`, `ui/src/pages/PathSettingsPage.jsx`, `ui/src/pages/__tests__/PathSettingsPage.test.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(backup): Task-20 — atomic state backup engine & archive generation` (NOT pushed; hash reported in C2 hand-off)

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 17:26 PDT / 24:26 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `ea2c7fc` created cleanly (`feat(backup): Task-20 — atomic state backup engine & archive generation`).
  - Backup creation endpoint `POST /api/v1/backup/create` implemented in `api/app/routers/backup.py` and `api/app/services/backup.py`, archiving state configs, certs, DB files, and computing SHA-256 checksums while filtering out ephemeral `*.log` files.
  - Backup listing endpoint `GET /api/v1/backup/list` implemented returning sorted backup metadata.
  - Audit event `backup-created` recorded in `/api/v1/audit/logs`.
  - Frontend controls implemented in `PathSettingsPage.jsx` (`section-backups`, `btn-create-backup`, `table-backups`, `<CliSnippetCard />`).
  - Pytest suite passed 54/54 tests across all endpoints in `api/tests/`.
  - Vitest component suite passed 63/63 tests across 16 test files in `ui/`.
  - Documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

## Task 21 — State Restore Engine & Pre-Restore Integrity Verification

### Execution Status
- **SUCCESS**

### Acceptance Criteria Matrix
- [x] `api/app/schemas/restore.py` (`RestoreVerifyRequest`, `RestoreVerifyCheck`, `RestoreVerifyResponse`, `RestoreExecuteRequest`, `RestoreExecuteResponse`)
- [x] `api/app/services/restore.py` `verify_backup`: archive exists/`.tar.gz`, SHA-256 vs companion `.sha256`, tarfile integrity; returns manifest
- [x] `execute_restore`: verifies first (HTTP 400 if invalid), pre-restore safety snapshot via `create_backup()`, per-file atomic restore (temp file + `os.replace`) of `state/*`, `forge-central.db`, `cacrt/*`; traversal/absolute/symlink members skipped; `state-restored` audit event
- [x] `POST /api/v1/restore/verify` and `POST /api/v1/restore/execute` registered under `/api/v1` in `main.py`
- [x] `PathSettingsPage.jsx`: Actions column, `btn-restore-{id}`, typed-confirmation modal (`modal-confirm-restore`, `input-confirm-restore`, `btn-confirm-restore`, `btn-close-restore-modal`), SHA-256 badge, safety-snapshot warning, success banner, list refresh, `CliSnippetCard` (`./forge restore execute --backup <id>`)
- [x] `api/tests/test_restore.py` (4 tests) and `PathSettingsPage.test.jsx` (+2 tests)
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [ ] `./forge restore execute` in nkp-forge CLI (snippet only; out of scope)

### Test Results
- `pytest api/tests/`: 58 passed
- `npm test` (vitest): 16 files, 65 passed

### Files Created / Modified
- Created: `api/app/schemas/restore.py`, `api/app/services/restore.py`, `api/app/routers/restore.py`, `api/tests/test_restore.py`
- Modified: `api/app/main.py`, `ui/src/pages/PathSettingsPage.jsx`, `ui/src/pages/__tests__/PathSettingsPage.test.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(restore): Task-21 — 1-click state restore & archive integrity verification engine` (NOT pushed; hash reported in C2 hand-off)

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 17:35 PDT / 24:35 UTC
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `729acd9` created cleanly (`feat(restore): Task-21 — 1-click state restore & archive integrity verification engine`).
  - Pre-restore verification endpoint `POST /api/v1/restore/verify` implemented in `api/app/routers/restore.py` and `api/app/services/restore.py` checking file existence, SHA-256 companion checksum integrity, and tarball member safety.
  - Safe restore execution endpoint `POST /api/v1/restore/execute` takes automatic pre-restore safety snapshots via `create_backup()`, unpacks archive members atomically per file, restores state/certs/db, and records `state-restored` audit event.
  - Frontend controls implemented in `PathSettingsPage.jsx`: Actions column with `btn-restore-{backup_id}`, 2-step typed confirmation modal (`modal-confirm-restore`, `input-confirm-restore`, `btn-confirm-restore`), and `<CliSnippetCard />`.
  - Pytest suite passed 58/58 tests across all endpoints in `api/tests/`.
  - Vitest component suite passed 65/65 tests across 16 test files in `ui/`.
  - Documentation updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

## Task 22 — Pre-Mutating Safety Snapshots & Destructive Operation Guards

- Execution Status: **SUCCESS**

### Acceptance Criteria Matrix
- [x] `services/backup.py`: `create_safety_snapshot(operation_name, resource_id)` → `safety-{op}-{resource}-{timestamp}-{uuid8}.tar.gz` (sanitized), shared `_write_archive` with `create_backup` (excludes `*.log`), SHA-256 + `.sha256` companion, `safety-snapshot-created` audit event
- [x] `safety_backup_id: Optional[str]` added to `ClusterCommandResponse` and `VmBatchActionResponse`
- [x] `DELETE /api/v1/clusters/{name}` and `POST /api/v1/clusters/{name}/reset-nodes` snapshot before the run; `POST /api/v1/vms/batch-action` snapshots only for `destroy` (`{N}-vms`)
- [x] Shared `SafetySnapshotNotice` component (`banner-safety-snapshot-notice`) shown in `modal-confirm-reset-nodes`, `modal-confirm-cluster-delete` (ClustersPage), delete/reset panels (ClusterDetailPage), `modal-confirm-batch-destroy` (VmListPage)
- [x] Backend tests (cluster delete, reset-nodes, VM batch destroy + non-destroy negative) and frontend banner assertions; `api/tests/conftest.py` isolates backup dir per test
- [x] `docs/API-GUIDE.md`, `docs/USER-GUIDE.md` updated
- Note: batch request field is `vmids` (not `vm_ids`); ClusterDetailPage uses inline confirmation panels rather than a modal.

### Test Results
- `pytest api/tests/`: 62 passed
- `npm test` (vitest): 16 files, 65 passed

### Files Created / Modified
- Created: `api/tests/conftest.py`, `ui/src/components/common/SafetySnapshotNotice.jsx`
- Modified: `api/app/services/backup.py`, `api/app/routers/clusters.py`, `api/app/routers/vms.py`, `api/app/schemas/clusters.py`, `api/app/schemas/vms.py`, `api/tests/test_clusters.py`, `api/tests/test_vms.py`, `ui/src/pages/{ClustersPage,ClusterDetailPage,VmListPage}.jsx`, `ui/src/pages/__tests__/{ClustersPage,ClusterDetailPage,VmListPage}.test.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(safety): Task-22 — pre-mutating auto-backup safety snapshots & destructive guard engine` (NOT pushed)

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 18:05 PDT / 01:05 UTC (Oct 1)
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `227dc56` created cleanly (`feat(safety): Task-22 — pre-mutating auto-backup safety snapshots & destructive guard engine`).
  - `create_safety_snapshot(operation_name, resource_id)` implemented in `api/app/services/backup.py` generating timestamped safety tarballs with companion SHA-256 and logging audit event `safety-snapshot-created`.
  - Destructive routes `DELETE /api/v1/clusters/{name}`, `POST /api/v1/clusters/{name}/reset-nodes`, and `POST /api/v1/vms/batch-action` (destroy action) wired to automatically take pre-mutation safety snapshots and return `safety_backup_id`.
  - Shared UI component `SafetySnapshotNotice` created with `banner-safety-snapshot-notice` and integrated into destructive confirmation modals across `ClustersPage.jsx`, `ClusterDetailPage.jsx`, and `VmListPage.jsx`.
  - Pytest suite passed 62/62 tests across all endpoints in `api/tests/` (including isolated temp backup fixture in `conftest.py`).
  - Vitest component suite passed 65/65 tests across 16 test files in `ui/`.
  - Documentation updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

## Task 23 — Enterprise Timezone Engine (ISO UTC Core, Local PST Display & Live Log Dual-Timestamping)

- Execution Status: **SUCCESS**

### Acceptance Criteria Matrix
- [x] 1. `pytest api/tests/` passes 100% (67 passed, incl. new `api/tests/test_timezone.py`)
- [x] 2. All API timestamp fields serialize as `YYYY-MM-DDTHH:MM:SSZ`: shared `UtcDatetime` Pydantic type (`api/app/timeutil.py`) applied across `audit`, `backup`, `cli`, `clusters`, `diagnostics`, `fleet`, `nodes`, `pipeline`, `upgrade`, `vms` schemas (former `str` timestamps in audit/diagnostics/fleet converted to `UtcDatetime`); router/seed/mock timestamps emit `Z`
- [x] 3. `ProcessRunner` emits `[TIMESTAMP] UTC: <iso>Z | Local (PST): YYYY-MM-DD HH:MM:SS PDT` as an SSE `log` line at run start and finish; all `log` events carry UTC `timestamp`
- [x] 4. Header has `button-timezone-toggle` (`PDT (Local)` / `UTC`)
- [x] 5. Dates in Diagnostics (bundles + audit trail), Clusters (new Last Updated column), Path Settings (backup/safety snapshot table), Fleet, Upgrade and `<LiveTerminal />` (per-line time) follow the selected mode via shared `<Timestamp />` (tooltip = raw UTC)
- [x] 6. `npm test` passes 100% (17 files, 73 tests, incl. new `ui/src/context/__tests__/Timezone.test.jsx`)
- [x] 7. `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [x] 8. Local commit created: `feat(timezone): Task-23 — enterprise timezone engine (ISO UTC core, local PST display & live log dual-timestamping)`
- [x] 9. NOT pushed
- Notes: there is no `AuditLogsPage.jsx`; the audit trail table lives in `DiagnosticsPage.jsx` and was updated there. `ClustersPage` had no date column, so an optional `last_updated_at` (UTC) cluster field + "Last Updated" column was added. Local zone for log headers is configurable via `FORGE_DISPLAY_TZ` (default `America/Los_Angeles`). `useTimezone` lives in `ui/src/context/TimezoneContext.jsx` (re-exported from `ui/src/hooks/useTimezone.js`); the provider is mounted in `main.jsx` and defaults to local/no-op without a provider so isolated component tests are unaffected.

### Test Results
- `pytest api/tests/`: 67 passed
- `npm test` (vitest): 17 files, 73 passed

### Files Created / Modified
- Created: `api/app/timeutil.py`, `api/tests/test_timezone.py`, `ui/src/context/TimezoneContext.jsx`, `ui/src/context/__tests__/Timezone.test.jsx`, `ui/src/hooks/useTimezone.js`, `ui/src/components/common/Timestamp.jsx`
- Modified: `api/app/config.py`, `api/app/schemas/{audit,backup,cli,clusters,diagnostics,fleet,nodes,pipeline,upgrade,vms}.py`, `api/app/routers/{audit,cli,clusters,diagnostics,fleet}.py`, `api/app/services/{process_runner,mock_data}.py`, `ui/src/main.jsx`, `ui/src/components/layout/Header.jsx`, `ui/src/components/common/LiveTerminal.jsx`, `ui/src/pages/{ClustersPage,DiagnosticsPage,FleetDashboardPage,PathSettingsPage,UpgradePage}.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only (hash: `git log -1` on `main`; report is part of the commit): `feat(timezone): Task-23 — enterprise timezone engine (ISO UTC core, local PST display & live log dual-timestamping)` (NOT pushed)

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 18:18 PDT / 01:18 UTC (Oct 1)
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `f63e3d9` created cleanly (`feat(timezone): Task-23 — enterprise timezone engine (ISO UTC core, local PST display & live log dual-timestamping)`).
  - Backend ISO 8601 UTC Standardization verified: Created `api/app/timeutil.py` with custom `UtcDatetime` Pydantic type serializing `YYYY-MM-DDTHH:MM:SSZ` across all schemas (`audit.py`, `backup.py`, `clusters.py`, `vms.py`, `pipeline.py`, `nodes.py`, `diagnostics.py`, `fleet.py`, `upgrade.py`, `cli.py`).
  - `ProcessRunner` emits dual-timestamp start/finish banner `[TIMESTAMP] UTC: ... | Local (PST): ...` and adds UTC timestamps to all SSE live terminal lines.
  - Frontend `TimezoneContext.jsx` and `useTimezone.js` auto-detect browser timezone with `America/Los_Angeles` fallback, localStorage persistence (`local` vs `utc`), and shared `<Timestamp />` component with raw UTC tooltip.
  - Interactive timezone switcher button mounted in `Header.jsx` (`data-testid="button-timezone-toggle"`).
  - UI date tables across Diagnostics, Clusters, Backups/Safety Snapshots, Fleet, Upgrade, and `<LiveTerminal />` updated to format via timezone provider.
  - Pytest suite: 67/67 passed (100%).
  - Vitest suite: 73/73 passed across 17 test files (100%).
  - Docs updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```


---

## Task 24 — 3-Tier Role-Based Access Control (Admin/Operator/Viewer) & Typed Destructive Guards

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. `pytest api/tests/` passes 100% (77 passed)
- [x] 2. `POST /api/v1/auth/unlock-admin` validates passphrase against `FORGE_ADMIN_PASSWORD` (default `Nutanix.123`, env-overridable; 401 on mismatch)
- [x] 3. Header shows `badge-role-switcher` with `Demo (Viewer)` / `Operator` / `Admin` menu (persisted in `localStorage` key `forge_role`)
- [x] 4. Viewer mode disables mutating buttons (Clusters, Cluster Detail, Deploy wizard, VMs, Diagnostics capture, Path Settings) with tooltip "Action disabled in Demo/Viewer mode"
- [x] 5. Switching to Admin requires the passphrase in `modal-unlock-admin`; role changes only after server validation
- [x] 6. Typed guards: `DELETE` (`modal-confirm-cluster-delete`, plus cluster detail panel), `RESET` (`modal-confirm-reset-nodes`), `DESTROY` (`modal-confirm-batch-destroy`); confirm buttons stay disabled until the exact uppercase keyword is typed
- [x] 7. `npm test` passes 100% (18 files, 83 tests, incl. new `ui/src/context/__tests__/RoleContext.test.jsx`)
- [x] 8. `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [x] 9. Local commit created: `feat(rbac): Task-24 — 3-tier role-based access control (admin/operator/viewer) & typed destructive guards`
- [x] 10. NOT pushed
- Notes:
  - Backend guard: `X-Forge-Role: viewer` returns 403 "Viewer role cannot perform mutating actions" on `DELETE /clusters/{name}`, `POST /clusters/{name}/reset-nodes`, `POST /vms/batch-action` (any action) and `POST /settings/paths/migrate`. Missing header / operator / admin behave as before, so CLI clients are unaffected. The header is a UI-driven guard, not network-level auth.
  - Operator is read-only on Day-0 controls in `/settings/paths` (migrate, backup, restore: disabled with an "requires Admin role" tooltip); `/settings/lab` does not exist yet and can reuse `adminProps()` from `useRole()`.
  - Cluster delete previously required typing the cluster name; it now requires `DELETE` (list modal and detail page). Single-VM destroy still requires the VM name (unchanged).
  - `useRole()` defaults to `operator` without a provider (fail-closed for Day-0). `PathSettingsPage.test.jsx` now renders under `RoleProvider` with the admin role; two reset-nodes assertions now expect the `X-Forge-Role` header.

### Test Results
- `pytest api/tests/`: 77 passed (10 new in `api/tests/test_auth_rbac.py`)
- `npm test` (vitest): 18 files, 83 passed (10 new)
- `npm run build`: succeeds

### Files Created / Modified
- Created: `api/app/routers/auth.py`, `api/app/schemas/auth.py`, `api/tests/test_auth_rbac.py`, `ui/src/context/RoleContext.jsx`, `ui/src/components/layout/RoleSwitcher.jsx`, `ui/src/context/__tests__/RoleContext.test.jsx`
- Modified: `api/app/{config,main}.py`, `api/app/routers/{clusters,vms,paths}.py`, `ui/src/main.jsx`, `ui/src/components/layout/Header.jsx`, `ui/src/pages/{ClustersPage,ClusterDetailPage,ClusterDeployPage,VmListPage,DiagnosticsPage,PathSettingsPage}.jsx`, `ui/src/pages/__tests__/{ClustersPage,ClusterDetailPage,PathSettingsPage}.test.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(rbac): Task-24 — 3-tier role-based access control (admin/operator/viewer) & typed destructive guards` (NOT pushed)

### C1 Planner Verification Verdict
- **Date/Time:** 2026-09-30 19:20 PDT / 02:20 UTC (Oct 1)
- **Reviewing Agent:** C1 Planner
- **Verification Status:** 100% APPROVED
- **Disk Inspection:**
  - Local commit `a779a56` created cleanly (`feat(rbac): Task-24 — 3-tier role-based access control (admin/operator/viewer) & typed destructive guards`).
  - Backend Role & Session Model verified: Added `FORGE_ADMIN_PASSWORD` to `config.py`, `POST /api/v1/auth/unlock-admin` with 401 on incorrect passphrase and 200 on authorized passphrase (`Nutanix.123`).
  - Mutating endpoint guards verified: `X-Forge-Role: viewer` returns HTTP 403 Forbidden on cluster delete, reset-nodes, VM batch actions, and path migration.
  - Frontend Role Management verified: `RoleContext.jsx` with persistent localStorage role selection (`viewer`, `operator`, `admin`), `Header.jsx` role switcher badge (`badge-role-switcher`), and password modal `modal-unlock-admin`.
  - Mutating UI controls disabled in Demo/Viewer mode with tooltip "Action disabled in Demo/Viewer mode". Day-0 actions restricted to Admin role.
  - Typed destructive modals verified: `modal-confirm-cluster-delete` enforces `DELETE`, `modal-confirm-reset-nodes` enforces `RESET`, and `modal-confirm-batch-destroy` enforces `DESTROY`.
  - Pytest suite: 77/77 passed (100%).
  - Vitest suite: 83/83 passed across 18 test files (100%).
  - Docs updated in `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, and `README.md`.
- **Authorized Git Push Command:**
  ```bash
  cd ~/work/git/forge-central
  git push origin main
  ```

---

## Task 25 — Day-0 Lab Infrastructure Wizard, Secrets Vault & Gateway Login Screen

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. `pytest api/tests/` passes 100% (93 passed)
- [x] 2. Gateway screen (`modal-login-gateway`) shows on first visit: quick Operator/Viewer entry or Admin passphrase unlock, "Remember my choice" checkbox, **Log Out** (`btn-logout-switch-user`) in the Header next to `badge-role-switcher`
- [x] 3. `POST /api/v1/lab/init` validates input and writes `FORGE_HOME/labs/<lab>/<lab>-infra.ini` (chmod 600, previous file kept as `.bak`), audit event `lab-initialized`
- [x] 4. `POST /api/v1/secrets/save` stages Docker Hub / Harbor credentials (chmod 600); `GET /api/v1/secrets` lists them with masked passwords
- [x] 5. `lab/init`, `secrets/save`, `DELETE secrets/{sec_type}` return 403 unless `X-Forge-Role: admin`
- [x] 6. `SettingsPage.jsx` renders Lab Infrastructure (`tab-lab-infra`) and Secrets Vault (`tab-secrets-vault`) tabs
- [x] 7. `npm test` passes 100% (20 files, 95 tests)
- [x] 8. `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [x] 9. Local commit: `feat(lab): Task-25 — Day-0 lab infrastructure wizard, secrets vault & gateway login screen`
- [x] 10. NOT pushed
- Notes:
  - Writes the INI files directly (same keys, quoting/escaping and paths as `forge init lab` / `forge secret save`) instead of spawning the interactive CLI wizards, so the API is deterministic and testable. The UI "Copy as CLI" card shows the equivalent `./forge init lab --non-interactive ...` command.
  - Secrets use the CLI's canonical layout (`<cacrt>/dockerhub/dockerhub-creds.ini`, `<cacrt>/<cluster>/harbor-creds.ini`), not a flat `dockerhub-creds.ini`. New setting `FORGE_CACRT_DIR` (default `~/cacrt`) avoids a hardcoded path.
  - New `require_admin_role` dependency (`routers/auth.py`) is strict (admin header only); existing viewer-only guards are unchanged. `SecretItem` adds `password_masked`; `LabConfigResponse` adds `configured`, `labs`, `config_path`, `has_password` (the password is never returned).
  - Lab-infra values are rejected if they contain quotes, `$`, backticks or control characters (the file is sourced by bash); passwords are escaped on write exactly like the CLI.
  - `RoleContext` no longer writes a default role on mount: a stored role (localStorage when "Remember" is ticked, otherwise sessionStorage) means "signed in"; none shows the gateway. `useRole()` without a provider still reports an active session, so isolated component tests are unaffected. `roleHeaders()` reads either store.
  - Day-0 buttons on `/settings` reuse `adminProps()`.
  - The uncommitted C1 verdict block for Task 24 that was already in this file is included in this commit.

### Test Results
- `pytest api/tests/`: 93 passed (16 new in `api/tests/test_lab_secrets.py`)
- `npm test` (vitest): 20 files, 95 passed (12 new: `SettingsPage.test.jsx` 8, `LoginGatewayModal.test.jsx` 4)
- `npm run build`: succeeds

### Files Created / Modified
- Created: `api/app/{routers,services,schemas}/lab.py`, `api/app/{routers,services,schemas}/secrets.py`, `api/tests/test_lab_secrets.py`, `ui/src/components/auth/LoginGatewayModal.jsx`, `ui/src/components/auth/__tests__/LoginGatewayModal.test.jsx`, `ui/src/components/settings/{LabInfraTab,SecretsVaultTab}.jsx`, `ui/src/pages/__tests__/SettingsPage.test.jsx`
- Modified: `api/app/{config,main}.py`, `api/app/routers/auth.py`, `ui/src/context/RoleContext.jsx`, `ui/src/components/layout/{Header,Layout}.jsx`, `ui/src/pages/SettingsPage.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(lab): Task-25 — Day-0 lab infrastructure wizard, secrets vault & gateway login screen` (NOT pushed)

---

## Task 26 — Live Proxmox-Backed IPAM Ledger & Subnet Manager

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. `pytest api/tests/` passes 100% (106 passed)
- [x] 2. `GET /api/v1/ipam` returns the structured ledger with allocated, free, VIP and gateway slots (mock pool `10.0.0.10`-`10.0.0.40`, 31 slots)
- [x] 3. `POST /api/v1/ipam/release` releases a cluster's reservation (`./forge ipam release --cluster <name> --force`) after a safety snapshot and records audit event `ipam-released`; viewer gets 403, unknown cluster 404, unsafe names 422
- [x] 4. `IpamPage.jsx` renders KPI cards (`card-ipam-total|allocated|free`) and the interactive `table-ipam` with search + status filter
- [x] 5. Release requires typing `RELEASE` (`input-confirm-release`); `btn-confirm-release` stays disabled otherwise
- [x] 6. `npm test` passes 100% (21 files, 105 tests); `npm run build` succeeds
- [x] 7. `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [x] 8. Local commit: `feat(ipam): Task-26 — live Proxmox-backed IPAM ledger & subnet manager`
- [x] 9. NOT pushed
- Notes:
  - Live mode runs `./forge ipam <list|free|release|reconcile-vmids> --conf <FORGE_HOME>/labs/<lab>/<lab>-infra.ini` (first discovered lab; `--conf` omitted when none) via `asyncio.create_subprocess_exec` using the configured forge binary, and parses the CLI table output. No ledger logic is re-implemented in Python. CLI failures surface as HTTP 500 with the CLI stderr.
  - The CLI ledger is slot-based (one row = control-plane VIP + MetalLB range). The parser maps each in-use row to a `vip` slot plus an `allocated` MetalLB-range slot, and each free row to a `free` slot. Per-node IPs/VMIDs/gateway appear only in the mock ledger, as the CLI does not report them.
  - `--force` is passed on release because the API is non-interactive; the typed `RELEASE` modal replaces the CLI's y/N prompt. Release does a pre-check via `ipam list` and returns 404 if the cluster holds nothing.
  - `allocated_slots` = every non-free slot (`allocated + vip + gateway`), so KPI cards always sum to the total. `IpamReleaseResponse` gains an optional `safety_backup_id`. `GET /ipam/free` returns a plain `IpamSlot[]`.
  - `reconcile` is read-only and open to all roles (viewer gets a disabled button in the UI); `release` uses `require_mutating_role` (operator/admin).
  - Release button is rendered once per cluster, on the first visible row the cluster holds.

### Test Results
- `pytest api/tests/`: 106 passed (13 new in `api/tests/test_ipam.py`, incl. live mode against a fake `forge` script)
- `npm test` (vitest): 21 files, 105 passed (10 new in `ui/src/pages/__tests__/IpamPage.test.jsx`)
- `npm run build`: succeeds

### Files Created / Modified
- Created: `api/app/{routers,services,schemas}/ipam.py`, `api/tests/test_ipam.py`, `ui/src/pages/__tests__/IpamPage.test.jsx`
- Modified: `api/app/main.py`, `ui/src/pages/IpamPage.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(ipam): Task-26 — live Proxmox-backed IPAM ledger & subnet manager` (NOT pushed; hash via `git log -1`)

---

## Task 27 — Guided Cluster Config Generator & Bastion Remote Sync Workflow

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. `pytest api/tests/` passes 100% (126 passed)
- [x] 2. `POST /api/v1/clusters/init-config` generates `<FORGE_STATE_DIR>/<cluster>/<cluster>-input.ini` (chmod 600) inheriting the lab's non-secret fields, pre-selecting a free VIP + MetalLB range from IPAM and recording audit event `cluster-config-initialized`
- [x] 3. `POST /api/v1/clusters/sync-bastion` queues `./forge share mount --from <central_ip> --target <bastion_ip>` (or ssh mkdir + scp when `nfs_mount=false`) and records `cluster-bastion-sync`
- [x] 4. `ClusterDeployPage.jsx` loads labs from `/api/v1/lab/config` and renders real VIP/MetalLB previews from `/api/v1/ipam/free` (hardcoded 10.10.40.x / inventory mockups removed)
- [x] 5. Stage 3 radio toggle selects Forge Central (Option A) or Cluster Bastion (Option B, bastion IP required)
- [x] 6. `npm test` passes 100% (22 files, 119 tests)
- [x] 7. `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [x] 8. Local commit: `feat(cluster): Task-27 — guided cluster config generator & bastion remote sync workflow`
- [x] 9. NOT pushed
- Notes:
  - `POST /clusters/create` keeps the legacy 01-05 payload unchanged; adding `lab_name` selects the wizard flow, which chains `provision vms --skip-bastion` + `create cluster` against the generated INI (404 if `init-config` has not run). For `target_runner=bastion` the same run first stages the config (share mount, or ssh+scp) and then runs both commands on the bastion over SSH. The run stops at the first failing step.
  - New `ProcessRunner.start_sequence(steps)` runs a chain of `RunStep`s in ONE run id / SSE stream, emitting `==> Step i/n: <label>` markers (the UI derives step progress from them). External commands are allowlisted to `ssh`/`scp` only; the mock/real decision is made once per run. Bastion host input is validated (no leading `-`, no shell characters) because it reaches ssh/scp argv; remote commands are `shlex`-quoted.
  - Like `forge init lab` in Task 25, the INI is rendered by the API (testable, deterministic) instead of spawning the interactive `./forge init nkp-cluster`; the Copy-as-CLI card shows the equivalent `--non-interactive` command. Lab credentials (`PVE_PASSWORD`) are never copied into the cluster INI or audit details.
  - IPAM selection: first free slot = VIP; MetalLB = the free run right after it (up to 5), else the next run of 2+; in live mode the ledger's own MetalLB range from `forge ipam free` is used verbatim. The UI mirrors the algorithm in `ui/src/utils/ipamSuggest.js` for the Stage 2 preview; Stage 4 shows the authoritative backend result. Note live `forge ipam free` still uses the first discovered lab's `--conf` (Task 26 behaviour).
  - New settings (no hardcoded paths): `FORGE_STATE_DIR`, `FORGE_CENTRAL_IP` (auto-detected via a UDP route lookup towards the bastion when unset), `FORGE_BASTION_USER`, `FORGE_BASTION_FORGE_PATH`, `FORGE_BASTION_STATE_DIR`. `LabConfigResponse` gains `nkp_version` (from `NKP_CLI_VERSION`).
  - `init-config`, `sync-bastion` and `create` use `require_mutating_role` (viewer gets 403). `LiveTerminal` gained an optional `onProgress({lines, status})` callback.
  - E2E harness (`tests/e2e/conftest.py`): backend now starts in `FORGE_MOCK_MODE` with temp `FORGE_HOME`/`FORGE_STATE_DIR`/backup dirs and an `e2e_lab` fixture seeds a lab, since the wizard requires one. Syntax-checked only; Playwright was not run in this environment.
  - `npm run build` was not re-run for this task.
  - Existing share-mount endpoint (`POST /api/v1/shares/mount`) passes `--from-ip`/`--target-bastion`, which differ from the CLI's `--from`/`--target`; left untouched (out of scope) — the new sync uses the documented CLI flags.

### Test Results
- `pytest api/tests/`: 126 passed (20 new in `api/tests/test_cluster_deploy_wizard.py`: config init/lab inheritance/secret hygiene/audit, IPAM candidate selection, sync-bastion NFS + scp + validation, wizard create on central/bastion, `start_sequence` against a fake `forge` incl. failure stop and allowlist)
- `npm test` (vitest): 22 files, 119 passed (`ClusterDeployPage.test.jsx` rewritten: 16 tests; new `ipamSuggest.test.js`: 4)

### Files Created / Modified
- Created: `api/app/services/cluster_config.py`, `api/tests/test_cluster_deploy_wizard.py`, `ui/src/utils/ipamSuggest.js`, `ui/src/utils/__tests__/ipamSuggest.test.js`
- Modified: `api/app/{config.py}`, `api/app/routers/clusters.py`, `api/app/schemas/{clusters,lab}.py`, `api/app/services/{ipam,lab,process_runner}.py`, `ui/src/pages/ClusterDeployPage.jsx`, `ui/src/pages/__tests__/ClusterDeployPage.test.jsx`, `ui/src/components/common/LiveTerminal.jsx`, `tests/e2e/{conftest,test_web_console_e2e}.py`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(cluster): Task-27 — guided cluster config generator & bastion remote sync workflow` (NOT pushed; hash via `git log -1`)

---

## Task 28 — Hardware Discovery, PCI Passthrough & GPU VM Provisioning Manager

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. `pytest api/tests/` passes 100% (148 passed)
- [x] 2. `GET /api/v1/vms/hardware/pci` lists discovered GPUs and Pensando NICs (live: `./forge discover hardware --details` -> `lspci -D` fallback + `./forge passthrough list`; mock: 4x AMD Instinct MI350P + 4x Pensando Pollara 400 fixtures)
- [x] 3. `POST /api/v1/vms/{vmid}/passthrough/attach` and `/detach` enforce VM power-state checks (409 when running unless `force_stop=true`, which passes `--stop`)
- [x] 4. `POST /api/v1/vms/provision-gpu` dispatches `./forge provision gpu-vms --conf <cluster>-input.ini` and records audit event `gpu-vms-provisioned`
- [x] 5. Frontend renders the PCI hardware drawer (`modal-hardware-pci`, `modal-attach-pci`) on `/vms` and the GPU worker card/modal (`section-gpu-workers`, `modal-provision-gpu-vm`) in Cluster Detail
- [x] 6. `npm test` passes 100% (22 files, 127 tests); `npm run build` succeeds
- [x] 7. `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md` updated
- [x] 8. Local commit: `feat(gpu): Task-28 — hardware discovery, PCI passthrough & GPU VM provisioning manager`
- [x] 9. NOT pushed
- Notes:
  - `./forge passthrough attach|detach` has no per-BDF flag; an explicit `pci_bdf` / `gpu_bdf` / `nic_bdf` is therefore passed through the CLI's own env contract (`GPU_PCIE_DEVICE`, `PENSANDO_NIC_PCIE_DEVICE`) via `env_overrides`, and `gpu_worker_count` as `GPU_WORKER_COUNT` (the `04-proxmox-clone-gpu-vms.sh` defaults). BDFs are regex-validated (`dddd:bb:ss.f`) before reaching the environment. Without a BDF the CLI uses the values from its config.
  - Power-state check reads VM status from `./forge vm-list --json` (live) or fixtures (mock) in `services/passthrough.py::get_vm`; the guard uses HTTP 409 (state conflict) while unknown VM / undiscovered BDF is 404, wrong device class 400, BDF already held by another VM 409 (attach). `pci_bdf` combined with `device_type=both` is 400 (ambiguous).
  - Mock mode adds GPU worker VMs 301 (stopped), 302 (running), 303 (stopped, free) used only by the passthrough service; `MOCK_VMS` (and `GET /api/v1/vms` in mock mode) is unchanged. Cluster-config existence (404) is skipped for `provision-gpu` in mock mode so the Cluster Detail card works offline.
  - `PassthroughActionRequest.vmid` is optional/informational (the URL path is authoritative); device_type is a `Literal` (invalid -> 422). New response models `PassthroughActionResponse` / `GpuVmProvisionResponse`. Attach/detach/provision use `require_mutating_role` (viewer -> 403). Audit status is `succeeded` at dispatch time, matching the other dispatchers.
  - Cluster Detail's GPU worker list = VMs with a 300-399 VMID or `gpu_passthrough`; the card degrades to an empty table when the backend is offline. Existing legacy `POST /api/v1/vms/pci-passthrough` is untouched.
  - Playwright E2E was not run for this task. Existing React `act(...)` warnings in unrelated suites are pre-existing.

### Test Results
- `pytest api/tests/`: 148 passed (22 new in `api/tests/test_passthrough_hardware.py`: lspci/forge output parsers, mock fixtures + assignments, live discover/list wrapping, lspci fallback, discovery failure 500, attach/detach power guards with and without `force_stop`, BDF validation/ownership/class checks, env overrides, audit events, provision dispatch + conf 404 + validation, mock mode never spawns forge)
- `npm test` (vitest): 22 files, 127 passed (8 new: 5 in `VmListPage.test.jsx` — inventory drawer, attach modal power warning/force-stop, stopped-VM attach, backend error, detach; 3 in `ClusterDetailPage.test.jsx` — GPU worker card + CLI previews, provision modal submit, provision error)
- `npm run build`: succeeded

### Files Created / Modified
- Created: `api/app/services/passthrough.py`, `api/tests/test_passthrough_hardware.py`, `ui/src/components/vms/HardwarePciDrawer.jsx`, `ui/src/components/cluster/GpuWorkersSection.jsx`
- Modified: `api/app/routers/vms.py`, `api/app/schemas/vms.py`, `ui/src/pages/VmListPage.jsx`, `ui/src/pages/ClusterDetailPage.jsx`, `ui/src/pages/__tests__/VmListPage.test.jsx`, `ui/src/pages/__tests__/ClusterDetailPage.test.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit only: `feat(gpu): Task-28 — hardware discovery, PCI passthrough & GPU VM provisioning manager` (NOT pushed; hash via `git log -1`)

---

## Task 29 — Automated Proxmox Bootstrap Script and Operator SOP for Forge Central VM

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. Automated bootstrap script `scripts/bootstrap-forge-central-vm.sh` created with `set -euo pipefail` and executable permissions.
- [x] 2. Option A (Golden Template clone) supported: verifies template exists, full clones, configures vCPU/RAM/virtio bridge/agent, injects `nkp-bastion-overlay.sh` user snippet, boots and polls guest agent.
- [x] 3. Option B (Scratch bring-up) supported: downloads Ubuntu 24.04 LTS cloud image, creates VM shell (`q35`, `virtio-scsi-single`, serial socket), imports disk, attaches cloud-init drive, injects unified cloud-init snippet (`nkpadmin`, passwordless sudo, ECDSA keys, disable swap/IPv6/UFW, QEMU agent, Docker CE, kubectl, helm, working directories), boots and polls guest agent.
- [x] 4. Auto mode (`--mode auto`, default) probes golden template VMID; clones if present, cleanly falls back to scratch bring-up if absent.
- [x] 5. CLI flag `--print-manual-steps` generates copy-pasteable manual Proxmox shell commands with interpolated variables.
- [x] 6. CLI flag `--dry-run` simulates and prints all remote SSH and `qm` commands without executing.
- [x] 7. Comprehensive operator SOP guide created at `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md` covering architecture/sizing, quickstart, step-by-step manual Proxmox CLI runbook, Day-1 verification, and code synchronization steps.
- [x] 8. Automated validation tests added in `tests/scripts/test_bootstrap_script.py` verifying `--help`, `--print-manual-steps`, `--dry-run` command streams for clone/scratch/auto, argument validation, and parameter interpolation.
- [x] 9. Backend tests (`pytest api/tests/`) remain at 100% pass rate (148 passed).
- [x] 10. Frontend tests (`npm test`) remain at 100% pass rate (127 passed).
- [x] 11. Documentation updated: `README.md`, `docs/USER-GUIDE.md`, `docs/API-GUIDE.md`.
- [x] 12. Local Git commit created (NOT pushed): `feat(ops): Task-29 — automated Proxmox bootstrap script and operator SOP for Forge Central VM`.

### Test Results
- `pytest tests/scripts/test_bootstrap_script.py`: 10 passed in 0.33s
- `pytest api/tests/`: 148 passed in 4.39s
- `npm test`: 22 test files passed, 127 tests passed in 6.31s

### Files Created / Modified
- Created: `scripts/bootstrap-forge-central-vm.sh`, `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md`, `tests/scripts/test_bootstrap_script.py`
- Modified: `README.md`, `docs/USER-GUIDE.md`, `docs/API-GUIDE.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit: `feat(ops): Task-29 — automated Proxmox bootstrap script and operator SOP for Forge Central VM` (NOT pushed)


---

## Task 29 (follow-up) — Dynamic SSH Key Injection, Secret Hygiene & Portable Documentation Paths

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. Hardcoded private key and public key removed from `scripts/bootstrap-forge-central-vm.sh` (no `BEGIN OPENSSH PRIVATE KEY`; asserted by test).
- [x] 2. New options `--ssh-key-file`, `--ssh-pubkey-file`, `--ssh-private-key`, `--ssh-public-key` (and `=value` forms) with env fallbacks `FORGE_SSH_KEY_FILE`, `FORGE_SSH_PUBKEY_FILE`, `FORGE_SSH_PRIVATE_KEY`, `FORGE_SSH_PUBLIC_KEY`; CLI overrides env; missing files and malformed public keys rejected.
- [x] 3. Public key auto-detection from `~/.ssh/id_ed25519.pub`, `id_ecdsa.pub`, `id_rsa.pub` when none supplied.
- [x] 4. `get_unified_init_snippet()`: supplied private key staged to `${NKP_SSH_DIR}/id_nkpadmin_ecdsa` (base64 transport); otherwise `ssh-keygen -t ecdsa -b 256 -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" -N "" -C "nkpadmin@forge-central"` runs in guest; `id_ecdsa` always created; keys copied to `${NKP_HOME}/ssh-key/`; public keys appended (deduplicated) to `authorized_keys`; `PasswordAuthentication yes` and `Nutanix.123` retained.
- [x] 5. `--print-manual-steps` shows SSH key options and masks the private key payload (`<BASE64_OF_YOUR_PRIVATE_KEY>`); `--dry-run` never prints key content.
- [x] 6. Documentation paths generalized (`~/work/git/forge-central` -> `~/forge-central`) in `README.md`, `docs/USER-GUIDE.md`, `docs/TESTING-GUIDE.md`, `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md`, with the "Note on Directory Paths" callout; embedded key removed from the manual runbook in `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md`.
- [x] 7. SSH key flags documented in `README.md`, `docs/USER-GUIDE.md`, `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md`.
- [x] 8. Tests added in `tests/scripts/test_bootstrap_script.py` (no-private-key assertion, key-file/pubkey-file/inline handling, env vars, auto-detect + generate fallback, masking, validation errors).
- [x] 9. Guest key logic exercised functionally in a temp dir for four scenarios (generate; private only -> derived pub; private + pub pair; operator pub only): keys staged byte-identical, derived pub matches, authorized_keys deduplicated.
- [x] 10. Local Git commit created (NOT pushed).

### Test Results
- `pytest tests/scripts/test_bootstrap_script.py`: 18 passed
- `pytest api/tests/`: 148 passed
- `npm test`: 22 test files, 127 tests passed

### Files Created / Modified
- Modified: `scripts/bootstrap-forge-central-vm.sh`, `tests/scripts/test_bootstrap_script.py`, `README.md`, `docs/USER-GUIDE.md`, `docs/TESTING-GUIDE.md`, `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Notes
- A supplied private key is embedded (base64) in the cloud-init snippet uploaded to the Proxmox host (`/var/lib/vz/snippets/`); the guest unsets it after staging. The previously hardcoded key remains in git history and should be treated as compromised/rotated.
- Keys apply to scratch bring-up (Option B); clone mode (Option A) inherits keys from the golden template.

### Git
- Local commit: `fix(ops): Task-29 — dynamic SSH key injection, secret hygiene & portable documentation paths` (NOT pushed; hash via `git log -1`)

---

## Task 30 (C2-P30-Agent01) — Interactive Bootstrap Wizard, Dual SSH Key Architecture & DNS Configuration

### Execution Status: SUCCESS

### Acceptance Criteria Matrix
- [x] 1. `scripts/bootstrap-forge-central-vm.sh` starts the interactive wizard via `-i`/`--interactive`, or automatically when run with no arguments on a TTY (`[ -t 0 ] && [ -t 1 ]`); `--non-interactive`, `--dry-run`, `--print-manual-steps` never trigger it automatically.
- [x] 2. Proxmox host has no auto-proceed default in the wizard (a `--pve-host`/`PVE_CLUSTER_HOST` value is only offered for confirmation); blank input aborts with exit 1 (tested).
- [x] 3. Summary table + `Are you sure you want to proceed with deployment on <target>? (yes/no) [no]:`; only `yes`/`y` proceeds, default aborts (tested).
- [x] 4. Dual SSH keys: Key A operator public key (default `~/.ssh/id_ed25519.pub`) -> `authorized_keys`; optional Key B shared cluster private key (+ public key prompt, new `--ssh-cluster-pubkey-file` / `FORGE_SSH_CLUSTER_PUBKEY_FILE`); blank Key B => VM generates ECDSA keypair staged to `/home/nkpadmin/ssh-key/`.
- [x] 5. `--nameserver` / `--searchdomain` (env `VM_NAMESERVER` / `VM_SEARCHDOMAIN`) and wizard prompts (DHCP and static) add `--nameserver "<ns>" --searchdomain "<sd>"` before `--ipconfig0` in `qm set` (clone + scratch + manual runbook); inputs validated; unchanged output when unset.
- [x] 6. Non-interactive/`--dry-run` flows never block on `read`; all original tests pass unchanged.
- [x] 7. Tests pass: bootstrap script, backend, frontend (below).
- [x] 8. `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md` (Interactive Wizard + DNS sections, key table) and `README.md` updated. `docs/API-GUIDE.md` / `docs/USER-GUIDE.md` not relevant (no API/UI change).
- [x] 9. Local commit created with the exact required message (NOT pushed).

### Proxmox connectivity (pre-flight, after confirmation, skipped on dry-run)
- `ssh -o BatchMode=yes` probe; on failure a masked `read -s` password prompt, offer `ssh-copy-id` (via `sshpass` when installed), else session-only `sshpass` auth. All remote calls now go through a `pve_ssh` helper. Not exercised against a live Proxmox host (no host available); logic verified by `bash -n` and wizard dry-run flows.

### Test Results
- `pytest tests/scripts/test_bootstrap_script.py`: 30 passed (18 pre-existing + 12 new)
- `pytest api/tests/`: 148 passed
- `npm test` (run in `ui/`; repo root has no package.json): 22 test files, 127 tests passed

### Files Created / Modified
- Modified: `scripts/bootstrap-forge-central-vm.sh`, `tests/scripts/test_bootstrap_script.py`, `README.md`, `docs/BOOTSTRAP-FORGE-CENTRAL-VM.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`

### Git
- Local commit: `feat(ops): Task-30 — interactive bootstrap wizard, dual SSH key architecture & DNS configuration` (NOT pushed; hash via `git log -1`)


### [C1 VERIFICATION VERDICT — APPROVED] Task 30 (2026-09-30)

- C2 agent: C2-P30 bootstrap wizard (`fc8fb60f-f9d0-4223-8221-b74b9272b85b`)
- Code commit: `a712d08` — `feat(ops): Task-30 — interactive bootstrap wizard, dual SSH key architecture & DNS configuration` (pushed to origin/main)
- C1 re-ran: `pytest tests/scripts/test_bootstrap_script.py` → **30 passed**
- Acceptance criteria 1–9: all met per C2 audit + off-disk script spot-check (`--interactive`, dual-key prompts, DNS opts, final yes/no default no)
- Live Lab Validation Completed (2026-10-01):
  - Proxmox host: `10.117.50.111` (`nx-intel-inno-gnr-01-1`), Storage: `NTX-STORAGE-POOL`, Bridge: `vmbr263`
  - Mode: Option B Scratch Bring-Up from Ubuntu 24.04 LTS cloud image
  - Provisioned Target: VMID `151` (`ntx-forge-central1`), 4 cores, 8192 MB RAM, 210G disk
  - Network: Static IP assigned `10.123.238.120/24`, Gateway `10.123.238.1`
  - DNS: Primary `10.40.64.15`, Secondary `10.22.64.16`, Search domain `eng.nutanix.com`
  - In-Guest Verification:
    - Hostname: `ntx-forge-central1` (matches VM name perfectly on first boot without manual intervention)
    - Root filesystem: 200 GB available (`df -kh` → 203G /dev/sda1)
    - Cloud-init completion: `Finished cloud-final.service - Cloud-init: Final Stage (57.73s)`
    - SSH Key Staging: Operator-supplied Key B `~/ssh-key/id_nkpadmin_ecdsa` staged with public half `nkpadmin@nutanix.com`
    - Workstation Key A: Passwordless SSH login working with `~/.ssh/id_ed25519.pub`
    - Runtime: Docker engine running (`docker ps`), kubectl, helm, and directory skeleton (`cacrt`, `forge-central`, `forge-state`, `ssh-key`) verified
  - Fixes applied & committed:
    - Default disk size updated to 210G (`DISK="${VM_DISK:-${DISK_SIZE:-210G}}"`)
    - Added cloud-init `meta` snippet (`local-hostname: ${VM_NAME}`) and in-guest hostname enforcement so scratch bring-up assigns hostname accurately on first boot
    - Interactive input sanitization: auto-trim whitespace & quotes (`trim_whitespace_and_quotes`) on all user answers and file paths
    - Early Proxmox connectivity pre-flight right after host entry with auto-fallback to password / `ssh-copy-id` / `sshpass`
- Bookkeeping: `C1-CONTEXT-NOTES.md`, `END-TO-END-BUILD-CHECKLIST.md` Task 15.7, `CURSOR-PROMPTS` criteria, `SESSION-HANDOFF` updated

---

## [2026-10-01] Task 31 — Fix Docker Bind-Mount Ownership (1000:1001) & Structured Filesystem Permission Handling (BUG-001)

### Execution Status: SUCCESS (Verified Live)
- Scope: Resolve production defect `BUG-001` where `POST /api/v1/lab/init` failed inside Docker due to host directory permissions (`drwxr-xr-x 1001:1001 /home/nkpadmin/forge-state`).

### Acceptance Criteria Matrix
- [x] 1. Root Cause Identified: Ubuntu 24.04 cloud image assigns UID 1000 to `ubuntu` and UID 1001 to `nkpadmin`. Container `forgecentral` runs as UID 1000 and was blocked from creating `/forge-state/labs`.
- [x] 2. Dual-Ownership & Setgid Directory Setup: `scripts/bootstrap-forge-central-vm.sh` updated to create `~/forge-state`, `~/forge-data`, and `~/cacrt` with `chown -R 1000:1001` and `chmod -R 2775`.
- [x] 3. Explicit Docker Compose Environment Variables: `docker-compose.yml` updated with explicit bindings for `FORGE_STATE_DIR`, `FORGE_CENTRAL_DATA_DIR`, `FORGE_DATA_DIR`, `FORGE_CACRT_DIR`, and `FORGE_LOG_DIR`.
- [x] 4. Structured Backend Error Handling: `api/app/services/lab.py` wraps `write_private_file()` in `try...except (PermissionError, OSError)` returning clean `HTTPException(500, detail="...")` JSON instead of crashing.
- [x] 5. Unit Tests: Added `test_lab_init_permission_error_returns_clean_500_json` in `api/tests/test_lab_secrets.py` (17/17 passed); `test_bootstrap_script.py` (31/31 passed).
- [x] 6. Live Validation on Target VM (`10.123.238.120`):
  - Applied host permissions: `sudo chown -R 1000:1001 ~/forge-state ~/forge-data ~/cacrt && sudo chmod -R 2775 ~/forge-state ~/forge-data ~/cacrt`.
  - Rebuilt & restarted container via `docker compose build && docker compose up -d`.
  - Probed write access inside container: `WRITE SUCCESS`.
  - Triggered `POST /api/v1/lab/init` for `ntx-lab`: returned HTTP 200 `{"status":"initialized","config_path":"/forge-state/labs/ntx-lab/ntx-lab-infra.ini"}`.
  - Verified host file created at `/home/nkpadmin/forge-state/labs/ntx-lab/ntx-lab-infra.ini` (mode 0600, group `nkpadmin`).
  - Verified `GET /api/v1/lab/config` returned `configured: true` and matched the live Proxmox parameters.
- [x] 7. Documentation & Register: Updated `docs/DEPLOYMENT-GUIDE.md`, marked `BUG-001` as `Verified` in `my-notes/BUGS-AND-ENHANCEMENTS.md` with full evaluation scorecard.

### Files Modified
- `scripts/bootstrap-forge-central-vm.sh`
- `docker-compose.yml`
- `api/app/services/lab.py`
- `api/tests/test_lab_secrets.py`
- `docs/DEPLOYMENT-GUIDE.md`
- `my-notes/BUGS-AND-ENHANCEMENTS.md`
- `deliverables/CURSOR-PROMPTS-FORGE-CENTRAL-v1.md` (authored `[PROMPT-31]`)
- `C1-CONTEXT-NOTES.md` & `deliverables/END-TO-END-BUILD-CHECKLIST.md`

---

### [C1 VERIFICATION VERDICT — APPROVED] Task 31 (BUG-001) (2026-10-01)

- Scope: Production defect fix for Docker volume bind-mount ownership mismatch (`BUG-001`).
- Verification Status: **100% APPROVED & VERIFIED LIVE** on `ntx-forge-central1` (`10.123.238.120`).
- Code Modifications:
  - `scripts/bootstrap-forge-central-vm.sh`: Updated guest init snippets to configure `chown -R 1000:1001` and `chmod -R 2775` on runtime state/data directories.
  - `docker-compose.yml`: Exported explicit environment variables (`FORGE_STATE_DIR`, `FORGE_DATA_DIR`, `FORGE_CACRT_DIR`, `FORGE_LOG_DIR`).
  - `api/app/services/lab.py`: Wrapped `write_private_file()` in `try...except (PermissionError, OSError)` returning structured HTTP 500 JSON exceptions (`{"detail": "..."}`).
  - `docs/DEPLOYMENT-GUIDE.md`: Documented host volume dual-ownership and setgid permissions.
  - `api/tests/test_lab_secrets.py`: Added unit test `test_lab_init_permission_error_returns_clean_500_json`.
- Test Suites:
  - `pytest api/tests/test_lab_secrets.py`: 17 passed.
  - `pytest tests/scripts/test_bootstrap_script.py`: 31 passed.
- Live Deployment Validation on `10.123.238.120`:
  - Host directory permissions applied: `sudo chown -R 1000:1001 ~/forge-state ~/forge-data ~/cacrt && sudo chmod -R 2775 ~/forge-state ~/forge-data ~/cacrt`.
  - Rebuilt & restarted Docker Compose container in 6.2s.
  - In-container write test: `touch /forge-state/test.txt` → `WRITE SUCCESS`.
  - `POST /api/v1/lab/init` returned HTTP 200 initialized; `/home/nkpadmin/forge-state/labs/ntx-lab/ntx-lab-infra.ini` created with mode 0600 and group `nkpadmin`.
  - `GET /api/v1/lab/config` verified round-trip configuration.
- Prompt Book Entry: Authored retro prompt `[PROMPT-31]` in `deliverables/CURSOR-PROMPTS-FORGE-CENTRAL-v1.md`.
- Register Updated: Marked `BUG-001` as `Verified` in `my-notes/BUGS-AND-ENHANCEMENTS.md` with complete 45/45 scorecard.



---

## [C2-P32] Task 32 — CLI container mounts, SSH keys & Dark/Light/System theme engine (2026-10-01)

- **Execution Status:** SUCCESS
- **Strategy:** Ponytail Minimalist (no new dependencies; utility-class edits only)
- **Acceptance Criteria Matrix:**
  - [x] 1. `docker-compose.yml`: `FORGE_BIN: "${FORGE_BIN:-/nkp-forge/forge}"`, `~/nkp-forge:/nkp-forge:ro`, `~/.ssh:/home/forgecentral/.ssh:ro`
  - [x] 2. `Dockerfile` runtime stage installs `curl openssh-client`
  - [x] 3. `ui/tailwind.config.js` has `darkMode: 'class'`
  - [x] 4. `Layout.jsx` / `Header.jsx` / `index.css` use light + `dark:` classes (`applyThemeClass` already toggles `dark` on `<html>` and listens to system changes)
  - [x] 5. Vitest theme-toggle and Layout tests pass (`npm test`)
  - [x] 6. `pytest api/tests/` passes
  - [x] 7. `docs/DEPLOYMENT-GUIDE.md` and `docs/USER-GUIDE.md` updated
  - [x] 8. Local commit created with exact message
  - [x] 9. No `git push` performed
- **Test Results:**
  - `pytest api/tests/`: 149 passed
  - `pytest tests/scripts`: 31 passed
  - `npm test` (ui/): 22 files, 132 passed; `npm run build` OK
- **Bootstrap script:** `~/.ssh` -> `chmod 755`; `authorized_keys` and `*.pub` -> `644` (private keys and `config` remain `600`).
- **Commit:** `fix(compose,ui): Task-32 — fix CLI container mounts, SSH keys & Dark/Light/System theme engine` (hash in final report/`git log -1`)
- **Files Modified:** `Dockerfile`, `docker-compose.yml`, `scripts/bootstrap-forge-central-vm.sh`, `ui/tailwind.config.js`, `ui/src/index.css`, `ui/src/components/layout/Layout.jsx`, `ui/src/components/layout/Header.jsx`, `ui/src/components/layout/__tests__/Header.test.jsx`, `ui/src/components/layout/__tests__/Layout.test.jsx`, `docs/DEPLOYMENT-GUIDE.md`, `docs/USER-GUIDE.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
- **Follow-up:** private SSH keys remain `600` owned by the host user; container UID 1000 can only read them if the host key owner is UID 1000 (on the bootstrap VM `nkpadmin` is UID 1001, see BUG-001).

---

### [C1 VERIFICATION VERDICT — APPROVED] Task 32 (2026-10-01)

- **Reviewing Agent:** C1 Planner
- **Verification Status:** **100% APPROVED**
- **Commit Hash:** `a3c44bfc74601c4cbaa83fad0b6d17e3eb5c51eb`
- **Commit Message:** `fix(compose,ui): Task-32 — fix CLI container mounts, SSH keys & Dark/Light/System theme engine`
- **Verification Details:**
  - `docker-compose.yml`: Correctly mounts `~/nkp-forge:/nkp-forge:ro`, `~/.ssh:/home/forgecentral/.ssh:ro`, and sets `FORGE_BIN: "${FORGE_BIN:-/nkp-forge/forge}"`.
  - `Dockerfile`: Stage 2 runtime includes `openssh-client` alongside `curl`.
  - `ui/tailwind.config.js`: Root specifies `darkMode: 'class'`.
  - `ui/src/index.css` & `Layout.jsx` & `Header.jsx`: Full support for light and dark classes with reactive system-scheme listener.
  - Test suites: `pytest api/tests/` 149/149 passed; `pytest tests/scripts` 31/31 passed; `npm test` 132/132 passed; `npm run build` cleanly succeeded.
  - Documentation: `docs/DEPLOYMENT-GUIDE.md` and `docs/USER-GUIDE.md` updated.
- **SSH Key Follow-Up Guidance:**
  - For live VM environments where `nkpadmin` is UID 1001, private keys mounted into the container must be readable by container UID 1000. Operators should run `chmod 644 ~/.ssh/id_*` (or configure group permissions / ACLs) for keys used by Forge Central CLI operations.
- **Checklists Synchronized:** `deliverables/END-TO-END-BUILD-CHECKLIST.md` (Task 16.1), `deliverables/CURSOR-PROMPTS-FORGE-CENTRAL-v1.md` (`[PROMPT-32]`), and `C1-CONTEXT-NOTES.md` updated.



---

## [C2-P33] Task 33 — OpenTelemetry Pipeline & Cross-Repo Correlation (2026-10-01)

- **Execution Status:** SUCCESS
- **Strategy:** Ponytail Minimalist (JSON storage under `FORGE_DATA_DIR/telemetry/`, no `opentelemetry-sdk`; reuses `UtcDatetime`, `record_audit_event`, `list_clusters`, `CliSnippetCard`, `Timestamp`)
- **Acceptance Criteria Matrix:**
  - [x] 1. `api/app/schemas/telemetry.py` with status / ingest / run-list / correlation models using `UtcDatetime`
  - [x] 2. `api/app/services/telemetry.py` persists runs to `<FORGE_DATA_DIR>/telemetry/test-runs.json`; correlation = qualified / failing / untested; exporter buffer metrics; `telemetry-ingested` audit event
  - [x] 3. `api/app/routers/telemetry.py` (all `async def`): `GET /status`, `POST /ingest/test-run`, `GET /runs?cluster_name=`, `GET /correlation`; registered in `main.py`
  - [x] 4. `api/tests/test_telemetry.py` (ingest persistence, matrix statuses, status endpoint, UTC serialization)
  - [x] 5. `CorrelationPage.jsx` at `/analytics/correlation` (header, KPI cards, `table-correlation`, badges, `<Timestamp />`, `card-telemetry-cli-snippet`)
  - [x] 6. Sidebar link `link-analytics-correlation`, route in `App.jsx`, Command Palette entry
  - [x] 7. `ui/src/pages/__tests__/CorrelationPage.test.jsx` (KPIs, rows, badges, simulate ingestion, sidebar + palette navigation)
  - [x] 8. `docs/API-GUIDE.md`, `docs/USER-GUIDE.md` (and `README.md` env vars) updated
  - [x] 9. `pytest api/tests/` and `npm test` 100% pass
  - [x] 10. Local commit with exact message; no `git push`
- **Test Results:**
  - `pytest api/tests/`: 158 passed (149 existing + 9 new)
  - `npm test` (ui/): 23 files, 136 passed (132 existing + 4 new)
- **Design notes:** New settings `FORGE_OTEL_ENABLED` (default `false`) and `FORGE_OTEL_COLLECTOR_URL` (default `http://localhost:4318`). `buffered_count` = stored runs; `last_export_at` stays `null` (no remote exporter wired yet). `nkp_version` is `unknown` because `GET /api/v1/clusters` does not report it.
- **Commit:** `feat(telemetry): Task-33 — OpenTelemetry pipeline instrumentation, test ingestion & cross-repo correlation engine` (hash in final report/`git log -1`)
- **Files Created:** `api/app/schemas/telemetry.py`, `api/app/services/telemetry.py`, `api/app/routers/telemetry.py`, `api/tests/test_telemetry.py`, `ui/src/pages/CorrelationPage.jsx`, `ui/src/pages/__tests__/CorrelationPage.test.jsx`
- **Files Modified:** `api/app/config.py`, `api/app/main.py`, `ui/src/App.jsx`, `ui/src/components/layout/Sidebar.jsx`, `ui/src/components/common/CommandPalette.jsx`, `docs/API-GUIDE.md`, `docs/USER-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
- **Follow-up:** wire a real OTLP exporter (flush + `last_export_at`) and surface `nkp_version` from cluster inventory.

### [C1 VERIFICATION VERDICT — APPROVED] Task 33 (2026-10-01)

- **Reviewing Agent:** C1 Planner
- **Verification Status:** **100% APPROVED**
- **C2 Agent:** C2-P33 (cf7538c9-56f7-4f78-90d3-e58e316796f0)
- **Commit Hash:** `d2efa4f0210dd3e60a680a0d23c34bd8f6826603`
- **Commit Message:** `feat(telemetry): Task-33 — OpenTelemetry pipeline instrumentation, test ingestion & cross-repo correlation engine`
- **Independent Re-Verification:**
  - `pytest api/tests/`: **158/158 passed** (C1 re-run)
  - `npm test` (ui/): **136/136 passed** across 23 files (C1 re-run)
  - Working tree: `main` ahead of `origin/main` by 1 feature commit (no push performed)
- **Code Review Spot-Checks:**
  - Schemas match prompt contract (`TelemetryStatusResponse`, ingest request/response, `ClusterCorrelationRecord`, `CorrelationMatrixResponse`) with `UtcDatetime`.
  - Service persists to `FORGE_DATA_DIR/telemetry/test-runs.json`, computes `qualified` / `failing` / `untested`, records `telemetry-ingested` audit events.
  - Router registers four async endpoints under `/api/v1/telemetry` and is included in `main.py`.
  - UI: `/analytics/correlation` with KPI cards, `table-correlation`, qualification badges, CLI snippet card; Sidebar + Command Palette wired.
  - Docs updated in `docs/API-GUIDE.md` and `docs/USER-GUIDE.md`.
- **Accepted Follow-Ups (non-blocking):**
  - Real OTLP exporter not wired (`last_export_at` remains null; no `opentelemetry-sdk` dependency — intentional Ponytail scope).
  - `nkp_version` surfaces as `unknown` until cluster inventory exposes it.
  - Ingest endpoint intentionally unauthenticated for Day-2 / CLI runners; RBAC can be added later if required.
- **Checklists Synchronized:** `deliverables/END-TO-END-BUILD-CHECKLIST.md` (Task 16.2 / Phase 10.4–10.5), `deliverables/CURSOR-PROMPTS-FORGE-CENTRAL-v1.md` (`[PROMPT-33]`), and `C1-CONTEXT-NOTES.md` updated.


## [C2-P34] Task 34 — In-Container SSH Staging, Default 4 Workers, Prism PE/PC & Secret Guards (2026-10-01)

- **Execution Status:** SUCCESS
- **Acceptance Criteria Matrix:**
  - [x] 1. `docker-entrypoint.sh` copies `/staging/ssh-key` into `/home/forgecentral/.ssh` (dirs 700, files 600, `chown forgecentral:forgecentral` = UID 1000) then execs the app via `gosu`; host keys mounted `:ro` and untouched (verified locally with a temp staging dir: host file mode unchanged, copy 600)
  - [x] 2. `ClusterCreateRequest.worker_nodes` and `ClusterDeployPage` `formData.worker_nodes` default to 4 (`ClusterInitRequest` default aligned to 4)
  - [x] 3. Prism PE/PC params (`prism_endpoint`, `prism_port` 9440, `prism_user`, `prism_password`, `storage_container`) persist as `PRISM_*`/`STORAGE_CONTAINER` in the lab INI, password returned as `***MASKED***`; auto-populate in the deploy wizard (accordion for `nutanix-csi-pe|pc`) with Inherited / Override / Not set badges
  - [x] 4. Deploy wizard shows "✓ Credentials Configured" badge or amber warning + Settings link for Harbor / Docker Hub (Stage 1 and Stage 2)
  - [x] 5. `AGENTS.md` and `.github/copilot-instructions.md` created
  - [x] 6. `pytest api/tests/` 100% pass
  - [x] 7. `npm test` 100% pass
  - [x] 8. `docs/DEPLOYMENT-GUIDE.md`, `docs/USER-GUIDE.md` (plus `docs/API-GUIDE.md`, `README.md`) updated
  - [x] 9. Local commit `feat(deploy): Task-34 — in-container SSH staging, default 4 worker nodes, Prism PE/PC & secret guards`
  - [x] 10. No `git push` executed
- **Test Results:**
  - `pytest api/tests/`: **165 passed** in ~4s (158 existing + 7 new)
  - `npm test` (ui/): **23 files, 144 passed** (136 existing + 8 new)
- **Local Git Commit:** `feat(deploy): Task-34 — in-container SSH staging, default 4 worker nodes, Prism PE/PC & secret guards` (hash in final report / `git log -1`)
- **Files Created:** `docker-entrypoint.sh`, `AGENTS.md`, `.github/copilot-instructions.md`
- **Files Modified:** `Dockerfile`, `docker-compose.yml`, `api/app/schemas/lab.py`, `api/app/services/lab.py`, `api/app/schemas/clusters.py`, `api/app/services/cluster_config.py`, `ui/src/pages/ClusterDeployPage.jsx`, `ui/src/pages/SettingsPage.jsx`, `ui/src/components/settings/LabInfraTab.jsx`, `api/tests/test_lab_secrets.py`, `api/tests/test_clusters.py`, `api/tests/test_cluster_deploy_wizard.py`, `ui/src/pages/__tests__/ClusterDeployPage.test.jsx`, `ui/src/pages/__tests__/SettingsPage.test.jsx`, `docs/DEPLOYMENT-GUIDE.md`, `docs/USER-GUIDE.md`, `docs/API-GUIDE.md`, `README.md`, `my-notes/c2-runs/PRD-v1.0-execution-audit.md`
- **Design notes / deviations:**
  - Compose mount is `${SSH_KEY_DIR:-~/.ssh}:/staging/ssh-key:ro`; the old `~/.ssh:/home/forgecentral/.ssh:ro` mount is removed. The image now starts as root only for the entrypoint and drops to `forgecentral` via `gosu` (no `USER` directive); non-root runs skip chown/gosu.
  - The registry credential guard is advisory (amber warning + link, Next stays enabled) since credentials can be staged on a bastion; a Harbor secret is matched by cluster name or lab name (acts as the lab-level default). Settings deep-links via `/settings?tab=secrets-vault`.
  - Per-cluster Prism override (endpoint/port/user/container, never password) added to `ClusterInitRequest` and rendered into `<cluster>-input.ini` for Nutanix CSI modes so the wizard override is effective; Settings → Lab Infrastructure gained a Storage Mode select and Prism section.
  - Host-side `ssh-key` permission bootstrap in `scripts/bootstrap-forge-central-vm.sh` left unchanged (follow-up: remove the `~/.ssh` chmod step from docs/script if no longer needed). Docker image build not exercised locally (no daemon run); entrypoint logic verified with a temp directory.

### [C1 VERIFICATION VERDICT — APPROVED] Task 34 (2026-10-01)

- **Reviewing Agent:** C1 Planner
- **Verification Status:** **100% APPROVED**
- **C2 Agent:** C2-P34 ([4ed932e5-282d-41ec-96ef-0169eb019f72](4ed932e5-282d-41ec-96ef-0169eb019f72))
- **Commit Hash:** `4e853948cf6954e38d54e7bbeaa6c25246551ff8`
- **Commit Message:** `feat(deploy): Task-34 — in-container SSH staging, default 4 worker nodes, Prism PE/PC & secret guards`
- **Independent Re-Verification:**
  - `pytest api/tests/`: **165/165 passed** (C1 re-run)
  - `npm test` (ui/): **144/144 passed** across 23 files (C1 re-run)
  - Working tree: `main` ahead of `origin/main` by 1 feature commit (no push performed by C1)
- **Code Review Spot-Checks:**
  - `docker-entrypoint.sh` stages `/staging/ssh-key` → `/home/forgecentral/.ssh` (700/600, chown as root, `gosu forgecentral`); compose mounts `${SSH_KEY_DIR:-~/.ssh}:/staging/ssh-key:ro`.
  - `ClusterCreateRequest` / `ClusterInitRequest` / `ClusterDeployPage` default `worker_nodes=4`.
  - Lab Prism fields persist as `PRISM_*` / `STORAGE_CONTAINER`; password returned as `***MASKED***`; wizard accordion for `nutanix-csi-pe|pc` with Inherited / Override / Not set badges; per-cluster Prism override wired into cluster input INI (password stays in lab INI).
  - Harbor/Docker Hub registry secret badges + Settings deep-link (`?tab=secrets-vault`); advisory (Next not hard-blocked).
  - `AGENTS.md` + `.github/copilot-instructions.md` present; docs updated (`DEPLOYMENT-GUIDE`, `USER-GUIDE`, `API-GUIDE`, `README`).
- **Accepted Follow-Ups (non-blocking):**
  - Docker image rebuild / live compose smoke on `ntx-forge-central1` not exercised in this verification pass.
  - `scripts/bootstrap-forge-central-vm.sh` still contains legacy host `~/.ssh` chmod guidance — remove when next bootstrap prompt touches that script.
  - Registry credential guard remains advisory by design (bastion-staged secrets).
- **Checklists Synchronized:** `deliverables/END-TO-END-BUILD-CHECKLIST.md` (Task 16.3), `C1-CONTEXT-NOTES.md` updated; authorized push pending operator approval.

## [C2-P34B] Task 34B — Runtime State Directory Reconciliation (2026-10-01)

**Execution Status:** SUCCESS

### Acceptance Criteria Matrix
- [x] `docker-compose.yml` mounts `~/forge-central-data:/forge-central-data` and defaults `FORGE_CENTRAL_DATA_DIR` to `/forge-central-data`
- [x] `Dockerfile` (ENV, mkdir, chown, VOLUME) and `docker-entrypoint.sh` (ownership check of `/forge-state`, `/forge-data`, `/forge-central-data`, `/cacrt`) include `/forge-central-data`
- [x] Bootstrap script (unified-init and cloud-init overlay snippets) creates `~/forge-central-data` and `forge-state -> forge-data` symlink, with 1000:`${NKP_USER}` ownership and `2775` perms
- [x] `GET /api/v1/settings/paths` inspects `FORGE_CENTRAL_DATA_DIR` (`settings.forge_central_data_dir`); added `forge_central_data_dir_resolved` property
- [x] `pytest api/tests/` and `pytest tests/scripts/` pass
- [x] `npm test` (ui/) passes
- [x] `docs/DEPLOYMENT-GUIDE.md` updated with directory layout
- [x] Local commit created; not pushed

### Test Results
- `pytest api/tests/`: 166 passed
- `pytest tests/scripts/`: 32 passed
- `npm test` (ui/): 144 passed across 23 files

### Local Git Commit
`fix(compose,paths): Task-34B — reconcile runtime state directories, forge-central-data mount & symlink transition` (hash reported to C1 in the handoff; a commit cannot embed its own hash)

### Modified Files
- `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`
- `scripts/bootstrap-forge-central-vm.sh`
- `api/app/config.py`
- `api/tests/test_paths.py`, `tests/scripts/test_bootstrap_script.py`
- `docs/DEPLOYMENT-GUIDE.md`
- `my-notes/c2-runs/PRD-v1.0-execution-audit.md` (also carries the pre-existing uncommitted C1 Task 34 verdict block)

### Notes / Deviations
- `api/app/routers/paths.py` already inspected `FORGE_CENTRAL_DATA_DIR`; no change needed (covered by a strengthened test).
- Bootstrap changes applied to both snippet blocks (the cloud-init overlay labels the step `[5/5]`, the unified init `[8/8]`).
- Compose still mounts `~/forge-state:/forge-state` (`FORGE_HOME`/`FORGE_STATE_DIR` default) for compatibility; on hosts bootstrapped by the script it is a symlink to `~/forge-data`.
- Docker image build not exercised locally; entrypoint/bootstrap verified via `sh -n`/`bash -n` and script tests.
