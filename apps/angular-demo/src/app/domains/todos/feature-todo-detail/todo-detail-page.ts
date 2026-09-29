import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { MutationResult } from '@angular-architects/ngrx-toolkit';
import { ROUTE_URLS } from '../../shared/util';
import { Subtask, TodoDetail, TodoDetailStore } from '../data';
import { TodoAddForm } from '../ui';

/** One todo (`/todos/:id`): rename, complete, delete, and manage its subtasks. */
@Component({
  selector: 'app-todo-detail-page',
  imports: [DatePipe, FormsModule, RouterLink, TodoAddForm],
  providers: [TodoDetailStore],
  templateUrl: './todo-detail-page.html',
  styleUrl: './todo-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoDetailPage {
  protected readonly store = inject(TodoDetailStore);
  private readonly router = inject(Router);
  protected readonly urls = ROUTE_URLS;

  /** `:id` route param, bound by the router (withComponentInputBinding). */
  readonly id = input.required({ transform: numberAttribute });

  /** Title being edited; reset whenever the loaded todo changes (e.g. after saving). */
  protected readonly titleDraft = linkedSignal(
    () => this.store.todo()?.title ?? ''
  );
  protected readonly newSubtaskTitle = signal('');

  private readonly mutationError = signal<string | null>(null);
  protected readonly error = computed(() => {
    if (this.mutationError()) {
      return this.mutationError();
    }
    if (this.store.notFound()) {
      return 'Úloha neexistuje.';
    }
    return this.store.todoError() ? 'Nepodarilo sa načítať úlohu.' : null;
  });

  constructor() {
    this.store.connectId(this.id);
  }

  protected async saveTitle(todo: TodoDetail): Promise<void> {
    const title = this.titleDraft().trim();
    if (!title || title === todo.title) {
      this.titleDraft.set(todo.title);
      return;
    }
    const result = await this.store.updateTodo({
      id: todo.id,
      changes: { title, completed: todo.completed },
    });
    this.handle(result, 'Úlohu sa nepodarilo uložiť.');
  }

  protected async toggle(todo: TodoDetail): Promise<void> {
    const result = await this.store.updateTodo({
      id: todo.id,
      changes: { title: todo.title, completed: !todo.completed },
    });
    this.handle(result, 'Úlohu sa nepodarilo uložiť.');
  }

  protected async remove(todo: TodoDetail): Promise<void> {
    const result = await this.store.removeTodo(todo.id);
    if (this.handle(result, 'Úlohu sa nepodarilo zmazať.')) {
      // Back to the list with the filter the user came from
      await this.router.navigate([this.urls.todos], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected async addSubtask(todo: TodoDetail, title: string): Promise<void> {
    const result = await this.store.addSubtask({ todoId: todo.id, title });
    // Only if the input still holds the added title: the user may already be typing the next one
    if (
      this.handle(result, 'Podúlohu sa nepodarilo pridať.') &&
      this.newSubtaskTitle().trim() === title
    ) {
      this.newSubtaskTitle.set('');
    }
  }

  protected async toggleSubtask(
    todo: TodoDetail,
    subtask: Subtask
  ): Promise<void> {
    const result = await this.store.updateSubtask({
      todoId: todo.id,
      id: subtask.id,
      changes: { title: subtask.title, completed: !subtask.completed },
    });
    this.handle(result, 'Podúlohu sa nepodarilo uložiť.');
  }

  protected async removeSubtask(
    todo: TodoDetail,
    subtask: Subtask
  ): Promise<void> {
    const result = await this.store.removeSubtask({
      todoId: todo.id,
      id: subtask.id,
    });
    this.handle(result, 'Podúlohu sa nepodarilo zmazať.');
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
