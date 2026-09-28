import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ROUTE_URLS } from '../util';
import { AuthStore } from './auth-store';

/** Lets signed-in users through; everyone else lands on the public home page. */
export const authGuard: CanActivateFn = () =>
  inject(AuthStore).isAuthenticated() ||
  inject(Router).createUrlTree([ROUTE_URLS.home]);
