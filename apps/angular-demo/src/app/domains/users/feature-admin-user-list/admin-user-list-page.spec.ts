import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ROUTE_PATHS, ROUTE_URLS } from '../../shared/util';
import { User, UserPage } from '../data';
import { AdminUserListPage } from './admin-user-list-page';

const alice: User = {
  id: 'auth0|alice',
  name: 'Alice',
  email: 'alice@example.com',
  blocked: false,
  createdAt: '2026-10-24T12:00:00Z',
};

/** Name and email not known yet (signed in before the Auth0 Action sent them). */
const bob: User = {
  id: 'auth0|bob',
  blocked: true,
  createdAt: '2026-10-23T12:00:00Z',
};

const ALICE_BLOCKED = '/api/admin/users/auth0%7Calice/blocked';

function page(
  content: User[],
  totalElements = content.length,
  number = 0
): UserPage {
  return {
    content,
    page: {
      size: 20,
      number,
      totalElements,
      totalPages: Math.ceil(totalElements / 20),
    },
  };
}

describe('AdminUserListPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: ROUTE_PATHS.adminUsers, component: AdminUserListPage }],
          withComponentInputBinding()
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  function element(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function expectPageRequest(): TestRequest {
    return http.expectOne((req) => req.url === '/api/admin/users');
  }

  async function stable(): Promise<void> {
    // Mutations are not pending tasks: wait a macrotask, then render
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function open(
    respond: (req: TestRequest) => void,
    url: string = ROUTE_URLS.adminUsers
  ): Promise<void> {
    await harness.navigateByUrl(url, AdminUserListPage);
    respond(expectPageRequest());
    await stable();
  }

  function rows(): string[][] {
    return Array.from(element().querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map(
        (cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      )
    );
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label)
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  function alert(): string | undefined {
    return element().querySelector('[role=alert]')?.textContent?.trim();
  }

  it('lists the users with their state', async () => {
    await open((req) => req.flush(page([alice, bob])));

    expect(
      rows().map(([who, email, , state, action]) => [who, email, state, action])
    ).toEqual([
      ['Alice auth0|alice', 'alice@example.com', 'aktívny', 'Zablokovať'],
      ['— auth0|bob', '—', 'zablokovaný', 'Odblokovať'],
    ]);
    expect(element().textContent).toContain('Spolu: 2 používateľov');
  });

  it('blocks a user and shows the reloaded page', async () => {
    await open((req) => req.flush(page([alice])));

    button('Zablokovať').click();
    const change = http.expectOne(ALICE_BLOCKED);
    expect(change.request.body).toEqual({ blocked: true });
    change.flush({ ...alice, blocked: true });
    await stable();
    expectPageRequest().flush(page([{ ...alice, blocked: true }]));
    await stable();

    expect(rows()[0][3]).toBe('zablokovaný');
    expect(button('Odblokovať')).toBeTruthy();
    expect(alert()).toBeUndefined();
  });

  it('explains that admins cannot block themselves', async () => {
    await open((req) => req.flush(page([alice])));

    button('Zablokovať').click();
    http
      .expectOne(ALICE_BLOCKED)
      .flush(null, { status: 409, statusText: 'Conflict' });
    await stable();

    expect(alert()).toBe('Seba zablokovať nemôžeš.');
  });

  it('shows a generic message when a change fails', async () => {
    await open((req) => req.flush(page([alice])));

    button('Zablokovať').click();
    http
      .expectOne(ALICE_BLOCKED)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await stable();

    expect(alert()).toBe('Zmenu sa nepodarilo uložiť.');
  });

  it('takes the page from the URL and pages through it', async () => {
    await open((req) => {
      expect(req.request.params.get('page')).toBe('1');
      req.flush(page([alice], 45, 1));
    }, `${ROUTE_URLS.adminUsers}?page=2`);

    button('Ďalšia').click();
    await stable();

    expect(TestBed.inject(Router).url).toBe(`${ROUTE_URLS.adminUsers}?page=3`);
    expect(expectPageRequest().request.params.get('page')).toBe('2');
  });

  it('shows an empty state', async () => {
    await open((req) => req.flush(page([])));

    expect(rows()).toEqual([['Zatiaľ žiadni používatelia.']]);
    expect(element().textContent).not.toContain('Spolu');
  });

  it('shows an error when the list cannot be loaded', async () => {
    await open((req) =>
      req.flush('forbidden', { status: 403, statusText: 'Forbidden' })
    );

    expect(alert()).toBe('Nepodarilo sa načítať používateľov.');
    expect(element().querySelector('table')).toBeNull();
  });
});
