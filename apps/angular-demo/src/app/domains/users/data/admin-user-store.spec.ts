import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '../../shared/util';
import { AdminUserStore } from './admin-user-store';
import { User, UserPage } from './user';

const alice: User = {
  id: 'auth0|alice',
  name: 'Alice',
  email: 'alice@example.com',
  blocked: false,
  createdAt: '2026-10-24T12:00:00Z',
};

const PAGE_0 = 'https://api.test/api/admin/users?page=0';
const ALICE_BLOCKED = 'https://api.test/api/admin/users/auth0%7Calice/blocked';

function page(content: User[], totalElements: number): UserPage {
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

describe('AdminUserStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof AdminUserStore>;
  const pageIndex = signal(0);

  beforeEach(() => {
    pageIndex.set(0);
    TestBed.configureTestingModule({
      providers: [
        AdminUserStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AdminUserStore);
    TestBed.runInInjectionContext(() => store.connectPage(pageIndex));
    TestBed.tick();
  });

  afterEach(() => http.verify());

  async function settle() {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('loads a page of users and follows the page index', async () => {
    http.expectOne(PAGE_0).flush(page([alice], 25));
    await settle();

    expect(store.users()).toEqual([alice]);
    expect(store.totalElements()).toBe(25);
    expect(store.totalPages()).toBe(2);

    pageIndex.set(1);
    TestBed.tick();
    http
      .expectOne('https://api.test/api/admin/users?page=1')
      .flush(page([], 25));
    await settle();
    expect(store.users()).toEqual([]);
  });

  it('blocks a user with the URL-encoded ID and reloads the page', async () => {
    http.expectOne(PAGE_0).flush(page([alice], 1));
    await settle();

    const result = store.setBlocked({ id: alice.id, blocked: true });
    const request = http.expectOne(ALICE_BLOCKED);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ blocked: true });
    request.flush({ ...alice, blocked: true });
    expect((await result).status).toBe('success');
    TestBed.tick();

    http.expectOne(PAGE_0).flush(page([{ ...alice, blocked: true }], 1));
    await settle();
    expect(store.users()[0].blocked).toBe(true);
  });

  it('reports a failed change and keeps the page', async () => {
    http.expectOne(PAGE_0).flush(page([alice], 1));
    await settle();

    const result = store.setBlocked({ id: alice.id, blocked: true });
    http
      .expectOne(ALICE_BLOCKED)
      .flush(null, { status: 409, statusText: 'Conflict' });

    expect((await result).status).toBe('error');
    expect(store.users()).toEqual([alice]);
  });
});
