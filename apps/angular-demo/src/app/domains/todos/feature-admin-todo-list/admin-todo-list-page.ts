import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ROUTE_URLS } from '../../shared/util';
import { AdminTodoStore } from '../data';

/** Read-only overview of all users' todos; the route is guarded by `roleGuard(ROLES.admin)`. */
@Component({
  selector: 'app-admin-todo-list-page',
  imports: [DatePipe, RouterLink],
  providers: [AdminTodoStore],
  templateUrl: './admin-todo-list-page.html',
  styleUrl: './admin-todo-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTodoListPage {
  protected readonly store = inject(AdminTodoStore);
  protected readonly urls = ROUTE_URLS;

  protected readonly error = computed(() =>
    this.store.todosError()
      ? 'Nepodarilo sa načítať úlohy všetkých používateľov.'
      : null
  );
}
