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
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { TodoQuery } from '../util';
import { TodoClient } from './todo-client';

export interface TodoChanges {
  title: string;
  completed: boolean;
}

/**
 * State of the paged todo list. The `query` (filter, sort, page) comes from the URL via
 * `connectQuery`; every change loads the matching page from the server. After a mutation the
 * current page is reloaded, because where a todo belongs (which page, whether it still matches
 * the filter) is decided by the server.
 */
export const TodoStore = signalStore(
  withDevtools('todos'),
  // null until connectQuery: loading the default list first would be a wasted request
  withState<{ query: TodoQuery | null }>({ query: null }),
  withProps(() => ({
    _client: inject(TodoClient),
  })),
  withResource((store) => ({
    todoPage: rxResource({
      // undefined keeps the resource idle
      params: () => store.query() ?? undefined,
      stream: ({ params }) => store._client.getPage(params),
    }),
  })),
  withComputed(({ todoPageValue }) => ({
    todos: computed(() => todoPageValue()?.content ?? []),
    totalElements: computed(() => todoPageValue()?.page.totalElements ?? 0),
    totalPages: computed(() => todoPageValue()?.page.totalPages ?? 0),
  })),
  withMethods((store) => ({
    /** Follows a signal of the query (e.g. derived from the route's query params). */
    connectQuery: signalMethod<TodoQuery>((query) =>
      patchState(store, { query })
    ),
    _reload: () => store._todoPageReload(),
  })),
  withMutations((store) => ({
    addTodo: rxMutation({
      operation: (title: string) => store._client.add({ title }),
      onSuccess: () => store._reload(),
    }),
    updateTodo: rxMutation({
      operation: ({ id, changes }: { id: number; changes: TodoChanges }) =>
        store._client.update(id, changes),
      onSuccess: () => store._reload(),
    }),
    removeTodo: rxMutation({
      operation: (id: number) => store._client.delete(id),
      onSuccess: () => store._reload(),
    }),
  }))
);
