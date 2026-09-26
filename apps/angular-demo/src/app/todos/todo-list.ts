import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Todo, TodoService } from './todo.service';

@Component({
  selector: 'app-todo-list',
  imports: [FormsModule],
  templateUrl: './todo-list.html',
  styleUrl: './todo-list.css',
})
export class TodoList implements OnInit {
  private readonly todoService = inject(TodoService);

  protected readonly todos = signal<Todo[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly editingId = signal<number | null>(null);
  protected readonly remaining = computed(
    () => this.todos().filter((todo) => !todo.completed).length
  );

  protected newTitle = '';
  protected editTitle = '';

  ngOnInit(): void {
    this.todoService.getAll().subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Nepodarilo sa načítať úlohy. Beží backend?');
        this.loading.set(false);
      },
    });
  }

  protected add(): void {
    const title = this.newTitle.trim();
    if (!title) {
      return;
    }
    this.todoService.add({ title }).subscribe({
      next: (todo) => {
        this.todos.update((todos) => [...todos, todo]);
        this.newTitle = '';
        this.error.set(null);
      },
      error: () => this.error.set('Úlohu sa nepodarilo pridať.'),
    });
  }

  protected toggle(todo: Todo): void {
    this.save(todo, { title: todo.title, completed: !todo.completed });
  }

  protected startEdit(todo: Todo): void {
    this.editingId.set(todo.id);
    this.editTitle = todo.title;
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected saveEdit(todo: Todo): void {
    const title = this.editTitle.trim();
    if (!title || title === todo.title) {
      this.cancelEdit();
      return;
    }
    this.save(todo, { title, completed: todo.completed });
  }

  protected remove(todo: Todo): void {
    this.todoService.delete(todo.id).subscribe({
      next: () => {
        this.todos.update((todos) => todos.filter((t) => t.id !== todo.id));
        this.error.set(null);
      },
      error: () => this.error.set('Úlohu sa nepodarilo zmazať.'),
    });
  }

  private save(todo: Todo, request: { title: string; completed: boolean }): void {
    this.todoService.update(todo.id, request).subscribe({
      next: (updated) => {
        this.todos.update((todos) =>
          todos.map((t) => (t.id === updated.id ? updated : t))
        );
        this.editingId.set(null);
        this.error.set(null);
      },
      error: () => this.error.set('Úlohu sa nepodarilo uložiť.'),
    });
  }
}
