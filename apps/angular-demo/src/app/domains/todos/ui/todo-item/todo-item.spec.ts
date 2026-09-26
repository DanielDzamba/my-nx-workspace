import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Todo } from '../../data';
import { TodoItem } from './todo-item';

const milk: Todo = {
  id: 1,
  title: 'Buy milk',
  completed: false,
  createdAt: '2026-09-26T12:00:00Z',
};

describe('TodoItem', () => {
  let fixture: ComponentFixture<TodoItem>;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(TodoItem);
    fixture.componentRef.setInput('todo', milk);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  async function edit(title: string) {
    fixture.componentRef.setInput('editing', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const input = element.querySelector('.edit-input') as HTMLInputElement;
    input.value = title;
    input.dispatchEvent(new Event('input'));
  }

  it('renders the title and completed state', () => {
    expect(element.querySelector('.title')?.textContent).toContain('Buy milk');
    expect(element.classList).not.toContain('completed');

    fixture.componentRef.setInput('todo', { ...milk, completed: true });
    fixture.detectChanges();
    expect(element.classList).toContain('completed');
  });

  it('emits toggleCompleted, remove and editStart', () => {
    const events: string[] = [];
    fixture.componentInstance.toggleCompleted.subscribe(() =>
      events.push('toggle')
    );
    fixture.componentInstance.remove.subscribe(() => events.push('remove'));
    fixture.componentInstance.editStart.subscribe(() =>
      events.push('editStart')
    );

    (element.querySelector('input[type=checkbox]') as HTMLInputElement).click();
    button('Zmazať').click();
    button('Upraviť').click();

    expect(events).toEqual(['toggle', 'remove', 'editStart']);
  });

  it('emits the trimmed new title on save', async () => {
    const renamed: string[] = [];
    fixture.componentInstance.rename.subscribe((title) => renamed.push(title));

    await edit('  Buy oat milk ');
    button('Uložiť').click();

    expect(renamed).toEqual(['Buy oat milk']);
  });

  it('cancels instead of renaming to an empty or unchanged title', async () => {
    let cancels = 0;
    const renamed: string[] = [];
    fixture.componentInstance.editCancel.subscribe(() => cancels++);
    fixture.componentInstance.rename.subscribe((title) => renamed.push(title));

    await edit('   ');
    button('Uložiť').click();
    await edit('Buy milk');
    button('Uložiť').click();

    expect(cancels).toBe(2);
    expect(renamed).toEqual([]);
  });
});
