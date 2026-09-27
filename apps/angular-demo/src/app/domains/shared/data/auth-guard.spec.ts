import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthClient } from './auth-client';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  const authenticated = signal(false);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthClient,
          useValue: {
            isAuthenticated: authenticated,
            user: signal(null),
            login: vi.fn(),
            logout: vi.fn(),
          },
        },
      ],
    });
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('lets signed-in users through', () => {
    authenticated.set(true);
    expect(runGuard()).toBe(true);
  });

  it('sends anonymous users to the home page', () => {
    authenticated.set(false);
    const result = runGuard() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/');
  });
});
