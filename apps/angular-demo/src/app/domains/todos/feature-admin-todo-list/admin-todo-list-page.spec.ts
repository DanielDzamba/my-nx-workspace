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
import { AdminTodo, Page } from '../data';
import { AdminTodoListPage } from './admin-todo-list-page';

const milk: AdminTodo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
  ownerId: 'auth0|alice',
};

function page(
  content: AdminTodo[],
  totalElements = content.length,
  number = 0
): Page<AdminTodo> {
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

describe('AdminTodoListPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: ROUTE_PATHS.adminTodos, component: AdminTodoListPage }],
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
    return http.expectOne((req) => req.url === '/api/admin/todos');
  }

  async function open(
    respond: (req: TestRequest) => void,
    url: string = ROUTE_URLS.adminTodos
  ): Promise<void> {
    await harness.navigateByUrl(url, AdminTodoListPage);
    respond(expectPageRequest());
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function rows(): string[][] {
    return Array.from(element().querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map(
        (cell) => cell.textContent?.trim() ?? ''
      )
    );
  }

  it('lists the todos of all users with their owners', async () => {
    await open((req) =>
      req.flush(
        page([
          milk,
          { ...milk, id: 2, title: 'Old', completed: true, ownerId: 'legacy' },
        ])
      )
    );

    expect(rows().map(([title, owner, done]) => [title, owner, done])).toEqual([
      ['Buy milk', 'auth0|alice', 'nie'],
      ['Old', 'legacy', 'áno'],
    ]);
    expect(element().textContent).toContain('Spolu: 2 úloh');
  });

  it('takes the page from the URL and pages through it', async () => {
    await open((req) => {
      expect(req.request.params.get('page')).toBe('1');
      req.flush(page([milk], 45, 1));
    }, `${ROUTE_URLS.adminTodos}?page=2`);
    expect(element().textContent).toContain('Strana 2 z 3');

    (
      Array.from(element().querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Ďalšia')
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe(`${ROUTE_URLS.adminTodos}?page=3`);
    expect(expectPageRequest().request.params.get('page')).toBe('2');
  });

  it('shows an empty state', async () => {
    await open((req) => req.flush(page([])));

    expect(rows()).toEqual([['Zatiaľ žiadne úlohy.']]);
    expect(element().textContent).not.toContain('Spolu');
  });

  it('shows an error when the request is forbidden', async () => {
    await open((req) =>
      req.flush('forbidden', { status: 403, statusText: 'Forbidden' })
    );

    expect(element().querySelector('[role=alert]')?.textContent).toContain(
      'Nepodarilo sa načítať úlohy všetkých používateľov.'
    );
    expect(element().querySelector('table')).toBeNull();
  });
});
