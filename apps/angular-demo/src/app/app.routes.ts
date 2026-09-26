import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./domains/todos/feature-todo-list').then((m) => m.TodoListPage),
  },
  { path: '**', redirectTo: '' },
];
