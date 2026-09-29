/**
 * What the todo list shows: filter, sort and page. It lives in the URL
 * (`/todos?status=active&q=milk&sort=title&page=2`), so a reload, the back button or a shared
 * link shows the same list. The routed page receives the query params as inputs
 * (`withComponentInputBinding`), so their names are the input names of `TodoListPage`.
 */
export const TODO_STATUSES = {
  all: 'all',
  active: 'active',
  completed: 'completed',
} as const;
export type TodoStatus = (typeof TODO_STATUSES)[keyof typeof TODO_STATUSES];

export const TODO_SORTS = {
  newest: 'newest',
  oldest: 'oldest',
  titleAsc: 'title',
  titleDesc: 'title-desc',
} as const;
export type TodoSort = (typeof TODO_SORTS)[keyof typeof TODO_SORTS];

export interface TodoQuery {
  status: TodoStatus;
  /** Case-insensitive search in the title; empty means no search. */
  q: string;
  sort: TodoSort;
  /** Zero-based, like the API; the URL shows it one-based. */
  page: number;
}

export const DEFAULT_TODO_QUERY: TodoQuery = {
  status: TODO_STATUSES.all,
  q: '',
  sort: TODO_SORTS.newest,
  page: 0,
};

/** Raw query params as the router binds them: strings, or `undefined` when missing. */
export interface TodoQueryParams {
  status?: string;
  q?: string;
  sort?: string;
  page?: string;
}

function isOneOf<T extends string>(
  values: Record<string, T>,
  value: string | undefined
): value is T {
  return Object.values<string>(values).includes(value ?? '');
}

/**
 * One-based `?page=` → zero-based page index. Anything that is not a positive whole number
 * (hand-edited URL) means the first page.
 */
export function parsePageParam(page: string | undefined): number {
  const parsed = Number(page);
  return Number.isInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}

/** Zero-based page index → `?page=` value; the first page is left out of the URL. */
export function pageParam(page: number): string | null {
  return page > 0 ? String(page + 1) : null;
}

/** URL query params → query. Unknown or missing values fall back to the defaults. */
export function parseTodoQuery(params: TodoQueryParams): TodoQuery {
  return {
    status: isOneOf(TODO_STATUSES, params.status)
      ? params.status
      : DEFAULT_TODO_QUERY.status,
    q: params.q?.trim() ?? DEFAULT_TODO_QUERY.q,
    sort: isOneOf(TODO_SORTS, params.sort)
      ? params.sort
      : DEFAULT_TODO_QUERY.sort,
    page: parsePageParam(params.page),
  };
}

/**
 * Query → URL query params for `router.navigate`. Default values become `null`, which removes
 * them from the URL, so `/todos` stays the plain, shareable URL of the default list.
 */
export function todoQueryParams(
  query: TodoQuery
): Record<keyof TodoQueryParams, string | null> {
  return {
    status: query.status === DEFAULT_TODO_QUERY.status ? null : query.status,
    q: query.q || null,
    sort: query.sort === DEFAULT_TODO_QUERY.sort ? null : query.sort,
    page: pageParam(query.page),
  };
}
