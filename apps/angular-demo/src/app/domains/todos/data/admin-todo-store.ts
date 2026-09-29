import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { TodoClient } from './todo-client';

/**
 * Read-only, paged overview of all users' todos for admins (`GET /api/admin/todos`).
 * The page index comes from the URL via `connectPage`.
 */
export const AdminTodoStore = signalStore(
  withDevtools('admin-todos'),
  // null until connectPage: loading page 0 first would be a wasted request on `?page=3`
  withState<{ page: number | null }>({ page: null }),
  withProps(() => ({
    _client: inject(TodoClient),
  })),
  withResource((store) => ({
    todoPage: rxResource({
      // undefined keeps the resource idle
      params: () => store.page() ?? undefined,
      stream: ({ params: page }) => store._client.getAllOwners(page),
    }),
  })),
  withComputed(({ todoPageValue }) => ({
    todos: computed(() => todoPageValue()?.content ?? []),
    totalElements: computed(() => todoPageValue()?.page.totalElements ?? 0),
    totalPages: computed(() => todoPageValue()?.page.totalPages ?? 0),
  })),
  withMethods((store) => ({
    connectPage: signalMethod<number>((page) => patchState(store, { page })),
  }))
);
