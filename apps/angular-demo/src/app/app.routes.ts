import { Route } from '@angular/router';
import { ROLES, authGuard, roleGuard } from './domains/shared/data';
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
  {
    path: ROUTE_PATHS.todoDetail,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./domains/todos/feature-todo-detail').then(
        (m) => m.TodoDetailPage
      ),
  },
  {
    path: ROUTE_PATHS.adminTodos,
    canActivate: [roleGuard(ROLES.admin)],
    loadComponent: () =>
      import('./domains/todos/feature-admin-todo-list').then(
        (m) => m.AdminTodoListPage
      ),
  },
  { path: '**', redirectTo: ROUTE_PATHS.home },
];
