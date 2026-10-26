import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTE_URLS } from '../util';
import {
  USER_BLOCKED_PROBLEM_TYPE,
  blockedUserInterceptor,
} from './blocked-user-interceptor';

describe('blockedUserInterceptor', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([blockedUserInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  /** Sends a request, answers it with `status` and `body`, and returns the error it ended with. */
  async function failWith(
    status: number,
    body: object | null
  ): Promise<unknown> {
    const response = firstValueFrom(
      TestBed.inject(HttpClient).get('/api/todos')
    );
    http
      .expectOne('/api/todos')
      .flush(body, { status, statusText: String(status) });
    return response.then(
      () => null,
      (error: unknown) => error
    );
  }

  it('sends a blocked user to the account blocked page and still fails the request', async () => {
    const error = await failWith(403, {
      type: USER_BLOCKED_PROBLEM_TYPE,
      status: 403,
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith(
      ROUTE_URLS.accountBlocked
    );
    expect(error).toBeTruthy();
  });

  it('leaves other 403s (missing role) and other errors alone', async () => {
    await failWith(403, null);
    await failWith(403, { type: 'about:blank' });
    await failWith(500, { type: USER_BLOCKED_PROBLEM_TYPE });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
