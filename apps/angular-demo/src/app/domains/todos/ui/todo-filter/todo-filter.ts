import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TODO_SORTS,
  TODO_STATUSES,
  TodoQuery,
  TodoSort,
  TodoStatus,
} from '../../util';

/**
 * Status, search and sort of the todo list. Emits the whole new query; every change starts
 * again at the first page, because the old page number means nothing for a different result.
 */
@Component({
  selector: 'app-todo-filter',
  imports: [FormsModule],
  templateUrl: './todo-filter.html',
  styleUrl: './todo-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoFilter {
  readonly query = input.required<TodoQuery>();
  readonly queryChange = output<TodoQuery>();

  protected readonly statuses: { value: TodoStatus; label: string }[] = [
    { value: TODO_STATUSES.all, label: 'Všetky' },
    { value: TODO_STATUSES.active, label: 'Nehotové' },
    { value: TODO_STATUSES.completed, label: 'Hotové' },
  ];
  protected readonly sorts: { value: TodoSort; label: string }[] = [
    { value: TODO_SORTS.newest, label: 'Najnovšie' },
    { value: TODO_SORTS.oldest, label: 'Najstaršie' },
    { value: TODO_SORTS.titleAsc, label: 'Názov A–Z' },
    { value: TODO_SORTS.titleDesc, label: 'Názov Z–A' },
  ];

  /**
   * Search text being typed; sent only on submit (one request per search, not per keystroke).
   * Reset whenever the query changes from outside, e.g. by the back button.
   */
  protected readonly searchDraft = linkedSignal(() => this.query().q);

  protected setStatus(status: TodoStatus): void {
    this.emit({ status });
  }

  protected setSort(sort: TodoSort): void {
    this.emit({ sort });
  }

  protected search(): void {
    this.emit({ q: this.searchDraft().trim() });
  }

  protected clearSearch(): void {
    this.searchDraft.set('');
    this.emit({ q: '' });
  }

  private emit(change: Partial<TodoQuery>): void {
    this.queryChange.emit({ ...this.query(), ...change, page: 0 });
  }
}
