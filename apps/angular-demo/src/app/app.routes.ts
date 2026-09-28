import { Route } from '@angular/router';
import { authGuard } from './domains/shared/data';
import { ROUTE_PATHS } from './domains/shared/util';

export const appRoutes: Route[] = [
  {
    path: ROUTE_PATHS.home,
    pathMatch: 'full',
    loadComponent: () =>
      import('./domains/shared/feature-home').then((m) => m.HomePage),
  },
  {
    path: ROUTE_PATHS.todos,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./domains/todos/feature-todo-list').then((m) => m.TodoListPage),
  },
  { path: '**', redirectTo: ROUTE_PATHS.home },
];
