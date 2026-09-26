# Angular coding conventions

Angular 20.1. Lint enforces most of this (`apps/angular-demo/eslint.config.mjs`); the Angular CLI
MCP tool `get_best_practices` is the upstream source.

## Components

- Standalone (default; do not write `standalone: true`), `changeDetection: ChangeDetectionStrategy.OnPush`.
- `input()`, `input.required()`, `output()`, `model()` — no `@Input` / `@Output`. Outputs are
  `readonly` and not named like DOM events (`toggleCompleted`, not `toggle`).
- `inject()` for DI, fields `private readonly` (or `protected readonly` when the template needs them).
- Template-facing members are `protected`; the public API of a component is its inputs/outputs.
- Host bindings/listeners in `host: { ... }`.
- Separate `.html` / `.css` files; small inline templates are fine for tiny components.
- `class` / `style` bindings, never `ngClass` / `ngStyle`. `NgOptimizedImage` (`ngSrc`) for images.
- Every `<button>` has an explicit `type`.

## Reactivity

- `signal()` for state, `computed()` for derived state, `linkedSignal()` for state that resets
  when a source changes (e.g. an edit draft), `set` / `update` never `mutate`.
- `effect()` only for side effects outside Angular (logging, DOM APIs), never to copy state.
- Async data via `resource` / `rxResource` (in stores via `withResource`), not manual `subscribe`
  in components.

## Templates

- `@if`, `@for` (always with `track`), `@switch`, `@empty`; `@if (x(); as value)` to read once.
- No logic beyond simple expressions; move it to `computed()` or methods.
- Self-closing tags for components without content (`<app-todo-item ... />`).
- Accessibility: form controls have a label or `aria-label`; errors use `role="alert"`.

## Forms

- Single inputs: `[(ngModel)]` bound to a signal / `model()`.
- Forms with several fields or validation: Reactive forms (`FormGroup`, typed).
- Signal Forms require Angular 22+; do not use them here yet.

## Services and data access

- `@Injectable({ providedIn: 'root' })` for singletons.
- HTTP only in `*-client.ts` classes in the `data` layer; URLs built from `API_BASE_URL`.

## TypeScript

- Strict mode and strict templates stay on. No `any`; use `unknown` and narrow.
- Prefer `interface` for models, `import type` when only types are needed.

## Tests (Vitest + TestBed)

- Next to the code: `<file>.spec.ts`.
- Test behaviour through the DOM and public API (inputs, outputs, store signals), not protected
  members.
- Presentational components: set inputs with `fixture.componentRef.setInput()`, subscribe to
  outputs, no HTTP.
- Smart components and stores: real store + client with `provideHttpClientTesting()` and
  `HttpTestingController`; `afterEach(() => http.verify())`.
- `ngModel` writes asynchronously: `await fixture.whenStable()` before reading or typing into inputs.
