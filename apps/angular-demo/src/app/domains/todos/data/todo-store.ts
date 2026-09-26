import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  rxMutation,
  withDevtools,
  withMutations,
  withResource,
} from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withProps,
} from '@ngrx/signals';
import { Todo } from './todo';
import { TodoClient } from './todo-client';

export interface TodoChanges {
  title: string;
  completed: boolean;
}

/**
 * State of the todo list: loads all todos once and keeps the list in sync
 * with add / update / remove mutations. Backend access goes through TodoClient.
 */
export const TodoStore = signalStore(
  withDevtools('todos'),
  withProps(() => ({
    _client: inject(TodoClient),
  })),
  withResource((store) => ({
    todos: rxResource({
      stream: () => store._client.getAll(),
      defaultValue: [],
    }),
  })),
  withComputed(({ todosValue }) => {
    const todos = computed(() => todosValue() ?? []);
    return {
      todos,
      remaining: computed(
        () => todos().filter((todo) => !todo.completed).length
      ),
    };
  }),
  withMutations((store) => ({
    addTodo: rxMutation({
      operation: (title: string) => store._client.add({ title }),
      onSuccess: (created: Todo) =>
        patchState(store, { todosValue: [...store.todos(), created] }),
    }),
    updateTodo: rxMutation({
      operation: ({ id, changes }: { id: number; changes: TodoChanges }) =>
        store._client.update(id, changes),
      onSuccess: (updated: Todo) =>
        patchState(store, {
          todosValue: store
            .todos()
            .map((todo) => (todo.id === updated.id ? updated : todo)),
        }),
    }),
    removeTodo: rxMutation({
      operation: (id: number) => store._client.delete(id),
      onSuccess: (_: void, id: number) =>
        patchState(store, {
          todosValue: store.todos().filter((todo) => todo.id !== id),
        }),
    }),
  }))
);
