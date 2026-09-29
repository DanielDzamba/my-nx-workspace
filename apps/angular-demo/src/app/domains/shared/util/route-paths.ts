/**
 * Single source of truth for the app's routes: never hard-code a route path or URL elsewhere.
 * `ROUTE_PATHS` holds the segments for the route config (`app.routes.ts`),
 * `ROUTE_URLS` the absolute URLs for `routerLink`, `navigateByUrl` and `createUrlTree`.
 */
export const ROUTE_PATHS = {
  home: '',
  todos: 'todos',
  /** `:id` is bound to the `id` input of the routed component (`withComponentInputBinding`). */
  todoDetail: 'todos/:id',
  adminTodos: 'admin/todos',
} as const;

export const ROUTE_URLS = {
  home: `/${ROUTE_PATHS.home}`,
  todos: `/${ROUTE_PATHS.todos}`,
  todoDetail: (id: number) => `/${ROUTE_PATHS.todos}/${id}`,
  adminTodos: `/${ROUTE_PATHS.adminTodos}`,
} as const;
