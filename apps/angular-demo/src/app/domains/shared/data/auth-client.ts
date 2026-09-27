import { Signal } from '@angular/core';

export interface AuthUser {
  name: string;
}

/**
 * Login state and actions, independent of the OIDC library behind them.
 * The app binds it to OidcAuthClient via provideAuth0(); tests and the e2e build
 * provide their own implementation.
 */
export abstract class AuthClient {
  abstract readonly isAuthenticated: Signal<boolean>;
  abstract readonly user: Signal<AuthUser | null>;
  /** Redirects to the Auth0 login page. */
  abstract login(): void;
  /** Ends the local session and the Auth0 session, then returns to the app. */
  abstract logout(): void;
}
