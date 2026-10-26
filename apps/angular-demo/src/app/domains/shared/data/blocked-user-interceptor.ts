import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ROUTE_URLS } from '../util';

/**
 * Problem type of the 403 the API answers on every request of a blocked user
 * (`api-contract/openapi.yaml`). A 403 without it is a missing role, not a blocked account.
 */
export const USER_BLOCKED_PROBLEM_TYPE =
  'https://todo-api/problems/user-blocked';

function isUserBlocked(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
    return false;
  }
  const body: unknown = error.error;
  return (
    typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    body.type === USER_BLOCKED_PROBLEM_TYPE
  );
}

/**
 * Sends a blocked user to the "account blocked" page, whichever request found out. The error
 * still reaches the caller, so stores end up in their error state as for any failed request.
 */
export const blockedUserInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (isUserBlocked(error)) {
        router.navigateByUrl(ROUTE_URLS.accountBlocked);
      }
      return throwError(() => error);
    })
  );
};
