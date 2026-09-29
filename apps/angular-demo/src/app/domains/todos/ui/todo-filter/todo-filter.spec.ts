import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  DEFAULT_TODO_QUERY,
  TODO_SORTS,
  TODO_STATUSES,
  TodoQuery,
} from '../../util';
import { TodoFilter } from './todo-filter';

describe('TodoFilter', () => {
  let fixture: ComponentFixture<TodoFilter>;
  let element: HTMLElement;
  let emitted: TodoQuery[];

  /** A query on page 3, so the tests can check that every change goes back to page 0. */
  const current: TodoQuery = { ...DEFAULT_TODO_QUERY, q: 'milk', page: 2 };

  beforeEach(async () => {
    fixture = TestBed.createComponent(TodoFilter);
    fixture.componentRef.setInput('query', current);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
    emitted = [];
    fixture.componentInstance.queryChange.subscribe((query) =>
      emitted.push(query)
    );
  });

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  it('marks the current status', () => {
    expect(button('Všetky').getAttribute('aria-pressed')).toBe('true');
    expect(button('Hotové').getAttribute('aria-pressed')).toBe('false');
  });

  it('changes the status and starts at the first page', () => {
    button('Hotové').click();

    expect(emitted).toEqual([
      { ...current, status: TODO_STATUSES.completed, page: 0 },
    ]);
  });

  it('searches on submit only, with the trimmed text', async () => {
    const input = element.querySelector(
      'input[type=search]'
    ) as HTMLInputElement;
    expect(input.value).toBe('milk');

    input.value = '  bread ';
    input.dispatchEvent(new Event('input'));
    expect(emitted).toEqual([]);

    button('Hľadať').click();
    expect(emitted).toEqual([{ ...current, q: 'bread', page: 0 }]);
  });

  it('keeps the typed search when only the status changes', async () => {
    const input = element.querySelector(
      'input[type=search]'
    ) as HTMLInputElement;
    input.value = 'bread';
    input.dispatchEvent(new Event('input'));

    fixture.componentRef.setInput('query', {
      ...current,
      status: TODO_STATUSES.completed,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.value).toBe('bread');

    fixture.componentRef.setInput('query', { ...current, q: 'cheese' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.value).toBe('cheese');
  });

  it('clears the search', () => {
    button('Zrušiť hľadanie').click();

    expect(emitted).toEqual([{ ...current, q: '', page: 0 }]);
  });

  it('hides "clear search" without a search', () => {
    fixture.componentRef.setInput('query', DEFAULT_TODO_QUERY);
    fixture.detectChanges();

    expect(
      Array.from(element.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Zrušiť hľadanie')
      )
    ).toBe(false);
  });

  it('changes the sort', () => {
    const select = element.querySelector('select') as HTMLSelectElement;
    select.value = TODO_SORTS.titleAsc;
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([
      { ...current, sort: TODO_SORTS.titleAsc, page: 0 },
    ]);
  });
});
