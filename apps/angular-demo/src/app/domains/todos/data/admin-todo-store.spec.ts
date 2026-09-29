import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '../../shared/util';
import { AdminTodo, Page } from './todo';
import { AdminTodoStore } from './admin-todo-store';

const milk: AdminTodo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
  ownerId: 'auth0|alice',
};

function page(content: AdminTodo[], totalElements: number): Page<AdminTodo> {
  return {
    content,
    page: {
      size: 20,
      number: 0,
      totalElements,
      totalPages: Math.ceil(totalElements / 20),
    },
  };
}

describe('AdminTodoStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof AdminTodoStore>;
  const pageIndex = signal(0);

  beforeEach(() => {
    pageIndex.set(0);
    TestBed.configureTestingModule({
      providers: [
        AdminTodoStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AdminTodoStore);
    TestBed.runInInjectionContext(() => store.connectPage(pageIndex));
    TestBed.tick();
  });

  afterEach(() => http.verify());

  async function settle() {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('loads a page of all users todos and follows the page index', async () => {
    http
      .expectOne('https://api.test/api/admin/todos?page=0')
      .flush(page([milk, { ...milk, id: 2, ownerId: 'auth0|bob' }], 25));
    await settle();

    expect(store.todos().map((todo) => todo.id)).toEqual([1, 2]);
    expect(store.totalElements()).toBe(25);
    expect(store.totalPages()).toBe(2);

    pageIndex.set(1);
    TestBed.tick();
    http
      .expectOne('https://api.test/api/admin/todos?page=1')
      .flush(page([{ ...milk, id: 21 }], 25));
    await settle();

    expect(store.todos().map((todo) => todo.id)).toEqual([21]);
  });

  it('exposes a failed request as an error', async () => {
    http
      .expectOne('https://api.test/api/admin/todos?page=0')
      .flush('forbidden', { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(store.todoPageError()).toBeTruthy();
    expect(store.todos()).toEqual([]);
  });
});
