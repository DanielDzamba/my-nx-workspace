import { Route } from '@angular/router';
import { authGuard } from './domains/shared/data';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./domains/shared/feature-home').then((m) => m.HomePage),
  },
  {
    path: 'todos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./domains/todos/feature-todo-list').then((m) => m.TodoListPage),
  },
  { path: '**', redirectTo: '' },
];
