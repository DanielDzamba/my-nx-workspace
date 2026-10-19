import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '../../shared/util';
import {
  NOTIFICATION_TYPES,
  Notification,
  NotificationList,
} from './notification';
import {
  NOTIFICATION_POLL_INTERVAL,
  NotificationStore,
} from './notification-store';

const LIST_URL = 'https://api.test/api/notifications';
const POLL_INTERVAL = 15_000;

const milk: Notification = {
  id: 1,
  type: NOTIFICATION_TYPES.todoCompleted,
  todoId: 7,
  todoTitle: 'Buy milk',
  createdAt: '2026-10-19T12:00:00Z',
  read: false,
};

function list(items: Notification[], unreadCount: number): NotificationList {
  return { items, unreadCount };
}

describe('NotificationStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof NotificationStore>;
  const enabled = signal(true);

  beforeEach(() => {
    // The polling timer runs on fake time, advanced by the tests
    vi.useFakeTimers();
    enabled.set(true);
    TestBed.configureTestingModule({
      providers: [
        NotificationStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test' },
        { provide: NOTIFICATION_POLL_INTERVAL, useValue: POLL_INTERVAL },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(NotificationStore);
    TestBed.runInInjectionContext(() => store.connectEnabled(enabled));
    TestBed.tick();
  });

  afterEach(() => {
    // Stops the polling, which cancels a request still in flight
    enabled.set(false);
    TestBed.tick();
    http.verify();
    vi.useRealTimers();
  });

  /**
   * Moves the fake clock by `ms` and runs what became due, incl. promise callbacks (the resource
   * hands values over asynchronously). The first poll is due right away.
   */
  async function nextPoll(ms = 0) {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(ms);
  }

  /** Applies a flushed response to the store's signals. */
  async function settle() {
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  }

  it('loads the notifications right away and polls again', async () => {
    await nextPoll();
    http.expectOne(LIST_URL).flush(list([milk], 1));
    await settle();

    expect(store.notifications()).toEqual([milk]);
    expect(store.unreadCount()).toBe(1);

    await nextPoll(POLL_INTERVAL);
    http.expectOne(LIST_URL).flush(list([{ ...milk, id: 2 }, milk], 2));
    await settle();

    expect(store.notifications().map((n) => n.id)).toEqual([2, 1]);
    expect(store.unreadCount()).toBe(2);
  });

  it('keeps the last list when a poll fails', async () => {
    await nextPoll();
    http.expectOne(LIST_URL).flush(list([milk], 1));
    await settle();

    await nextPoll(POLL_INTERVAL);
    http
      .expectOne(LIST_URL)
      .flush('down', { status: 503, statusText: 'Unavailable' });
    await settle();

    expect(store.notifications()).toEqual([milk]);
    expect(store.unreadCount()).toBe(1);
  });

  it('ignores notification types it does not know', async () => {
    await nextPoll();
    const unknown = { ...milk, id: 3, type: 'SOMETHING_NEW' };
    http.expectOne(LIST_URL).flush({ items: [unknown, milk], unreadCount: 2 });
    await settle();

    expect(store.notifications()).toEqual([milk]);
  });

  it('stops polling and clears the list when disabled', async () => {
    await nextPoll();
    http.expectOne(LIST_URL).flush(list([milk], 1));
    await settle();

    enabled.set(false);
    await settle();
    await nextPoll(POLL_INTERVAL);

    http.expectNone(LIST_URL);
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });

  it('marks all as read and reloads', async () => {
    await nextPoll();
    http.expectOne(LIST_URL).flush(list([milk], 1));
    await settle();

    const result = store.markAllRead();
    const request = http.expectOne(`${LIST_URL}/read-all`);
    expect(request.request.method).toBe('POST');
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect((await result).status).toBe('success');

    TestBed.tick();
    await nextPoll();
    http.expectOne(LIST_URL).flush(list([{ ...milk, read: true }], 0));
    await settle();

    expect(store.unreadCount()).toBe(0);
    expect(store.notifications()[0].read).toBe(true);
  });
});
