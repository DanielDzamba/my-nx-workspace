import { Injectable, computed, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { catchError, of, switchMap } from 'rxjs';
import { AuthClient, AuthUser } from './auth-client';

/** AuthClient backed by angular-auth-oidc-client (Authorization Code + PKCE). */
@Injectable({ providedIn: 'root' })
export class OidcAuthClient extends AuthClient {
  private readonly oidc = inject(OidcSecurityService);

  readonly isAuthenticated = computed(
    () => this.oidc.authenticated().isAuthenticated
  );

  // Claims of the ID token (`autoUserInfo` is off, so no /userinfo call)
  readonly user = computed(() =>
    this.isAuthenticated() ? toUser(this.oidc.userData().userData) : null
  );

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

function toUser(claims: unknown): AuthUser {
  const record = (claims ?? {}) as Record<string, unknown>;
  const name = [record['name'], record['nickname'], record['email']].find(
    (value): value is string => typeof value === 'string' && value !== ''
  );
  return { name: name ?? 'používateľ' };
}
