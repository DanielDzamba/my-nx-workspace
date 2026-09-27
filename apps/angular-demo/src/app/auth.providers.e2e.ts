import { Injectable, Provider, computed, inject, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthClient } from './domains/shared/data';

/**
 * Replaces auth.providers.ts in the e2e build: login and logout only flip a signal and
 * navigate like the real flow does after returning from Auth0.
 */
@Injectable({ providedIn: 'root' })
class FakeAuthClient extends AuthClient {
  private readonly router = inject(Router);
  private readonly authenticated = signal(false);

  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly user = computed(() =>
    this.authenticated() ? { name: 'E2E používateľ' } : null
  );

  login(): void {
    this.authenticated.set(true);
    void this.router.navigateByUrl('/todos');
  }

  logout(): void {
    this.authenticated.set(false);
    void this.router.navigateByUrl('/');
  }
}

export const authProviders: Provider[] = [
  { provide: AuthClient, useClass: FakeAuthClient },
];

export const authInterceptors: HttpInterceptorFn[] = [];
