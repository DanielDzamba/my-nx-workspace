import { Injectable, computed, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { catchError, of, switchMap } from 'rxjs';
import { AuthClient, AuthUser, ROLES, Role } from './auth-client';

/**
 * Custom claim with the user's Auth0 roles, added by a Post-Login Action (Auth0 requires a URL
 * namespace). The backend reads the same claim from the access token.
 */
export const ROLES_CLAIM = 'https://todo-api/roles';

const KNOWN_ROLES: readonly Role[] = Object.values(ROLES);

/**
 * Claims of the Auth0 ID token that the app reads: standard OIDC ones (scopes `profile` and
 * `email`) and the roles. All optional: which ones are present depends on the connection
 * (database, Google) and on the user's roles.
 */
interface IdTokenClaims {
  name?: string;
  nickname?: string;
  email?: string;
  [ROLES_CLAIM]?: unknown;
}

/** Keeps the roles the app knows; anything else in the claim is ignored. */
function readRoles(claim: unknown): Role[] {
  return Array.isArray(claim)
    ? KNOWN_ROLES.filter((role) => claim.includes(role))
    : [];
}

/** AuthClient backed by angular-auth-oidc-client (Authorization Code + PKCE). */
@Injectable({ providedIn: 'root' })
export class OidcAuthClient extends AuthClient {
  private readonly oidc = inject(OidcSecurityService);

  readonly isAuthenticated = computed(
    () => this.oidc.authenticated().isAuthenticated
  );

  readonly user = computed((): AuthUser | null => {
    if (!this.isAuthenticated()) {
      return null;
    }
    // Claims of the validated ID token (`autoUserInfo` is off, so no /userinfo call).
    // The library types them as `any`; the interface names what we rely on.
    const claims: IdTokenClaims | null = this.oidc.userData().userData;
    // `||`, not `??`: an empty string falls through to the next claim as well
    return {
      name: claims?.name || claims?.nickname || claims?.email || 'používateľ',
      roles: readRoles(claims?.[ROLES_CLAIM]),
    };
  });

  login(): void {
    this.oidc.authorize();
  }

  logout(): void {
    // Auth0 revokes refresh tokens only (access tokens simply expire), so logoffAndRevokeTokens()
    // would fail on the access token. A failed revocation must not keep the user logged in.
    this.oidc
      .revokeRefreshToken()
      .pipe(
        catchError(() => of(null)),
        // Clears the session storage and redirects to Auth0's logout, then back to the app
        switchMap(() => this.oidc.logoff())
      )
      .subscribe();
  }
}
