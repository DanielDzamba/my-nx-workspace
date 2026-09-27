import { computed, inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { AuthClient } from './auth-client';

/**
 * App-wide login state. Components and guards use this store only, never the OIDC library,
 * so the library stays replaceable and tests can provide a fake AuthClient.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withDevtools('auth'),
  withProps(() => ({
    _client: inject(AuthClient),
  })),
  withComputed(({ _client }) => ({
    isAuthenticated: computed(() => _client.isAuthenticated()),
    user: computed(() => _client.user()),
  })),
  withMethods(({ _client }) => ({
    login(): void {
      _client.login();
    },
    logout(): void {
      _client.logout();
    },
  }))
);
