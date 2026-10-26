import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../data';

/** Where `blockedUserInterceptor` sends a user whom an admin has blocked. */
@Component({
  selector: 'app-account-blocked-page',
  templateUrl: './account-blocked-page.html',
  styleUrl: './account-blocked-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountBlockedPage {
  protected readonly auth = inject(AuthStore);
}
