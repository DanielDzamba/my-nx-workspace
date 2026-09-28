import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore, ROLES } from '../data';
import { ROUTE_URLS } from '../util';

/** Public landing page: explains the app and starts the Auth0 login. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly auth = inject(AuthStore);
  protected readonly urls = ROUTE_URLS;
  protected readonly roles = ROLES;
}
