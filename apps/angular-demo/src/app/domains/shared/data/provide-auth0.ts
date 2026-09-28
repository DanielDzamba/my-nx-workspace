import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import {
  LogLevel,
  OidcSecurityService,
  provideAuth,
} from 'angular-auth-oidc-client';
import { catchError, of } from 'rxjs';
import { ROUTE_URLS } from '../util';
import { AuthClient } from './auth-client';
import { OidcAuthClient } from './oidc-auth-client';

/** Auth0 values from the environment files. None of them is a secret. */
export interface Auth0Config {
  /** Tenant domain, e.g. `todo-app-todos.eu.auth0.com`. */
  domain: string;
  /** Client ID of the Single Page Application in Auth0. */
  clientId: string;
  /** Identifier of the API in Auth0; access tokens are issued for it. */
  audience: string;
  /** Origin of the API (`API_BASE_URL`); only requests to it get the access token. */
  apiUrl: string;
}

// offline_access: Auth0 issues a refresh token, so the 1 h access token is renewed silently
const SCOPE = 'openid profile email offline_access';

/**
 * Login with Auth0 via Authorization Code + PKCE (angular-auth-oidc-client).
 * Add `authInterceptor()` from angular-auth-oidc-client to provideHttpClient as well.
 */
export function provideAuth0(config: Auth0Config): EnvironmentProviders {
  // Base URL of the app including the base href (GitHub Pages serves it under /my-nx-workspace/);
  // must match the Allowed Callback / Logout URLs in Auth0 exactly
  const appUrl = document.baseURI;

  return makeEnvironmentProviders([
    provideAuth({
      config: {
        authority: `https://${config.domain}`,
        clientId: config.clientId,
        redirectUrl: appUrl,
        postLogoutRedirectUri: appUrl,
        responseType: 'code',
        scope: SCOPE,
        customParamsAuthRequest: { audience: config.audience },
        customParamsRefreshTokenRequest: { scope: SCOPE },
        useRefreshToken: true,
        silentRenew: true,
        renewTimeBeforeTokenExpiresInSeconds: 60,
        // Auth0 does not repeat the nonce in ID tokens issued by a refresh
        ignoreNonceAfterRefresh: true,
        // Name and e-mail come from the ID token; no extra /userinfo request
        autoUserInfo: false,
        // Trailing slash: `/api` alone would also match e.g. `/api-docs`
        secureRoutes: [`${config.apiUrl}/api/`],
        postLoginRoute: ROUTE_URLS.todos,
        unauthorizedRoute: ROUTE_URLS.home,
        logLevel: LogLevel.Warn,
      },
    }),
    // Processes the `?code=` callback and restores the session from storage before the first
    // route (and its guard) is activated. A failed callback (e.g. the user cancelled the login)
    // must not stop the app from starting: the user just stays logged out.
    provideAppInitializer(() =>
      inject(OidcSecurityService)
        .checkAuth()
        .pipe(catchError(() => of(null)))
    ),
    { provide: AuthClient, useClass: OidcAuthClient },
  ]);
}
