import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ROUTE_URLS } from '../../../shared/util';
import type { TodoSummary } from '../../data';

@Component({
  selector: 'app-todo-item',
  imports: [FormsModule, RouterLink],
  templateUrl: './todo-item.html',
  styleUrl: './todo-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.completed]': 'todo().completed',
  },
})
export class TodoItem {
  readonly todo = input.required<TodoSummary>();
  readonly editing = input(false);

  readonly toggleCompleted = output<void>();
  readonly remove = output<void>();
  readonly editStart = output<void>();
  readonly editCancel = output<void>();
  /** Emits the new trimmed title; unchanged or empty titles cancel editing instead. */
  readonly rename = output<string>();

  protected readonly urls = ROUTE_URLS;

  /** Title being edited; reset to the current title whenever editing starts or the todo changes. */
  protected readonly draft = linkedSignal({
    source: () => ({ title: this.todo().title, editing: this.editing() }),
    computation: ({ title }) => title,
  });

  protected save(): void {
    const title = this.draft().trim();
    if (!title || title === this.todo().title) {
      this.editCancel.emit();
      return;
    }
    this.rename.emit(title);
  }
}
