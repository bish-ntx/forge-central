# Copilot Instructions — Forge Central (worker repo)

Canonical governance lives in [`AGENTS.md`](../AGENTS.md); detailed engineering rules in [`.cursorrules`](../.cursorrules). Follow both.

Key points:
- This repo is the **C2 worker**: FastAPI (async, Pydantic v2) backend in `api/`, React 18 + Vite + Tailwind web console in `ui/`. The planner repo `forge-central-plan` is never edited from here.
- Provisioning is delegated to the `./forge` CLI (`$FORGE_BIN`) through `ProcessRunner`; never re-implement it in Python.
- No hardcoded paths (use `api/app/config.py`); lab config is `.ini`, not `.env`.
- Never log or return secrets; mask as `***MASKED***`. Host SSH keys are staged read-only at `/staging/ssh-key` and copied into the container by `docker-entrypoint.sh`.
- UI: `lucide-react` icons only, dark/light/system themes, deterministic `data-testid` attributes, `<LiveTerminal />` for SSE logs.
- Keep diffs minimal (reuse existing schemas/components/hooks first).
- Before finishing: `pytest api/tests/` and `npm test` (in `ui/`) must pass; update `README.md`/`docs/`; append the report to `my-notes/c2-runs/PRD-v1.0-execution-audit.md`; make a local conventional commit `<type>(<scope>): Task-N — <description>`.
- **Never run `git push`.**
