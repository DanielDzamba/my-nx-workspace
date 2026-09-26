import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Todo } from '../data';
import { TodoListPage } from './todo-list-page';

const milk: Todo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
};

describe('TodoListPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TodoListPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Mutations are not Angular pending tasks, so whenStable() alone does not wait for them:
   * let the mutation promise and the page's handler run, then re-render (ngModel writes async).
   */
  async function settle(fixture: ComponentFixture<TodoListPage>) {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function render(todos: Todo[] = [milk]) {
    const fixture = TestBed.createComponent(TodoListPage);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: '/api/todos' }).flush(todos);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element };
  }

  function titles(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.title')).map(
      (el) => el.textContent?.trim() ?? ''
    );
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  it('loads and renders todos', async () => {
    const { element } = await render();
    expect(titles(element)).toEqual(['Buy milk']);
    expect(element.textContent).toContain('Zostáva: 1 z 1');
  });

  it('shows an error when loading fails', async () => {
    const fixture = TestBed.createComponent(TodoListPage);
    fixture.detectChanges();
    http
      .expectOne('/api/todos')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await settle(fixture);

    const alert = (fixture.nativeElement as HTMLElement).querySelector(
      '[role=alert]'
    );
    expect(alert?.textContent).toContain('Nepodarilo sa načítať úlohy');
  });

  it('adds a todo and clears the input', async () => {
    const { fixture, element } = await render();
    const input = element.querySelector(
      'app-todo-add-form input'
    ) as HTMLInputElement;
    input.value = '  Read  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button(element, 'Pridať').click();

    const req = http.expectOne({ method: 'POST', url: '/api/todos' });
    expect(req.request.body).toEqual({ title: 'Read' });
    req.flush({ ...milk, id: 2, title: 'Read' });
    await settle(fixture);

    expect(titles(element)).toEqual(['Buy milk', 'Read']);
    expect(input.value).toBe('');
  });

  it('toggles completion', async () => {
    const { fixture, element } = await render();
    (element.querySelector('input[type=checkbox]') as HTMLInputElement).click();

    const req = http.expectOne({ method: 'PUT', url: '/api/todos/1' });
    expect(req.request.body).toEqual({ title: 'Buy milk', completed: true });
    req.flush({ ...milk, completed: true });
    await settle(fixture);

    expect(element.querySelector('app-todo-item.completed')).not.toBeNull();
    expect(element.textContent).toContain('Zostáva: 0 z 1');
  });

  it('renames a todo', async () => {
    const { fixture, element } = await render();
    button(element, 'Upraviť').click();
    await settle(fixture);

    const input = element.querySelector('.edit-input') as HTMLInputElement;
    input.value = 'Buy oat milk';
    input.dispatchEvent(new Event('input'));
    button(element, 'Uložiť').click();

    const req = http.expectOne({ method: 'PUT', url: '/api/todos/1' });
    expect(req.request.body).toEqual({
      title: 'Buy oat milk',
      completed: false,
    });
    req.flush({ ...milk, title: 'Buy oat milk' });
    await settle(fixture);

    expect(element.querySelector('.edit-input')).toBeNull();
    expect(titles(element)).toEqual(['Buy oat milk']);
  });

  it('deletes a todo', async () => {
    const { fixture, element } = await render();
    button(element, 'Zmazať').click();

    http.expectOne({ method: 'DELETE', url: '/api/todos/1' }).flush(null);
    await settle(fixture);

    expect(titles(element)).toEqual([]);
    expect(element.textContent).toContain('Zatiaľ žiadne úlohy.');
  });

  it('shows an error when deleting fails', async () => {
    const { fixture, element } = await render();
    button(element, 'Zmazať').click();

    http
      .expectOne({ method: 'DELETE', url: '/api/todos/1' })
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await settle(fixture);

    expect(titles(element)).toEqual(['Buy milk']);
    expect(element.querySelector('[role=alert]')?.textContent).toContain(
      'Úlohu sa nepodarilo zmazať.'
    );
  });
});
