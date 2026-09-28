import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthClient, AuthUser, ROLES } from './auth-client';
import { roleGuard } from './role-guard';

describe('roleGuard', () => {
  const user = signal<AuthUser | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthClient,
          useValue: {
            isAuthenticated: signal(true),
            user,
            login: vi.fn(),
            logout: vi.fn(),
          },
        },
      ],
    });
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      roleGuard(ROLES.admin)(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );
  }

  function redirectUrl(): string {
    return TestBed.inject(Router).serializeUrl(runGuard() as UrlTree);
  }

  it('lets users with the role through', () => {
    user.set({ name: 'Admin', roles: [ROLES.admin] });
    expect(runGuard()).toBe(true);
  });

  it('sends users without the role to the home page', () => {
    user.set({ name: 'Jana', roles: [] });
    expect(redirectUrl()).toBe('/');
  });

  it('sends anonymous users to the home page', () => {
    user.set(null);
    expect(redirectUrl()).toBe('/');
  });
});
