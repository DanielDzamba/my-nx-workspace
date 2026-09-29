import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '../../shared/util';
import { Subtask, TodoDetail } from './todo';
import { TodoDetailStore } from './todo-detail-store';

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

describe('TodoDetailStore', () => {
  let http: HttpTestingController;
  const id = signal(1);

  function setup() {
    id.set(1);
    TestBed.configureTestingModule({
      providers: [
        TodoDetailStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(TodoDetailStore);
    TestBed.runInInjectionContext(() => store.connectId(id));
    TestBed.tick();
    return store;
  }

  async function settle() {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  async function loaded() {
    const store = setup();
    http.expectOne('https://api.test/api/todos/1').flush(trip);
    await settle();
    return store;
  }

  afterEach(() => http.verify());

  it('loads the todo of the id and follows id changes', async () => {
    const store = await loaded();
    expect(store.todo()).toEqual(trip);

    id.set(2);
    TestBed.tick();
    http
      .expectOne('https://api.test/api/todos/2')
      .flush({ ...trip, id: 2, title: 'Other' });
    await settle();

    expect(store.todo()?.title).toBe('Other');
  });

  it('recognizes a missing todo', async () => {
    const store = setup();
    http
      .expectOne('https://api.test/api/todos/1')
      .flush('not found', { status: 404, statusText: 'Not Found' });
    await settle();

    expect(store.notFound()).toBe(true);
    expect(store.todo()).toBeUndefined();
  });

  it('does not call a failed request "not found" unless it is a 404', async () => {
    const store = setup();
    http
      .expectOne('https://api.test/api/todos/1')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(store.notFound()).toBe(false);
    expect(store.todoError()).toBeTruthy();
  });

  it('applies an update and keeps the subtasks', async () => {
    const store = await loaded();
    const pending = store.updateTodo({
      id: 1,
      changes: { title: 'Trip to Rome', completed: true },
    });
    http
      .expectOne({ method: 'PUT', url: 'https://api.test/api/todos/1' })
      .flush({
        id: 1,
        title: 'Trip to Rome',
        completed: true,
        createdAt: trip.createdAt,
      });
    await pending;

    expect(store.todo()).toEqual({
      ...trip,
      title: 'Trip to Rome',
      completed: true,
    });
  });

  it('adds, updates and removes subtasks', async () => {
    const store = await loaded();

    const added = store.addSubtask({ todoId: 1, title: 'Book hotel' });
    const addRequest = http.expectOne({
      method: 'POST',
      url: 'https://api.test/api/todos/1/subtasks',
    });
    expect(addRequest.request.body).toEqual({ title: 'Book hotel' });
    addRequest.flush({ ...pack, id: 11, title: 'Book hotel' });
    await added;
    expect(store.todo()?.subtasks.map((s) => s.title)).toEqual([
      'Pack',
      'Book hotel',
    ]);

    const updated = store.updateSubtask({
      todoId: 1,
      id: 10,
      changes: { title: 'Pack', completed: true },
    });
    http
      .expectOne({
        method: 'PUT',
        url: 'https://api.test/api/todos/1/subtasks/10',
      })
      .flush({ ...pack, completed: true });
    await updated;
    expect(store.todo()?.subtasks[0].completed).toBe(true);

    const removed = store.removeSubtask({ todoId: 1, id: 10 });
    http
      .expectOne({
        method: 'DELETE',
        url: 'https://api.test/api/todos/1/subtasks/10',
      })
      .flush(null);
    await removed;
    expect(store.todo()?.subtasks.map((s) => s.id)).toEqual([11]);
  });

  it('deletes the todo', async () => {
    const store = await loaded();
    const pending = store.removeTodo(1);
    http
      .expectOne({ method: 'DELETE', url: 'https://api.test/api/todos/1' })
      .flush(null);

    expect((await pending).status).toBe('success');
  });
});
