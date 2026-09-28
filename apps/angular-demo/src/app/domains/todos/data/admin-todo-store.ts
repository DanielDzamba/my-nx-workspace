import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { TodoClient } from './todo-client';

/** Read-only overview of all users' todos for admins (`GET /api/admin/todos`). */
export const AdminTodoStore = signalStore(
  withDevtools('admin-todos'),
  withProps(() => ({
    _client: inject(TodoClient),
  })),
  withResource((store) => ({
    todos: rxResource({
      stream: () => store._client.getAllOwners(),
      defaultValue: [],
    }),
  })),
  withComputed(({ todosValue }) => {
    const todos = computed(() => todosValue() ?? []);
    return {
      todos,
      ownerCount: computed(
        () => new Set(todos().map((todo) => todo.ownerId)).size
      ),
    };
  })
);
