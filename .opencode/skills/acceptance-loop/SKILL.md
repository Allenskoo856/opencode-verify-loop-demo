---
name: acceptance-loop
description: Turn a reviewed requirement into protected API and frontend acceptance assets, then use the external Verify Controller as the only completion judge.
---

# Acceptance Loop

## Goal

Use SDD to define a small, testable task and Harness to give OpenCode a deterministic judge. The model may propose acceptance assets, but it must not weaken an already reviewed contract.

## Required input

Read the task document completely. It must state:

- scope and explicit non-goals;
- actors, request/response or UI sequence;
- observable Given/When/Then acceptance conditions;
- required automated tests and data/environment limits;
- risks, ambiguity, and forbidden paths.

If an acceptance phrase says only “fast”, “smooth”, “reliable”, or similar, mark it `AMBIGUOUS` and ask for a measurable signal. Do not invent a threshold.

## Generate a candidate

Write candidates under `docs/work/acceptance/`, never directly into protected acceptance paths:

1. `acceptance/v1` JSON for real API cases. Use status, headers, JSONPath assertions, captures, and unique data.
2. Native project tests for business/database behavior. Use the repository's configured Maven, Gradle, pytest, or other command.
3. Native Playwright/Cypress cases for frontend behavior. Prefer semantic locators and isolated contexts; preserve trace/screenshot/video/console/network evidence.
4. A mapping from each requirement ID to one or more cases and the command/Gate that executes it.

The API contract format and an executable example are in `acceptance/README.md` and `acceptance/specs/orders-api.json`.

## Review checkpoint

Before running a Loop, a human or protected repository process must review and promote the candidate to `acceptance/specs/**` and the frontend E2E test directory. Check authentication, authorization, negative paths, idempotency, persistence after reload, cleanup, and production safety. The acceptance files then become immutable to the model.

## Repair loop

Run the narrowest external profile first:

```bash
node verify-controller-ts/dist/verify-loop.js verify --profile api
node verify-controller-ts/dist/verify-loop.js verify --profile backend
node verify-controller-ts/dist/verify-loop.js verify --profile frontend
node verify-controller-ts/dist/verify-loop.js verify --profile frontend-e2e
```

For a complete local check use `full`; for a real staging target use `staging` with explicit target variables. Read the newest `artifacts/verify/<run-id>/evidence.json` and its Gate log. Fix implementation or environment problems only. Never edit `acceptance/specs/**`, `acceptance/project.json`, `verify/**`, `docs/tasks/**`, `e2e/specs/**`, or `frontend/e2e/**` to make a failing Gate pass.

Stop and report instead of guessing when:

- the document is ambiguous;
- the fix needs a protected or out-of-scope path;
- the target environment is missing or unsafe;
- the maximum iteration count is reached.

Completion requires fresh external evidence with `conclusion=PASS`; model text, todo state, screenshots, and idle events do not count.
