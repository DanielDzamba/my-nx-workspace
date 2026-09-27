import { Injectable, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthClient } from './auth-client';
import { AuthStore } from './auth-store';

@Injectable({ providedIn: 'root' })
class FakeAuthClient extends AuthClient {
  readonly authenticated = signal(false);
  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly user = computed(() =>
    this.authenticated() ? { name: 'Jana' } : null
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
    expect(store.user()).toEqual({ name: 'Jana' });
  });

  it('delegates login and logout to the client', () => {
    store.login();
    expect(client.login).toHaveBeenCalledOnce();

    store.logout();
    expect(client.logout).toHaveBeenCalledOnce();
  });
});
