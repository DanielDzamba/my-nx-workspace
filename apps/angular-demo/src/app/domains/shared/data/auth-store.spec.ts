import { Injectable, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthClient, AuthUser, ROLES, Role } from './auth-client';
import { AuthStore } from './auth-store';

@Injectable({ providedIn: 'root' })
class FakeAuthClient extends AuthClient {
  readonly authenticated = signal(false);
  readonly roles = signal<Role[]>([ROLES.admin]);
  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly user = computed((): AuthUser | null =>
    this.authenticated() ? { name: 'Jana', roles: this.roles() } : null
  );
  login = vi.fn();
  logout = vi.fn();
}

describe('AuthStore', () => {
  let client: FakeAuthClient;
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthClient, useClass: FakeAuthClient }],
    });
    client = TestBed.inject(AuthClient) as FakeAuthClient;
    store = TestBed.inject(AuthStore);
  });

  it('follows the login state of the client', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();

    client.authenticated.set(true);

    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual({ name: 'Jana', roles: [ROLES.admin] });
  });

  it('checks the roles of the signed-in user', () => {
    expect(store.hasRole(ROLES.admin)).toBe(false);

    client.authenticated.set(true);
    expect(store.hasRole(ROLES.admin)).toBe(true);

    client.roles.set([]);
    expect(store.hasRole(ROLES.admin)).toBe(false);
  });

  it('delegates login and logout to the client', () => {
    store.login();
    expect(client.login).toHaveBeenCalledOnce();

    store.logout();
    expect(client.logout).toHaveBeenCalledOnce();
  });
});
