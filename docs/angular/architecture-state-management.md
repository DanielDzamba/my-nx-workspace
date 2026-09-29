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

| Need                            | Use                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Load data (reactive to params)  | `withResource(store => ({ name: rxResource({ stream: ... }) }))` — gives `nameValue`, `nameIsLoading`, `nameError`, `nameStatus`                                                     |
| Change data on the server       | `withMutations(store => ({ name: rxMutation({ operation, onSuccess }) }))` — gives `name(param)` returning `Promise<MutationResult>` plus `nameIsPending`, `nameError`, `nameStatus` |
| Apply a server response locally | `patchState(store, { nameValue: ... })` in the mutation's `onSuccess`                                                                                                                |
| Derived values                  | `withComputed`                                                                                                                                                                       |

Prefer named resources (`{ todos: rxResource(...) }`) so signals are self-describing.
`rxMutation` uses `concatOp` by default (calls are queued); choose `switchOp` / `exhaustOp` /
`mergeOp` via `operator` when the use case needs it.

## Parameters from the route

What a page shows (an id, filter, sort, page) lives in the URL, so reload, the back button and
shared links work. The router binds route and query params to inputs of the routed component
(`withComponentInputBinding()` in `app.config.ts`); the page parses them and connects the
signal to its store:

```ts
readonly page = input<string>(); // ?page=2
protected readonly pageIndex = computed(() => parsePageParam(this.page()));

constructor() {
  this.store.connectPage(this.pageIndex); // signalMethod: follows the signal
}
```

- The store keeps the parameter in state, `null` until connected, and the resource's `params`
  return `undefined` while it is `null`. Otherwise the resource would first load with a default
  value and then again with the real one.
- The page changes what is shown by navigating (`router.navigate([], { relativeTo, queryParams })`),
  never by patching the store: the URL stays the single source of truth.
- Parsing lives in the domain's `util` layer and falls back to defaults for invalid values.
- Paged lists reload the current page after a mutation (the server decides where a changed item
  belongs); a detail store applies the mutation's response to its value instead.

## Store types

- **List / search store** (e.g. `TodoStore`): one resource for the (paged) collection, keyed by the
  query; mutations that keep it in sync.
- **Detail store** (e.g. `TodoDetailStore`): resource keyed by an id signal
  (`params: () => store.id() ?? undefined`).
- **Lookup store**: small, rarely changing reference data, usually `providedIn: 'root'`.
- **UI state**: prefer component signals; a store only if several components share it.

## Handling results in components

A smart component awaits the mutation and decides what the user sees:

```ts
const result = await this.store.addTodo(title);
if (result.status === 'success') {
  this.newTitle.set('');
}
if (result.status === 'error') {
  this.error.set('Úlohu sa nepodarilo pridať.');
}
```

User-facing texts belong to the component, not the store.

## Testing

- Store specs: provide the store, `provideHttpClient()`, `provideHttpClientTesting()`; after
  flushing a resource request, `await TestBed.inject(ApplicationRef).whenStable()`; await the
  promise returned by a mutation before asserting.
- Mutations are not Angular pending tasks: in component tests, wait a macrotask
  (`await new Promise(r => setTimeout(r))`) before asserting on what a mutation handler changed.
