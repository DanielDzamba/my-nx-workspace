import { computed, inject } from '@angular/core';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  rxMutation,
  withDevtools,
  withMutations,
  withResource,
} from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { Subtask, TodoDetail } from './todo';
import { TodoClient } from './todo-client';
import type { TodoChanges } from './todo-store';

/**
 * A resource hands out non-`Error` failures (like `HttpErrorResponse`) wrapped, with the
 * original as `cause`.
 */
function httpStatus(error: unknown): number | undefined {
  const cause =
    error instanceof HttpErrorResponse
      ? error
      : (error as { cause?: unknown } | undefined)?.cause;
  return cause instanceof HttpErrorResponse ? cause.status : undefined;
}

/**
 * One todo with its subtasks, keyed by the id from the route (`connectId`). Mutations apply the
 * server's answer to the loaded detail instead of reloading it.
 */
export const TodoDetailStore = signalStore(
  withDevtools('todo-detail'),
  withState<{ id: number | null }>({ id: null }),
  withProps(() => ({
    _client: inject(TodoClient),
  })),
  withResource((store) => ({
    todo: rxResource({
      // undefined keeps the resource idle until an id is known
      params: () => store.id() ?? undefined,
      stream: ({ params: id }) => store._client.get(id),
    }),
  })),
  withComputed(({ todoValue, todoError }) => ({
    todo: computed(() => todoValue()),
    /** Missing or someone else's todo: the API answers 404 for both. */
    notFound: computed(
      () => httpStatus(todoError()) === HttpStatusCode.NotFound
    ),
  })),
  withMethods((store) => ({
    connectId: signalMethod<number>((id) => patchState(store, { id })),
    _patchTodo: (update: (todo: TodoDetail) => TodoDetail) => {
      const todo = store.todo();
      if (todo) {
        patchState(store, { todoValue: update(todo) });
      }
    },
  })),
  withMutations((store) => ({
    updateTodo: rxMutation({
      operation: ({ id, changes }: { id: number; changes: TodoChanges }) =>
        store._client.update(id, changes),
      onSuccess: (updated) =>
        store._patchTodo((todo) => ({ ...todo, ...updated })),
    }),
    removeTodo: rxMutation({
      operation: (id: number) => store._client.delete(id),
    }),
    addSubtask: rxMutation({
      operation: ({ todoId, title }: { todoId: number; title: string }) =>
        store._client.addSubtask(todoId, { title }),
      onSuccess: (created: Subtask) =>
        store._patchTodo((todo) => ({
          ...todo,
          subtasks: [...todo.subtasks, created],
        })),
    }),
    updateSubtask: rxMutation({
      operation: ({
        todoId,
        id,
        changes,
      }: {
        todoId: number;
        id: number;
        changes: TodoChanges;
      }) => store._client.updateSubtask(todoId, id, changes),
      onSuccess: (updated: Subtask) =>
        store._patchTodo((todo) => ({
          ...todo,
          subtasks: todo.subtasks.map((subtask) =>
            subtask.id === updated.id ? updated : subtask
          ),
        })),
    }),
    removeSubtask: rxMutation({
      operation: ({ todoId, id }: { todoId: number; id: number }) =>
        store._client.deleteSubtask(todoId, id),
      onSuccess: (_: void, { id }) =>
        store._patchTodo((todo) => ({
          ...todo,
          subtasks: todo.subtasks.filter((subtask) => subtask.id !== id),
        })),
    }),
  }))
);
