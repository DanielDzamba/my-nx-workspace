import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AuthenticatedResult,
  OidcSecurityService,
  UserDataResult,
} from 'angular-auth-oidc-client';
import { Observable, of, throwError } from 'rxjs';
import { ROLES } from './auth-client';
import { OidcAuthClient, ROLES_CLAIM } from './oidc-auth-client';

describe('OidcAuthClient', () => {
  const authenticated = signal<AuthenticatedResult>({
    isAuthenticated: false,
    allConfigsAuthenticated: [],
  });
  const userData = signal<UserDataResult>({ userData: null, allUserData: [] });
  const oidc = {
    authenticated,
    userData,
    authorize: vi.fn(),
    revokeRefreshToken: vi.fn<() => Observable<unknown>>(),
    logoff: vi.fn<() => Observable<unknown>>(),
  };
  let client: OidcAuthClient;

  beforeEach(() => {
    authenticated.set({ isAuthenticated: false, allConfigsAuthenticated: [] });
    oidc.authorize.mockReset();
    oidc.revokeRefreshToken.mockReset().mockReturnValue(of(null));
    oidc.logoff.mockReset().mockReturnValue(of(null));
    TestBed.configureTestingModule({
      providers: [
        OidcAuthClient,
        { provide: OidcSecurityService, useValue: oidc },
      ],
    });
    client = TestBed.inject(OidcAuthClient);
  });

  function signIn(claims: unknown) {
    authenticated.set({ isAuthenticated: true, allConfigsAuthenticated: [] });
    userData.set({ userData: claims, allUserData: [] });
  }

  it('has no user while logged out', () => {
    expect(client.isAuthenticated()).toBe(false);
    expect(client.user()).toBeNull();
  });

  it('takes the name from the ID token claims', () => {
    signIn({ name: 'Jana Nováková', email: 'jana@example.com' });
    expect(client.isAuthenticated()).toBe(true);
    expect(client.user()).toEqual({ name: 'Jana Nováková', roles: [] });
  });

  it('falls back to nickname, e-mail and a generic name', () => {
    signIn({ name: '', nickname: 'jana' });
    expect(client.user()).toEqual({ name: 'jana', roles: [] });

    signIn({ email: 'jana@example.com' });
    expect(client.user()).toEqual({ name: 'jana@example.com', roles: [] });

    signIn(null);
    expect(client.user()).toEqual({ name: 'používateľ', roles: [] });
  });

  it('reads the known roles from the roles claim', () => {
    signIn({ name: 'Jana', [ROLES_CLAIM]: [ROLES.admin, 'EDITOR'] });
    expect(client.user()?.roles).toEqual([ROLES.admin]);

    signIn({ name: 'Jana', [ROLES_CLAIM]: ROLES.admin });
    expect(client.user()?.roles).toEqual([]);
  });

  it('starts the login redirect', () => {
    client.login();
    expect(oidc.authorize).toHaveBeenCalledOnce();
  });

  it('revokes the refresh token, then logs off', () => {
    client.logout();
    expect(oidc.revokeRefreshToken).toHaveBeenCalledOnce();
    expect(oidc.logoff).toHaveBeenCalledOnce();
  });

  it('logs off even when the revocation fails', () => {
    oidc.revokeRefreshToken.mockReturnValue(
      throwError(() => new Error('revoke failed'))
    );
    client.logout();
    expect(oidc.logoff).toHaveBeenCalledOnce();
  });
});
