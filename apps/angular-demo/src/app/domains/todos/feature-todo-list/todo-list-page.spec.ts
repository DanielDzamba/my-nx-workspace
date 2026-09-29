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
import { Page, TodoSummary } from '../data';
import { TODO_STATUSES } from '../util';
import { TodoListPage } from './todo-list-page';

const milk: TodoSummary = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
  subtaskCount: 0,
  completedSubtaskCount: 0,
};

function page(
  content: TodoSummary[],
  totalElements = content.length,
  number = 0
): Page<TodoSummary> {
  return {
    content,
    page: {
      size: 10,
      number,
      totalElements,
      totalPages: Math.ceil(totalElements / 10),
    },
  };
}

describe('TodoListPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        // Like the app: query params become inputs of the routed page
        provideRouter(
          [{ path: ROUTE_PATHS.todos, component: TodoListPage }],
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

  function currentUrl(): string {
    return TestBed.inject(Router).url;
  }

  function expectPageRequest(): TestRequest {
    return http.expectOne(
      (req) => req.method === 'GET' && req.url === '/api/todos'
    );
  }

  /**
   * Mutations are not Angular pending tasks, so whenStable() alone does not wait for them:
   * let the mutation promise and the page's handler run, then re-render (ngModel writes async).
   */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  async function open(url: string, content: Page<TodoSummary>) {
    await harness.navigateByUrl(url, TodoListPage);
    expectPageRequest().flush(content);
    await settle();
  }

  function titles(): string[] {
    return Array.from(element().querySelectorAll('.title')).map(
      (el) => el.textContent?.trim() ?? ''
    );
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  /**
   * Answers the reload that follows every successful mutation. No whenStable() before it: a
   * running resource request is a pending task, so the app is not stable until it is answered.
   */
  async function flushReload(content: Page<TodoSummary>) {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    expectPageRequest().flush(content);
    await settle();
  }

  it('loads and renders the first page', async () => {
    await open(ROUTE_URLS.todos, page([milk], 1));

    expect(titles()).toEqual(['Buy milk']);
    expect(element().textContent).toContain('Počet úloh: 1');
    expect(element().querySelector('app-pager nav')).toBeNull();
  });

  it('takes filter and page from the URL', async () => {
    await harness.navigateByUrl(
      `${ROUTE_URLS.todos}?status=${TODO_STATUSES.active}&q=milk&page=2`,
      TodoListPage
    );

    const req = expectPageRequest();
    expect(req.request.params.get('status')).toBe(TODO_STATUSES.active);
    expect(req.request.params.get('q')).toBe('milk');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([milk], 11, 1));
    await settle();

    expect(element().textContent).toContain('Strana 2 z 2');
    expect(
      (element().querySelector('input[type=search]') as HTMLInputElement).value
    ).toBe('milk');
  });

  it('writes filter changes into the URL and loads the matching page', async () => {
    await open(`${ROUTE_URLS.todos}?page=2`, page([milk], 11, 1));

    button('Hotové').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    // The status is in the URL, the page is back to the first one (left out)
    expect(currentUrl()).toBe(
      `${ROUTE_URLS.todos}?status=${TODO_STATUSES.completed}`
    );
    const req = expectPageRequest();
    expect(req.request.params.get('status')).toBe(TODO_STATUSES.completed);
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([]));
    await settle();

    expect(element().textContent).toContain('Žiadna úloha nezodpovedá filtru.');
  });

  it('pages through the URL', async () => {
    await open(ROUTE_URLS.todos, page([milk], 25));

    button('Ďalšia ›').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(currentUrl()).toBe(`${ROUTE_URLS.todos}?page=2`);
    expect(expectPageRequest().request.params.get('page')).toBe('1');
  });

  it('keeps the filter in the links to the detail', async () => {
    await open(`${ROUTE_URLS.todos}?q=milk`, page([milk]));

    expect(element().querySelector('a.title')?.getAttribute('href')).toBe(
      `${ROUTE_URLS.todoDetail(milk.id)}?q=milk`
    );
  });

  it('shows an error when loading fails', async () => {
    await harness.navigateByUrl(ROUTE_URLS.todos, TodoListPage);
    expectPageRequest().flush('boom', {
      status: 500,
      statusText: 'Server Error',
    });
    await settle();

    expect(element().querySelector('[role=alert]')?.textContent).toContain(
      'Nepodarilo sa načítať úlohy'
    );
  });

  it('adds a todo, clears the input and reloads the page', async () => {
    await open(ROUTE_URLS.todos, page([milk]));
    const input = element().querySelector(
      'app-todo-add-form input'
    ) as HTMLInputElement;
    input.value = '  Read  ';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    button('Pridať').click();

    const req = http.expectOne({ method: 'POST', url: '/api/todos' });
    expect(req.request.body).toEqual({ title: 'Read' });
    req.flush({ ...milk, id: 2, title: 'Read' });
    await flushReload(page([{ ...milk, id: 2, title: 'Read' }, milk]));

    expect(titles()).toEqual(['Read', 'Buy milk']);
    expect(input.value).toBe('');
  });

  it('toggles completion', async () => {
    await open(ROUTE_URLS.todos, page([milk]));
    (
      element().querySelector('input[type=checkbox]') as HTMLInputElement
    ).click();

    const req = http.expectOne({ method: 'PUT', url: '/api/todos/1' });
    expect(req.request.body).toEqual({ title: 'Buy milk', completed: true });
    req.flush({ ...milk, completed: true });
    await flushReload(page([{ ...milk, completed: true }]));

    expect(element().querySelector('app-todo-item.completed')).not.toBeNull();
  });

  it('renames a todo', async () => {
    await open(ROUTE_URLS.todos, page([milk]));
    button('Upraviť').click();
    await settle();

    const input = element().querySelector('.edit-input') as HTMLInputElement;
    input.value = 'Buy oat milk';
    input.dispatchEvent(new Event('input'));
    button('Uložiť').click();

    const req = http.expectOne({ method: 'PUT', url: '/api/todos/1' });
    expect(req.request.body).toEqual({
      title: 'Buy oat milk',
      completed: false,
    });
    req.flush({ ...milk, title: 'Buy oat milk' });
    await flushReload(page([{ ...milk, title: 'Buy oat milk' }]));

    expect(element().querySelector('.edit-input')).toBeNull();
    expect(titles()).toEqual(['Buy oat milk']);
  });

  it('deletes a todo', async () => {
    await open(ROUTE_URLS.todos, page([milk]));
    button('Zmazať').click();

    http.expectOne({ method: 'DELETE', url: '/api/todos/1' }).flush(null);
    await flushReload(page([]));

    expect(titles()).toEqual([]);
    expect(element().textContent).toContain('Zatiaľ žiadne úlohy.');
  });

  it('shows an error when deleting fails', async () => {
    await open(ROUTE_URLS.todos, page([milk]));
    button('Zmazať').click();

    http
      .expectOne({ method: 'DELETE', url: '/api/todos/1' })
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(titles()).toEqual(['Buy milk']);
    expect(element().querySelector('[role=alert]')?.textContent).toContain(
      'Úlohu sa nepodarilo zmazať.'
    );
  });
});
