import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTE_URLS } from '../../shared/util';
import { AdminTodoStore } from '../data';
import { Pager } from '../ui';
import { pageParam, parsePageParam } from '../util';

/** Read-only overview of all users' todos; the route is guarded by `roleGuard(ROLES.admin)`. */
@Component({
  selector: 'app-admin-todo-list-page',
  imports: [DatePipe, RouterLink, Pager],
  providers: [AdminTodoStore],
  templateUrl: './admin-todo-list-page.html',
  styleUrl: './admin-todo-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTodoListPage {
  protected readonly store = inject(AdminTodoStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly urls = ROUTE_URLS;

  /** One-based `?page=` query param, bound by the router. */
  readonly page = input<string>();
  protected readonly pageIndex = computed(() => parsePageParam(this.page()));

  protected readonly error = computed(() =>
    this.store.todoPageError()
      ? 'Nepodarilo sa načítať úlohy všetkých používateľov.'
      : null
  );

  constructor() {
    this.store.connectPage(this.pageIndex);
  }

  protected goToPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: pageParam(page) },
    });
  }
}
