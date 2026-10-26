import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Pager } from '../../shared/ui';
import { ROUTE_URLS, pageParam, parsePageParam } from '../../shared/util';
import { AdminUserStore, User } from '../data';

/**
 * All users who have signed in, for admins: block or unblock them. The route is guarded by
 * `roleGuard(ROLES.admin)`; a blocked user gets 403 on their next request.
 */
@Component({
  selector: 'app-admin-user-list-page',
  imports: [DatePipe, RouterLink, Pager],
  providers: [AdminUserStore],
  templateUrl: './admin-user-list-page.html',
  styleUrl: './admin-user-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserListPage {
  protected readonly store = inject(AdminUserStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly urls = ROUTE_URLS;

  /** One-based `?page=` query param, bound by the router. */
  readonly page = input<string>();
  protected readonly pageIndex = computed(() => parsePageParam(this.page()));

  private readonly changeError = signal<string | null>(null);
  protected readonly error = computed(
    () =>
      this.changeError() ??
      (this.store.userPageError()
        ? 'Nepodarilo sa načítať používateľov.'
        : null)
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

  protected async toggleBlocked(user: User): Promise<void> {
    const result = await this.store.setBlocked({
      id: user.id,
      blocked: !user.blocked,
    });
    if (result.status === 'error') {
      this.changeError.set(
        result.error instanceof HttpErrorResponse &&
          result.error.status === HttpStatusCode.Conflict
          ? 'Seba zablokovať nemôžeš.'
          : 'Zmenu sa nepodarilo uložiť.'
      );
    }
    if (result.status === 'success') {
      this.changeError.set(null);
    }
  }
}
