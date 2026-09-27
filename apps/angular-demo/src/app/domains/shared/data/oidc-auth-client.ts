import { Injectable, computed, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { catchError, of, switchMap } from 'rxjs';
import { AuthClient, AuthUser } from './auth-client';

/**
 * Standard OIDC claims of the Auth0 ID token that the app reads (scopes `profile` and `email`).
 * All optional: which ones are present depends on the connection (database, Google).
 */
interface IdTokenClaims {
  name?: string;
  nickname?: string;
  email?: string;
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
