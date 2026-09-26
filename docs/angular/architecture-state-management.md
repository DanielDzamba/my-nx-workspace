# State management (angular-demo)

Shared and server state lives in **NgRx Signal Stores** (`@ngrx/signals`) extended with the
**NgRx Toolkit** (`@angular-architects/ngrx-toolkit`). Local, purely visual state (e.g. "which row
is being edited", a text draft) stays in component signals.

Reference: `apps/angular-demo/src/app/domains/todos/data/todo-store.ts`.

## Rules

- Stores live in the `data` layer of their domain, file `<entity>-store.ts`, exported from the
  layer's `index.ts`.
- Stores never call `HttpClient` directly. They delegate to a data-access client
  (`<entity>-client.ts`) injected via `withProps(() => ({ _client: inject(...) }))`. Members starting
  with `_` are private to the store.
- Only smart components (`*Page`, `*Search`, `*Detail`, `*Edit` in `feature-*`) inject stores.
  Presentational components get data via inputs and report via outputs.
- Provide a store where its lifetime belongs: usually in the smart component
  (`providers: [TodoStore]`), `{ providedIn: 'root' }` only for app-wide state.
- Every store starts with `withDevtools('<name>')` (Redux DevTools; a no-op without the extension).
- State is immutable: update with `patchState`, never mutate arrays or objects.
- Derived values are `withComputed`; do not store what can be computed.

## Building blocks

| Need | Use |
|---|---|
| Load data (reactive to params) | `withResource(store => ({ name: rxResource({ stream: ... }) }))` — gives `nameValue`, `nameIsLoading`, `nameError`, `nameStatus` |
| Change data on the server | `withMutations(store => ({ name: rxMutation({ operation, onSuccess }) }))` — gives `name(param)` returning `Promise<MutationResult>` plus `nameIsPending`, `nameError`, `nameStatus` |
| Apply a server response locally | `patchState(store, { nameValue: ... })` in the mutation's `onSuccess` |
| Derived values | `withComputed` |

Prefer named resources (`{ todos: rxResource(...) }`) so signals are self-describing.
`rxMutation` uses `concatOp` by default (calls are queued); choose `switchOp` / `exhaustOp` /
`mergeOp` via `operator` when the use case needs it.

## Store types

- **List / search store** (e.g. `TodoStore`): one resource for the collection, mutations that keep
  it in sync.
- **Detail store**: resource keyed by an id signal (`params: () => ({ id: store.id() })`).
- **Lookup store**: small, rarely changing reference data, usually `providedIn: 'root'`.
- **UI state**: prefer component signals; a store only if several components share it.

## Handling results in components

A smart component awaits the mutation and decides what the user sees:

```ts
const result = await this.store.addTodo(title);
if (result.status === 'success') { this.newTitle.set(''); }
if (result.status === 'error') { this.error.set('Úlohu sa nepodarilo pridať.'); }
```

User-facing texts belong to the component, not the store.

## Testing

- Store specs: provide the store, `provideHttpClient()`, `provideHttpClientTesting()`; after
  flushing a resource request, `await TestBed.inject(ApplicationRef).whenStable()`; await the
  promise returned by a mutation before asserting.
- Mutations are not Angular pending tasks: in component tests, wait a macrotask
  (`await new Promise(r => setTimeout(r))`) before asserting on what a mutation handler changed.
