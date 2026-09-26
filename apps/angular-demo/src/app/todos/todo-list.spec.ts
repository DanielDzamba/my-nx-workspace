import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TodoList } from './todo-list';
import { Todo } from './todo.service';

const milk: Todo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
};

describe('TodoList', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TodoList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(TodoList);
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: '/api/todos' }).flush([milk]);
    fixture.detectChanges();
    return fixture;
  }

  function button(fixture: ReturnType<typeof render>, label: string) {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('li button')
    ) as HTMLButtonElement[];
    const found = buttons.find((b) => b.textContent?.trim() === label);
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  it('loads and renders todos', () => {
    const fixture = render();
    const titles = (fixture.nativeElement as HTMLElement).querySelectorAll('.title');
    expect(titles.length).toBe(1);
    expect(titles[0].textContent).toContain('Buy milk');
  });

  it('adds a todo', () => {
    const fixture = render();
    const component = fixture.componentInstance as unknown as {
      newTitle: string;
      add(): void;
    };
    component.newTitle = '  Read  ';
    component.add();

    const req = http.expectOne({ method: 'POST', url: '/api/todos' });
    expect(req.request.body).toEqual({ title: 'Read' });
    req.flush({ ...milk, id: 2, title: 'Read' });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.title').length
    ).toBe(2);
  });

  it('toggles completion', () => {
    const fixture = render();
    const checkbox = (fixture.nativeElement as HTMLElement).querySelector(
      'li input[type=checkbox]'
    ) as HTMLInputElement;
    checkbox.click();

    const req = http.expectOne({ method: 'PUT', url: '/api/todos/1' });
    expect(req.request.body).toEqual({ title: 'Buy milk', completed: true });
    req.flush({ ...milk, completed: true });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('li.completed')
    ).not.toBeNull();
  });

  it('deletes a todo', () => {
    const fixture = render();
    button(fixture, 'Zmazať').click();

    http.expectOne({ method: 'DELETE', url: '/api/todos/1' }).flush(null);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.title').length
    ).toBe(0);
  });
});
