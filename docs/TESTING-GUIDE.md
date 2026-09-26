# Forge Central Testing Guide

## Scope

This guide covers local backend API tests and Playwright-based UI automation for the Forge Central web console.

## Backend Pytest Suite

Install backend dependencies:

```bash
cd ~/work/git/forge-central
python3 -m pip install -r api/requirements.txt
```

Run backend tests:

```bash
pytest api/tests/
```

## Playwright Python E2E Suite

Install Python and browser automation dependencies:

```bash
cd ~/work/git/forge-central
python3 -m pip install -r api/requirements.txt -r tests/e2e/requirements-e2e.txt
python3 -m playwright install chromium --with-deps
```

> **Architecture & Sandbox Note for macOS (Apple Silicon arm64):**  
> If executing inside a sandboxed CLI runtime or virtualized environment where Python reports `x64` / `darwin-x64`, Playwright may download x86_64 binaries (`mac-x64`) resulting in architecture mismatches. Always run `playwright install chromium` natively or in the non-sandboxed host runtime matching your workstation CPU architecture (`arm64`).

Install frontend dependencies:

```bash
cd ~/work/git/forge-central/ui
npm install
```

Run E2E tests headlessly:

```bash
cd ~/work/git/forge-central
pytest tests/e2e/ --browser chromium
```

The `tests/e2e/conftest.py` harness starts:

- FastAPI backend (`uvicorn api.app.main:app`)
- Vite dev server (`npm run dev`) with `VITE_TERMINAL_STREAM_URL` bound to a deterministic SSE endpoint

## Current E2E Coverage

`tests/e2e/test_web_console_e2e.py` validates:

- Sidebar navigation using stable `data-testid` locators (`link-vms`, `link-clusters`, `link-fleet`, `link-ipam`, `link-settings`)
- Mode switching via `data-testid="toggle-mode"` with header badge updates
- Theme mode cycle (`dark`, `light`, `system`) via `data-testid="toggle-theme-mode"`, including `<html>` class updates and `localStorage` persistence (`forge_theme_preference`)
- Live terminal stream rendering via `data-testid="terminal-live-logs"`

## CI Workflow

GitHub Actions workflow: `.github/workflows/ui-e2e-ci.yml`

Triggers:

- Push to `main`
- Pull request targeting `main`
- Manual run (`workflow_dispatch`) with inputs:
  - `environment` (`mock` by default, or lab URL)
  - `test_scope` (`all`, `e2e`, or `component`)
  - `runner_label` (`ubuntu-latest` or `self-hosted`)

Artifacts uploaded on every run:

- `tests/e2e/report.html` (pytest HTML report)
- Playwright traces (`trace.zip`) for failed tests
- Failure screenshots (`.png`)
