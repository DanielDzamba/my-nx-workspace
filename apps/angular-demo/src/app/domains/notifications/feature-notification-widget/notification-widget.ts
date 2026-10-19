import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../shared/data';
import { ROUTE_URLS } from '../../shared/util';
import { NotificationStore } from '../data';

/**
 * Bell with the number of unread notifications and a panel listing them. Placed in the app shell,
 * so it is on every page; it renders and polls only for a signed-in user.
 */
@Component({
  selector: 'app-notification-widget',
  imports: [DatePipe, RouterLink],
  providers: [NotificationStore],
  templateUrl: './notification-widget.html',
  styleUrl: './notification-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationWidget {
  protected readonly auth = inject(AuthStore);
  protected readonly store = inject(NotificationStore);
  protected readonly urls = ROUTE_URLS;

  protected readonly open = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly bellLabel = computed(() => {
    const unread = this.store.unreadCount();
    return unread ? `Notifikácie, neprečítané: ${unread}` : 'Notifikácie';
  });

  constructor() {
    this.store.connectEnabled(this.auth.isAuthenticated);
  }

  protected toggle(): void {
    this.open.update((open) => !open);
    this.error.set(null);
    if (this.open()) {
      // Fresh list when opened, without waiting for the next poll
      this.store.reload();
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  protected async markAllRead(): Promise<void> {
    const result = await this.store.markAllRead();
    this.error.set(
      result.status === 'error'
        ? 'Notifikácie sa nepodarilo označiť ako prečítané.'
        : null
    );
  }
}
