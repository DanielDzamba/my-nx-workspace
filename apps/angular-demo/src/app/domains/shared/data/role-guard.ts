import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ROUTE_URLS } from '../util';
import { Role } from './auth-client';
import { AuthStore } from './auth-store';

/**
 * Lets only signed-in users with `role` through; everyone else lands on the home page.
 * This only hides UI: the backend checks the role on every request (403 otherwise).
 */
export function roleGuard(role: Role): CanActivateFn {
  return () =>
    inject(AuthStore).hasRole(role) ||
    inject(Router).createUrlTree([ROUTE_URLS.home]);
}
