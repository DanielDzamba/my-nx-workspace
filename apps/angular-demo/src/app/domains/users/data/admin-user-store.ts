import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  rxMutation,
  withDevtools,
  withMutations,
  withResource,
} from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { UserClient } from './user-client';

/**
 * Paged list of all users for admins (`GET /api/admin/users`), with blocking and unblocking.
 * The page index comes from the URL via `connectPage`; after a change the page is reloaded.
 */
export const AdminUserStore = signalStore(
  withDevtools('admin-users'),
  // null until connectPage: loading page 0 first would be a wasted request on `?page=3`
  withState<{ page: number | null }>({ page: null }),
  withProps(() => ({
    _client: inject(UserClient),
  })),
  withResource((store) => ({
    userPage: rxResource({
      // undefined keeps the resource idle
      params: () => store.page() ?? undefined,
      stream: ({ params: page }) => store._client.getPage(page),
    }),
  })),
  withComputed(({ userPageValue }) => ({
    users: computed(() => userPageValue()?.content ?? []),
    totalElements: computed(() => userPageValue()?.page.totalElements ?? 0),
    totalPages: computed(() => userPageValue()?.page.totalPages ?? 0),
  })),
  withMethods((store) => ({
    connectPage: signalMethod<number>((page) => patchState(store, { page })),
    _reload: () => store._userPageReload(),
  })),
  withMutations((store) => ({
    setBlocked: rxMutation({
      operation: ({ id, blocked }: { id: string; blocked: boolean }) =>
        store._client.setBlocked(id, blocked),
      onSuccess: () => store._reload(),
    }),
  }))
);
