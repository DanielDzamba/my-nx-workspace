import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '../../shared/util';
import { Todo } from './todo';
import { TodoStore } from './todo-store';

const milk: Todo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
};
const bread: Todo = { ...milk, id: 2, title: 'Bake bread', completed: true };

describe('TodoStore', () => {
  let http: HttpTestingController;

  async function setup() {
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
    TestBed.tick();
    http.expectOne('https://api.test/api/todos').flush([milk, bread]);
    await TestBed.inject(ApplicationRef).whenStable();
    return store;
  }

  afterEach(() => http.verify());

  it('loads todos and counts the remaining ones', async () => {
    const store = await setup();
    expect(store.todos()).toEqual([milk, bread]);
    expect(store.remaining()).toBe(1);
    expect(store.todosIsLoading()).toBe(false);
  });

  it('appends an added todo', async () => {
    const store = await setup();
    const pending = store.addTodo('Read');
    http
      .expectOne({ method: 'POST', url: 'https://api.test/api/todos' })
      .flush({ ...milk, id: 3, title: 'Read' });

    expect((await pending).status).toBe('success');
    expect(store.todos().map((t) => t.title)).toEqual([
      'Buy milk',
      'Bake bread',
      'Read',
    ]);
  });

  it('replaces an updated todo', async () => {
    const store = await setup();
    const pending = store.updateTodo({
      id: 1,
      changes: { title: 'Buy milk', completed: true },
    });
    http
      .expectOne({ method: 'PUT', url: 'https://api.test/api/todos/1' })
      .flush({ ...milk, completed: true });

    await pending;
    expect(store.remaining()).toBe(0);
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
