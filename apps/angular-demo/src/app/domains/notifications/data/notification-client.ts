import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { NOTIFICATIONS_API_BASE_URL } from '../../shared/util';
import { listNotifications, markAllNotificationsRead } from './api/functions';
import { NotificationList } from './notification';

/**
 * API of notification-service for the store, through the functions generated from its contract.
 */
@Injectable({ providedIn: 'root' })
export class NotificationClient {
  private readonly http = inject(HttpClient);
  private readonly rootUrl = inject(NOTIFICATIONS_API_BASE_URL);

  /** The newest notifications of the signed-in user and the number of unread ones. */
  list(): Observable<NotificationList> {
    return listNotifications(this.http, this.rootUrl).pipe(map((r) => r.body));
  }

  markAllRead(): Observable<void> {
    return markAllNotificationsRead(this.http, this.rootUrl).pipe(
      map((r) => r.body)
    );
  }
}
