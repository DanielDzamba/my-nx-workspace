import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '../../shared/util';
import { AdminTodo } from './todo';
import { AdminTodoStore } from './admin-todo-store';

const milk: AdminTodo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
  ownerId: 'auth0|alice',
};

describe('AdminTodoStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof AdminTodoStore>;

  beforeEach(() => {
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
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('loads the todos of all users and counts the owners', async () => {
    http
      .expectOne('https://api.test/api/admin/todos')
      .flush([
        milk,
        { ...milk, id: 2, title: 'Read' },
        { ...milk, id: 3, ownerId: 'auth0|bob' },
      ]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.todos().map((todo) => todo.id)).toEqual([1, 2, 3]);
    expect(store.ownerCount()).toBe(2);
  });

  it('exposes a failed request as an error', async () => {
    http
      .expectOne('https://api.test/api/admin/todos')
      .flush('forbidden', { status: 403, statusText: 'Forbidden' });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.todosError()).toBeTruthy();
    expect(store.todos()).toEqual([]);
  });
});
