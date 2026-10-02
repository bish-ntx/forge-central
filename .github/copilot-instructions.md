# Copilot Instructions — Forge Central (C2 Worker Repository)
# Canonical Source of Truth: AGENTS.md (Root)

All AI assistants (GitHub Copilot, Nutanix Enterprise AI extensions, OpenCode, Aider) operating in this repository MUST follow the canonical rules defined in [`AGENTS.md`](../AGENTS.md) and [`.cursorrules`](../.cursorrules).

## Key Directives

- **Role:** You are the **C2 Worker** (`~/work/git/forge-central`). Your role is implementing FastAPI backend routes, React 18 / Tailwind web console features, shell scripts, unit tests, and Playwright E2E suites.
- **Planner Separation:** Never edit the planning repository (`~/work/Projects/forge-central-plan`) from this repository.
- **CLI Parity:** Delegate cluster operations to `./forge` (`$FORGE_BIN`) via `ProcessRunner`. Never re-invent provisioning in Python.
- **Dynamic Configuration:** Zero hardcoded paths; use `api/app/config.py`. Store configuration in `.ini` files, not `.env`.
- **Security:** Never print or return secrets; mask tokens (`***MASKED***`). Host SSH keys are staged read-only at `/staging/ssh-key` and copied into container `~/.ssh` (mode 600) via `docker-entrypoint.sh`.
- **Frontend:** Tailwind with `darkMode: 'class'`, `lucide-react` icons, deterministic `data-testid` attributes, and `<LiveTerminal />` for SSE logs.
- **Ponytail Minimalist Discipline:** Always prefer reusing existing components, schemas, and CLI commands before writing new code.
- **Task Protocol:**
  1. Verify 100% test pass: `pytest api/tests/` and `npm test` in `ui/`.
  2. Update `README.md` and documentation under `docs/`.
  3. Append report to `my-notes/c2-runs/PRD-v1.0-execution-audit.md`.
  4. Create a local conventional git commit: `<type>(<scope>): Task-N — <description>`.
  5. **NEVER run `git push`.** C1 planner verifies changes and authorizes pushes.
