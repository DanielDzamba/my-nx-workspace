import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { MutationResult } from '@angular-architects/ngrx-toolkit';
import { Todo, TodoStore } from '../data';
import { TodoAddForm, TodoItem } from '../ui';

@Component({
  selector: 'app-todo-list-page',
  imports: [TodoAddForm, TodoItem],
  providers: [TodoStore],
  templateUrl: './todo-list-page.html',
  styleUrl: './todo-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoListPage {
  protected readonly store = inject(TodoStore);

  protected readonly newTitle = signal('');
  protected readonly editingId = signal<number | null>(null);

  private readonly mutationError = signal<string | null>(null);
  protected readonly error = computed(
    () =>
      this.mutationError() ??
      (this.store.todosError()
        ? 'Nepodarilo sa načítať úlohy. Beží backend?'
        : null)
  );

  protected async add(title: string): Promise<void> {
    const result = await this.store.addTodo(title);
    if (this.handle(result, 'Úlohu sa nepodarilo pridať.')) {
      this.newTitle.set('');
    }
  }

  protected toggle(todo: Todo): void {
    this.update(todo, { title: todo.title, completed: !todo.completed });
  }

  protected rename(todo: Todo, title: string): void {
    this.update(todo, { title, completed: todo.completed });
  }

  protected async remove(todo: Todo): Promise<void> {
    const result = await this.store.removeTodo(todo.id);
    this.handle(result, 'Úlohu sa nepodarilo zmazať.');
  }

  private async update(
    todo: Todo,
    changes: { title: string; completed: boolean }
  ): Promise<void> {
    const result = await this.store.updateTodo({ id: todo.id, changes });
    if (this.handle(result, 'Úlohu sa nepodarilo uložiť.')) {
      this.editingId.set(null);
    }
  }

  /** Shows `message` on failure, clears the error on success. Returns whether it succeeded. */
  private handle(result: MutationResult<unknown>, message: string): boolean {
    if (result.status === 'error') {
      this.mutationError.set(message);
      return false;
    }
    this.mutationError.set(null);
    return result.status === 'success';
  }
}
