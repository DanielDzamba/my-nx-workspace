---
name: architecture-review
description: Review Angular frontend code (apps/angular-demo, mylib) against the repository's architecture and coding rules in docs/angular/. Use when asked to review frontend changes, check architecture, or before opening a PR that touches the frontend.
---

# Architecture review (Angular frontend)

The rules live in the docs; this skill only describes the workflow. Do not restate or reinterpret
the rules — cite them.

1. Read `docs/angular/architecture-boundaries.md`, `docs/angular/architecture-state-management.md`
   and `docs/angular/coding-conventions.md`.
2. Determine the scope: the files named by the user, otherwise
   `git diff --name-only main...HEAD` plus uncommitted changes, filtered to `apps/angular-demo` and
   `mylib`.
3. Run the deterministic checks first: `node tools/scripts/ci-checks.mjs`. Report any failure as-is;
   Sheriff and lint errors are authoritative.
4. Then review what tools cannot check, for each changed file:
   - Is the code in the right domain and layer? Would it belong in feature-local code instead
     (feature slicing), or was it moved to `shared` without being asked?
   - Does `index.ts` expose only what other modules should use?
   - Smart vs. presentational: only `*Page` / `*Search` / `*Detail` / `*Edit` inject stores; `ui`
     components are driven by inputs/outputs.
   - Stores: delegate to a client, immutable updates, derived state in `withComputed`, user-facing
     texts outside the store.
   - Naming and file conventions; tests present and testing behaviour via DOM / public API.
5. Report findings grouped by severity (violation of a documented rule → suggestion), each with
   `file:line`, the rule's doc section, and a concrete fix. Say explicitly when nothing was found.

Do not change code during the review unless the user asks. Anything that requires cross-domain
access, a new domain, or a change to `sheriff.config.ts` is a question for the user, not a fix.
