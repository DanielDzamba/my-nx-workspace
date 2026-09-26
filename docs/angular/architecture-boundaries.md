# Architecture boundaries (angular-demo)

The frontend is cut into **domains** (vertical, business-aligned) and **layers** (horizontal,
technical). The rules are enforced by [Sheriff](https://sheriff.softarc.io) through ESLint
(`sheriff.config.ts`, `apps/angular-demo/eslint.config.mjs`), so `nx lint angular-demo` fails on
every violation.

## Layout

```
apps/angular-demo/src/
  main.ts, app/app.*            app shell (Sheriff "root"): bootstrap, routes, global providers
  app/domains/
    <domain>/                   e.g. todos
      feature-<feature>/        smart components for one use case, e.g. feature-todo-list
      ui/                       presentational components
      data/                     models, data-access clients, stores
      util/                     pure helpers (no Angular state)
    shared/                     same layers, used by every domain
      ui/  data/  util/
mylib/src                       workspace library, treated as shared/ui
```

Only create the layers a domain needs. Current reference domain: `todos`.

## Dependency rules

Layers only depend **downwards**; domains do not depend on each other.

| From \ may import | feature | ui  | data       | util |
| ----------------- | ------- | --- | ---------- | ---- |
| **feature**       | –       | ✓   | ✓          | ✓    |
| **ui**            | –       | –   | types only | ✓    |
| **data**          | –       | –   | –          | ✓    |
| **util**          | –       | –   | –          | –    |

- Any layer of a domain may import the same or lower layer of `shared` (and `@mylib`).
- A domain never imports another domain. If two domains need the same code, it moves to `shared`
  — only when the user asks for it (see below).
- The app shell (root) may import `feature-*` modules (for routes) and `shared`.
- `ui` may use data models only via `import type` (enforced by `no-restricted-imports`), so
  presentational components can never inject a store or client.

## Public API

Every module (each folder above) exposes its public API through `index.ts`. Import other modules
only through their `index.ts` (`'../data'`, not `'../data/todo-client'`); deep imports are lint
errors. Inside a module, import files relatively.

Keep implementation details out of `index.ts`. Example: `todos/data/index.ts` exports the `Todo`
model and `TodoStore`, but not `TodoClient`, so features cannot bypass the store.

## Naming

- Smart components (in `feature-*`) end with `Page`, `Search`, `Detail` or `Edit` and are the only
  components that inject stores. Files: `todo-list-page.ts`, class `TodoListPage`.
- Presentational components (in `ui`) have no suffix: `TodoItem`, `TodoAddForm`. They use
  `input()` / `output()` / `model()` only.
- Data access: `<entity>-client.ts` (`TodoClient`); stores: `<entity>-store.ts` (`TodoStore`);
  models: `<entity>.ts`.
- Selector prefix `app-`.

## Adding code

- **New use case in an existing domain**: new `feature-<name>` folder with `index.ts`; reuse the
  domain's `ui` / `data`. It is picked up by the `feature-<feature>` pattern automatically.
- **Code needed by one feature only** can stay inside that feature folder (feature slicing). Move it
  down into the domain's `ui` / `data` / `util` once a second feature needs it.
- **New domain**: a new folder under `domains/` is picked up by the `<domain>` pattern. Creating one
  is an architecture decision — ask the user first.
- **Moving code to `shared`** happens only on explicit request.
- **Cross-domain access** is never solved by loosening `sheriff.config.ts`. Stop and ask the user.

## Configuration values

Modules must not import from outside `app/domains` (e.g. `environments/`). Values like the API
origin are provided by the shell via DI: `API_BASE_URL` (`domains/shared/util`) is provided in
`app.config.ts` from `environment.apiUrl`.

## Reference use case

`domains/todos` shows every layer:

- `feature-todo-list/todo-list-page.ts` — routed smart component, provides and uses `TodoStore`,
  maps mutation results to user messages.
- `ui/todo-item`, `ui/todo-add-form` — presentational, emit events, own only local UI state.
- `data/todo-store.ts` — Signal Store; `data/todo-client.ts` — HTTP; `data/todo.ts` — models.
