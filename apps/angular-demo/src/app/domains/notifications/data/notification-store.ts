import { InjectionToken, computed, inject } from '@angular/core';
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
import { EMPTY, catchError, exhaustMap, takeWhile, timer } from 'rxjs';
import { NotificationClient } from './notification-client';
import { NOTIFICATION_TYPES } from './notification';

/** How often the store asks the server for new notifications, in milliseconds. */
export const NOTIFICATION_POLL_INTERVAL = new InjectionToken<number>(
  'NOTIFICATION_POLL_INTERVAL',
  { providedIn: 'root', factory: () => 15_000 }
);

const KNOWN_TYPES: readonly string[] = Object.values(NOTIFICATION_TYPES);

/**
 * The signed-in user's notifications, polled from the server. Notifications are created
 * asynchronously on the backend (event → RabbitMQ → consumer), so the server cannot answer the
 * request that caused one with it; the client asks again periodically instead. (Pushing them over
 * WebSocket or Server-Sent Events would be the next step.)
 *
 * Polling runs only while `connectEnabled` is true (signed in). A failed poll keeps the last list
 * and the next one tries again.
 */
export const NotificationStore = signalStore(
  withDevtools('notifications'),
  withState<{ enabled: boolean }>({ enabled: false }),
  withProps(() => ({
    _client: inject(NotificationClient),
    _pollInterval: inject(NOTIFICATION_POLL_INTERVAL),
  })),
  withResource((store) => ({
    notificationList: rxResource({
      // undefined keeps the resource idle (and clears it after logout)
      params: () => (store.enabled() ? true : undefined),
      stream: () =>
        timer(0, store._pollInterval).pipe(
          // Angular 20.1 only marks the resource idle when params become undefined; it does not
          // cancel the running stream. Without this, polling would go on after logout.
          takeWhile(() => store.enabled()),
          // A slow response is not overtaken by the next poll
          exhaustMap(() => store._client.list().pipe(catchError(() => EMPTY)))
        ),
    }),
  })),
  withComputed(({ notificationListValue }) => ({
    notifications: computed(() =>
      (notificationListValue()?.items ?? []).filter((n) =>
        KNOWN_TYPES.includes(n.type)
      )
    ),
    unreadCount: computed(() => notificationListValue()?.unreadCount ?? 0),
  })),
  withMethods((store) => ({
    /** Polls while the signal is true, e.g. `AuthStore.isAuthenticated`. */
    connectEnabled: signalMethod<boolean>((enabled) =>
      patchState(store, { enabled })
    ),
    /** Loads now (and restarts the polling interval). */
    reload: () => store._notificationListReload(),
  })),
  withMutations((store) => ({
    markAllRead: rxMutation<void, void>({
      operation: () => store._client.markAllRead(),
      onSuccess: () => store.reload(),
    }),
  }))
);
