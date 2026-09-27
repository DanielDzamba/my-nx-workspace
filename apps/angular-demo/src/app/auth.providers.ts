import { EnvironmentProviders } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { authInterceptor } from 'angular-auth-oidc-client';
import { environment } from '../environments/environment';
import { provideAuth0 } from './domains/shared/data';

// The e2e build replaces this file with auth.providers.e2e.ts (project.json), so the
// Playwright tests run without Auth0.

export const authProviders: EnvironmentProviders[] = [
  provideAuth0({ ...environment.auth0, apiUrl: environment.apiUrl }),
];

/** Adds `Authorization: Bearer <access token>` to requests matching `secureRoutes`. */
export const authInterceptors: HttpInterceptorFn[] = [authInterceptor()];
