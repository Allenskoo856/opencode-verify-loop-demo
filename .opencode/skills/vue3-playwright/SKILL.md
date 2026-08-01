---
name: vue3-playwright
description: Implement and verify Vue 3 TypeScript UI with unit tests, isolated Playwright E2E, stable locators, real API failures, and trace evidence.
---

# Vue 3 + Playwright

- Use Vue 3 Composition API, strict TypeScript, accessible labels and stable `data-testid` only when a role/name is insufficient.
- Keep API calls in a client layer and make loading, empty, 401 and 5xx states visible.
- Unit-test stores and views with Vitest/Vue Test Utils; do not replace browser testing with mocks.
- E2E uses an isolated Playwright context. Never copy a real Chrome profile, cookie, token or session ID.
- Prefer user-visible assertions and wait on UI state, not arbitrary sleeps.
- Collect trace, screenshot, video, console errors and failed requests. A test skipped by a healer is a failure until the acceptance spec changes.
- Playwright planner/generator/healer may create or repair tests; the external Verify Controller remains completion authority.

Before reporting frontend completion, run `./verify-controller/bin/verify-loop verify --profile frontend` and include the fresh evidence path.
