# Agent guide

Nx monorepo with two apps:

| Project | Path | Stack |
|---|---|---|
| `angular-demo` | `apps/angular-demo` | Angular 20 (standalone, signals, NgRx Signal Store), Vitest |
| `java-api` | `apps/java-api` | Spring Boot 4 / Java 21, PostgreSQL |
| `mylib` | `mylib` | Angular UI library, imported as `@mylib` |

Run tasks through Nx: `npx nx <target> <project>` (`lint`, `test`, `build`, `serve`).
Skills in `.claude/skills` cover running the stack (`runapp`, `run-java-api`) and PRs (`pr`).

## Angular: red lines

These hold for all frontend code (`apps/angular-demo`, `mylib`). Details and rationale:
`docs/angular/coding-conventions.md`.

- Standalone components only; never set `standalone: true` (it is the default).
- `ChangeDetectionStrategy.OnPush` on every component.
- State in signals: `signal()`, `computed()`, `linkedSignal()`; `input()` / `output()` / `model()`
  instead of decorators; `inject()` instead of constructor injection.
- Native control flow (`@if`, `@for` with `track`, `@switch`); no `*ngIf`, `ngClass`, `ngStyle`.
- Host bindings in the `host` object, never `@HostBinding` / `@HostListener`.
- No `any`. Strict TypeScript and strict templates stay on.
- Code lives in the domain × layer structure and respects its boundaries:
  **read `docs/angular/architecture-boundaries.md` before creating, moving or importing across folders.**
- Shared state goes into NgRx Signal Stores in the `data` layer:
  **read `docs/angular/architecture-state-management.md` before adding or changing a store.**
- Never loosen `sheriff.config.ts` or lint rules to make an error go away. Cross-domain access or a
  new domain is an architecture decision: ask the user first.

## Verify

`node tools/scripts/ci-checks.mjs` runs lint (incl. Sheriff) and unit tests for the frontend,
`--full` adds the production build. A Claude Code Stop hook runs the fast checks automatically when
frontend files changed and feeds failures back.

## Angular tooling

- Angular CLI MCP server (`.mcp.json`): `get_best_practices`, `search_documentation` for Angular 20 docs.
- Skill `angular-developer` (from github.com/angular/skills) for Angular APIs; it targets the latest
  Angular, so check that an API exists in 20.1 before using it (e.g. Signal Forms do not).
- Skill `architecture-review` to review frontend changes against the docs above.
