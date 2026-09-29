import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '../../shared/util';
import {
  DEFAULT_TODO_QUERY,
  TODO_SORTS,
  TODO_STATUSES,
  TodoQuery,
} from '../util';
import { Page, TodoSummary } from './todo';
import { TodoStore } from './todo-store';

const milk: TodoSummary = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
  subtaskCount: 2,
  completedSubtaskCount: 1,
};
const bread: TodoSummary = {
  ...milk,
  id: 2,
  title: 'Bake bread',
  completed: true,
};

function page(
  content: TodoSummary[],
  totalElements = content.length
): Page<TodoSummary> {
  return {
    content,
    page: {
      size: 10,
      number: 0,
      totalElements,
      totalPages: Math.ceil(totalElements / 10),
    },
  };
}

describe('TodoStore', () => {
  let http: HttpTestingController;
  const query = signal<TodoQuery>(DEFAULT_TODO_QUERY);

  function expectPageRequest(): TestRequest {
    return http.expectOne(
      (req) => req.method === 'GET' && req.url === 'https://api.test/api/todos'
    );
  }

  async function settle() {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  async function setup() {
    query.set(DEFAULT_TODO_QUERY);
    TestBed.configureTestingModule({
      providers: [
        TodoStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(TodoStore);
    TestBed.runInInjectionContext(() => store.connectQuery(query));
    TestBed.tick();
    expectPageRequest().flush(page([milk, bread], 12));
    await settle();
    return store;
  }

  afterEach(() => http.verify());

  it('loads the first page, newest first', async () => {
    const store = await setup();

    expect(store.todos()).toEqual([milk, bread]);
    expect(store.totalElements()).toBe(12);
    expect(store.totalPages()).toBe(2);
    expect(store.todoPageIsLoading()).toBe(false);
  });

  it('sends filter, sort and page of the query to the API', async () => {
    const store = await setup();
    query.set({
      status: TODO_STATUSES.active,
      q: 'milk',
      sort: TODO_SORTS.titleAsc,
      page: 1,
    });
    TestBed.tick();

    const req = expectPageRequest();
    expect(req.request.params.get('status')).toBe(TODO_STATUSES.active);
    expect(req.request.params.get('q')).toBe('milk');
    expect(req.request.params.get('sort')).toBe('title,asc');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([milk]));
    await settle();

    expect(store.todos()).toEqual([milk]);
  });

  it('leaves the default status and empty search out of the request', async () => {
    await setup();
    query.set({ ...DEFAULT_TODO_QUERY, sort: TODO_SORTS.oldest });
    TestBed.tick();

    const req = expectPageRequest();
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.get('sort')).toBe('createdAt,asc');
    req.flush(page([]));
  });

  it('reloads the page after adding, updating and removing', async () => {
    const store = await setup();

    const added = store.addTodo('Read');
    http
      .expectOne({ method: 'POST', url: 'https://api.test/api/todos' })
      .flush({ ...milk, id: 3, title: 'Read' });
    expect((await added).status).toBe('success');
    TestBed.tick();
    expectPageRequest().flush(page([{ ...milk, id: 3 }, milk, bread]));
    await settle();
    expect(store.todos()).toHaveLength(3);

    const updated = store.updateTodo({
      id: 1,
      changes: { title: 'Buy milk', completed: true },
    });
    http
      .expectOne({ method: 'PUT', url: 'https://api.test/api/todos/1' })
      .flush({ ...milk, completed: true });
    await updated;
    TestBed.tick();
    expectPageRequest().flush(page([bread]));
    await settle();

    const removed = store.removeTodo(2);
    http
      .expectOne({ method: 'DELETE', url: 'https://api.test/api/todos/2' })
      .flush(null);
    await removed;
    TestBed.tick();
    expectPageRequest().flush(page([]));
    await settle();

    expect(store.todos()).toEqual([]);
  });

  it('keeps the list when removing fails', async () => {
    const store = await setup();
    const pending = store.removeTodo(1);
    http
      .expectOne({ method: 'DELETE', url: 'https://api.test/api/todos/1' })
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect((await pending).status).toBe('error');
    expect(store.todos()).toEqual([milk, bread]);
    expect(store.removeTodoError()).toBeTruthy();
  });
});
