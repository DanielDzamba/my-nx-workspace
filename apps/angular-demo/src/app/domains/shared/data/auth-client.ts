import { Signal } from '@angular/core';

/**
 * Roles assigned in Auth0; the values must match the role names there. Every signed-in user is
 * a regular user, roles grant extra rights. Never hard-code a role name elsewhere.
 */
export const ROLES = {
  admin: 'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export interface AuthUser {
  name: string;
  roles: readonly Role[];
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
