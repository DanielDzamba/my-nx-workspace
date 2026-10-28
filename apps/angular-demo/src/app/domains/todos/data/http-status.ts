import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';

/**
 * HTTP status of a failed request, or `undefined` for other errors. A mutation hands out the
 * `HttpErrorResponse` itself; a resource wraps non-`Error` failures, with the original as `cause`.
 */
export function httpStatus(error: unknown): number | undefined {
  const cause =
    error instanceof HttpErrorResponse
      ? error
      : (error as { cause?: unknown } | undefined)?.cause;
  return cause instanceof HttpErrorResponse ? cause.status : undefined;
}

/**
 * 409 on update: the todo was changed elsewhere (another tab or device) since the version the
 * change was based on was loaded (optimistic locking). Nothing was saved.
 */
export function isConflict(error: unknown): boolean {
  return httpStatus(error) === HttpStatusCode.Conflict;
}
