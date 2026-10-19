import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthClient, AuthUser } from '../../shared/data';
import { API_BASE_URL, ROUTE_PATHS, ROUTE_URLS } from '../../shared/util';
import {
  NOTIFICATION_POLL_INTERVAL,
  NOTIFICATION_TYPES,
  Notification,
} from '../data';
import { NotificationWidget } from './notification-widget';

const LIST_URL = 'https://api.test/api/notifications';

const milk: Notification = {
  id: 1,
  type: NOTIFICATION_TYPES.todoCompleted,
  todoId: 7,
  todoTitle: 'Buy milk',
  createdAt: '2026-10-19T12:00:00Z',
  read: false,
};

describe('NotificationWidget', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<NotificationWidget>;
  const authenticated = signal(true);
  const client = {
    isAuthenticated: authenticated,
    user: signal<AuthUser | null>({ name: 'Jana', roles: [] }),
    login: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(() => {
    // Fake time: the polling interval would otherwise keep the zone busy (no whenStable)
    vi.useFakeTimers();
    authenticated.set(true);
    TestBed.configureTestingModule({
      imports: [NotificationWidget],
      providers: [
        // Target of the notification links
        provideRouter([{ path: ROUTE_PATHS.todoDetail, children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthClient, useValue: client },
        { provide: API_BASE_URL, useValue: 'https://api.test' },
        // Only the first poll and explicit reloads happen during a test
        { provide: NOTIFICATION_POLL_INTERVAL, useValue: 60_000 },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    vi.useRealTimers();
  });

  /** Runs what is due now (the first poll, promise callbacks of mutations) and re-renders. */
  async function tick(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(NotificationWidget);
    fixture.detectChanges();
    await tick();
    return fixture.nativeElement as HTMLElement;
  }

  async function flushList(items: Notification[], unreadCount: number) {
    http.expectOne(LIST_URL).flush({ items, unreadCount });
    await tick();
  }

  function bell(element: HTMLElement): HTMLButtonElement {
    const found = element.querySelector<HTMLButtonElement>('button.bell');
    if (!found) throw new Error('No bell');
    return found;
  }

  it('shows nothing and does not poll for anonymous users', async () => {
    authenticated.set(false);
    const element = await render();

    expect(element.querySelector('button')).toBeNull();
    http.expectNone(LIST_URL);
  });

  it('shows the number of unread notifications on the bell', async () => {
    const element = await render();
    await flushList([milk], 1);

    expect(bell(element).getAttribute('aria-label')).toBe(
      'Notifikácie, neprečítané: 1'
    );
    expect(element.querySelector('.badge')?.textContent?.trim()).toBe('1');
  });

  it('opens a fresh list with links to the todos', async () => {
    const element = await render();
    await flushList([], 0);
    expect(element.querySelector('.badge')).toBeNull();

    bell(element).click();
    fixture.detectChanges();
    await tick();
    await flushList([milk, { ...milk, id: 2, read: true }], 1);

    expect(bell(element).getAttribute('aria-expanded')).toBe('true');
    const links = Array.from(element.querySelectorAll('li a'));
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Dokončená úloha: Buy milk',
      'Dokončená úloha: Buy milk',
    ]);
    expect(links[0].getAttribute('href')).toBe(ROUTE_URLS.todoDetail(7));
    expect(element.querySelectorAll('li.unread')).toHaveLength(1);

    (links[0] as HTMLAnchorElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.panel')).toBeNull();
  });

  it('says when there are no notifications', async () => {
    const element = await render();
    await flushList([], 0);

    bell(element).click();
    fixture.detectChanges();
    await tick();
    await flushList([], 0);

    expect(element.querySelector('li')?.textContent?.trim()).toBe(
      'Zatiaľ žiadne notifikácie.'
    );
    bell(element).click();
    fixture.detectChanges();
    expect(element.querySelector('.panel')).toBeNull();
  });

  function markAllButton(element: HTMLElement): HTMLButtonElement {
    const found = element.querySelector<HTMLButtonElement>('.panel button');
    if (!found) throw new Error('No mark-all button');
    return found;
  }

  async function openWithUnread(): Promise<HTMLElement> {
    const element = await render();
    await flushList([milk], 1);
    bell(element).click();
    fixture.detectChanges();
    await tick();
    await flushList([milk], 1);
    return element;
  }

  it('marks all notifications as read', async () => {
    const element = await openWithUnread();

    markAllButton(element).click();
    http
      .expectOne(`${LIST_URL}/read-all`)
      .flush(null, { status: 204, statusText: 'No Content' });
    // The mutation settles, then the reload starts a new poll
    await tick();
    await tick();
    await flushList([{ ...milk, read: true }], 0);

    expect(element.querySelector('.badge')).toBeNull();
    expect(element.querySelector('.panel button')).toBeNull();
    expect(element.querySelector('li.unread')).toBeNull();
  });

  it('reports when marking as read fails', async () => {
    const element = await openWithUnread();

    markAllButton(element).click();
    http
      .expectOne(`${LIST_URL}/read-all`)
      .flush('down', { status: 503, statusText: 'Unavailable' });
    await tick();

    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Notifikácie sa nepodarilo označiť ako prečítané.'
    );
  });
});
