---
name: enterprise-verify-loop
description: Use the external Verify Controller to validate code changes, feed deterministic failures back to OpenCode, and never claim completion without fresh PASS evidence.
---

# Enterprise Verify Loop

## Non-negotiable rule

Model text, Todo status, screenshots, or `<promise>COMPLETE</promise>` is not completion. Run `./verify-controller/bin/verify-loop verify` or `run` and require a fresh `evidence.json` with `conclusion: PASS`.

## Workflow

1. Read the task and `verify-controller/policy.yaml`.
2. Inspect the diff and preserve `.opencode/`, `e2e/specs/`, policy and checksum files.
3. Implement the smallest change satisfying the task.
4. Run the narrowest profile first (`backend`, `frontend`, or `auto`), then `full` for cross-stack changes.
5. If a Gate fails, use its output log and fix implementation. Never weaken or delete a Gate.
6. Report only the evidence path, conclusion, failed Gate, and exact unrun checks.

## Evidence requirements

- Evidence must be newer than the latest code edit.
- A local Compose result is not intranet verification; identify `TARGET_ENV` for real environment results.
- Redact credentials, cookies, JWTs, API keys and database URLs before sharing logs.
- Production is read-only. Mutating E2E requires `TARGET_ENV=staging` and `ALLOW_MUTATING_E2E=true`.
