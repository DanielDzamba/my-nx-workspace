import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { MutationResult } from '@angular-architects/ngrx-toolkit';
import { ROUTE_URLS } from '../../shared/util';
import { Todo, TodoStore } from '../data';
import { Pager, TodoAddForm, TodoFilter, TodoItem } from '../ui';
import {
  TODO_STATUSES,
  TodoQuery,
  parseTodoQuery,
  todoQueryParams,
} from '../util';

@Component({
  selector: 'app-todo-list-page',
  imports: [RouterLink, Pager, TodoAddForm, TodoFilter, TodoItem],
  providers: [TodoStore],
  templateUrl: './todo-list-page.html',
  styleUrl: './todo-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoListPage {
  protected readonly store = inject(TodoStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly urls = ROUTE_URLS;

  // Query params of the URL, bound by the router (withComponentInputBinding); undefined if missing
  readonly status = input<string>();
  readonly q = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  /** The URL is the single source of truth for what the list shows. */
  protected readonly query = computed(() =>
    parseTodoQuery({
      status: this.status(),
      q: this.q(),
      sort: this.sort(),
      page: this.page(),
    })
  );

  protected readonly isFiltered = computed(
    () => !!this.query().q || this.query().status !== TODO_STATUSES.all
  );

  protected readonly newTitle = signal('');
  protected readonly editingId = signal<number | null>(null);

  private readonly mutationError = signal<string | null>(null);
  protected readonly error = computed(
    () =>
      this.mutationError() ??
      (this.store.todoPageError()
        ? 'Nepodarilo sa načítať úlohy. Beží backend?'
        : null)
  );

  constructor() {
    this.store.connectQuery(this.query);
  }

  /** Changing the list means changing the URL; the store follows it through `query`. */
  protected navigate(query: TodoQuery): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: todoQueryParams(query),
    });
  }

  protected goToPage(page: number): void {
    this.navigate({ ...this.query(), page });
  }

  protected async add(title: string): Promise<void> {
    const result = await this.store.addTodo(title);
    // Only if the input still holds the added title: the user may already be typing the next one
    if (
      this.handle(result, 'Úlohu sa nepodarilo pridať.') &&
      this.newTitle().trim() === title
    ) {
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
