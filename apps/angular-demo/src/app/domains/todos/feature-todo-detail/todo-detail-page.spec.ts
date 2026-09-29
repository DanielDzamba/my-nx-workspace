import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ROUTE_PATHS, ROUTE_URLS } from '../../shared/util';
import { Subtask, TodoDetail } from '../data';
import { TODO_STATUSES } from '../util';
import { TodoDetailPage } from './todo-detail-page';

/** Stands in for the list page, which the detail navigates to after deleting. */
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class ListStub {}

const pack: Subtask = {
  id: 10,
  title: 'Pack',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
};
const trip: TodoDetail = {
  id: 1,
  title: 'Trip',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
  subtasks: [pack],
};

describe('TodoDetailPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: ROUTE_PATHS.todoDetail, component: TodoDetailPage },
            { path: ROUTE_PATHS.todos, component: ListStub },
          ],
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

  /** See TodoListPage spec: mutations need a macrotask before the DOM is updated. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  async function open(url = ROUTE_URLS.todoDetail(trip.id)) {
    await harness.navigateByUrl(url, TodoDetailPage);
    http.expectOne(`/api/todos/${trip.id}`).flush(trip);
    await settle();
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  function subtaskTitles(): string[] {
    return Array.from(element().querySelectorAll('.subtask-title')).map(
      (el) => el.textContent?.trim() ?? ''
    );
  }

  it('loads the todo of the :id route param with its subtasks', async () => {
    await open();

    expect(
      (element().querySelector('.title-form input') as HTMLInputElement).value
    ).toBe('Trip');
    expect(subtaskTitles()).toEqual(['Pack']);
  });

  it('says so when the todo does not exist', async () => {
    await harness.navigateByUrl(ROUTE_URLS.todoDetail(999), TodoDetailPage);
    http
      .expectOne('/api/todos/999')
      .flush('not found', { status: 404, statusText: 'Not Found' });
    await settle();

    expect(element().querySelector('[role=alert]')?.textContent).toContain(
      'Úloha neexistuje.'
    );
    expect(element().querySelector('h1')).toBeNull();
  });

  it('shows a generic error for other failures', async () => {
    await harness.navigateByUrl(ROUTE_URLS.todoDetail(1), TodoDetailPage);
    http
      .expectOne('/api/todos/1')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(element().querySelector('[role=alert]')?.textContent).toContain(
      'Nepodarilo sa načítať úlohu.'
    );
  });

  it('renames the todo', async () => {
    await open();
    const input = element().querySelector(
      '.title-form input'
    ) as HTMLInputElement;
    input.value = ' Trip to Rome ';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    button('Uložiť').click();

    const req = http.expectOne({ method: 'PUT', url: '/api/todos/1' });
    expect(req.request.body).toEqual({
      title: 'Trip to Rome',
      completed: false,
    });
    req.flush({ ...trip, title: 'Trip to Rome' });
    await settle();

    expect(input.value).toBe('Trip to Rome');
    expect(button('Uložiť').disabled).toBe(true);
  });

  it('marks the todo as completed', async () => {
    await open();
    (element().querySelector('.completed input') as HTMLInputElement).click();

    const req = http.expectOne({ method: 'PUT', url: '/api/todos/1' });
    expect(req.request.body).toEqual({ title: 'Trip', completed: true });
    req.flush({ ...trip, completed: true });
    await settle();

    expect(
      (element().querySelector('.completed input') as HTMLInputElement).checked
    ).toBe(true);
  });

  it('adds, completes and removes subtasks', async () => {
    await open();

    const input = element().querySelector(
      'app-todo-add-form input'
    ) as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Nová podúloha');
    input.value = 'Book hotel';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    button('Pridať').click();
    http
      .expectOne({ method: 'POST', url: '/api/todos/1/subtasks' })
      .flush({ ...pack, id: 11, title: 'Book hotel' });
    await settle();
    expect(subtaskTitles()).toEqual(['Pack', 'Book hotel']);
    expect(input.value).toBe('');

    (
      element().querySelector(
        'input[aria-label="Hotovo: Pack"]'
      ) as HTMLInputElement
    ).click();
    const toggle = http.expectOne({
      method: 'PUT',
      url: '/api/todos/1/subtasks/10',
    });
    expect(toggle.request.body).toEqual({ title: 'Pack', completed: true });
    toggle.flush({ ...pack, completed: true });
    await settle();
    expect(element().querySelector('.subtasks li.done')).not.toBeNull();

    (
      element().querySelector(
        'button[aria-label="Zmazať podúlohu Pack"]'
      ) as HTMLButtonElement
    ).click();
    http
      .expectOne({ method: 'DELETE', url: '/api/todos/1/subtasks/10' })
      .flush(null);
    await settle();
    expect(subtaskTitles()).toEqual(['Book hotel']);
  });

  it('shows an error when a subtask cannot be removed', async () => {
    await open();
    (
      element().querySelector(
        'button[aria-label="Zmazať podúlohu Pack"]'
      ) as HTMLButtonElement
    ).click();
    http
      .expectOne({ method: 'DELETE', url: '/api/todos/1/subtasks/10' })
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(subtaskTitles()).toEqual(['Pack']);
    expect(element().querySelector('[role=alert]')?.textContent).toContain(
      'Podúlohu sa nepodarilo zmazať.'
    );
  });

  it('deletes the todo and returns to the list with its filter', async () => {
    const filter = `status=${TODO_STATUSES.active}`;
    await open(`${ROUTE_URLS.todoDetail(trip.id)}?${filter}`);
    expect(element().querySelector('a')?.getAttribute('href')).toBe(
      `${ROUTE_URLS.todos}?${filter}`
    );

    button('Zmazať úlohu').click();
    http.expectOne({ method: 'DELETE', url: '/api/todos/1' }).flush(null);
    await settle();

    expect(TestBed.inject(Router).url).toBe(`${ROUTE_URLS.todos}?${filter}`);
  });
});
