import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./todos/todo-list').then((m) => m.TodoList),
  },
  { path: '**', redirectTo: '' },
];
