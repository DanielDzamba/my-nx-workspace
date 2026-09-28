import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminTodo } from '../data';
import { AdminTodoListPage } from './admin-todo-list-page';

const milk: AdminTodo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
  ownerId: 'auth0|alice',
};

describe('AdminTodoListPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTodoListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(respond: (url: string) => void): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(AdminTodoListPage);
    fixture.detectChanges();
    respond('/api/admin/todos');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function rows(element: HTMLElement): string[][] {
    return Array.from(element.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map(
        (cell) => cell.textContent?.trim() ?? ''
      )
    );
  }

  it('lists the todos of all users with their owners', async () => {
    const element = await render((url) =>
      http
        .expectOne(url)
        .flush([
          milk,
          { ...milk, id: 2, title: 'Old', completed: true, ownerId: 'legacy' },
        ])
    );

    expect(
      rows(element).map(([title, owner, done]) => [title, owner, done])
    ).toEqual([
      ['Buy milk', 'auth0|alice', 'nie'],
      ['Old', 'legacy', 'áno'],
    ]);
    expect(element.textContent).toContain('Spolu: 2 úloh od 2 vlastníkov');
  });

  it('shows an empty state', async () => {
    const element = await render((url) => http.expectOne(url).flush([]));

    expect(rows(element)).toEqual([['Zatiaľ žiadne úlohy.']]);
    expect(element.textContent).not.toContain('Spolu');
  });

  it('shows an error when the request is forbidden', async () => {
    const element = await render((url) =>
      http
        .expectOne(url)
        .flush('forbidden', { status: 403, statusText: 'Forbidden' })
    );

    expect(element.querySelector('[role=alert]')?.textContent).toContain(
      'Nepodarilo sa načítať úlohy všetkých používateľov.'
    );
    expect(element.querySelector('table')).toBeNull();
  });
});
