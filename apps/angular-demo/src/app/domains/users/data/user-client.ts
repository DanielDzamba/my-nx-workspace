import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../shared/util';
import { listUsers, setUserBlocked } from './api/functions';
import { User, UserPage } from './user';

/**
 * User API for the stores, through the functions generated from the API contract. Every call
 * needs the ADMIN role; the backend answers 403 otherwise.
 */
@Injectable({ providedIn: 'root' })
export class UserClient {
  private readonly http = inject(HttpClient);
  private readonly rootUrl = inject(API_BASE_URL);

  /** One page of all users, newest first. */
  getPage(page: number): Observable<UserPage> {
    return listUsers(this.http, this.rootUrl, { page }).pipe(
      map((r) => r.body)
    );
  }

  /** The generated function URL-encodes the ID (`auth0|1` → `auth0%7C1`). */
  setBlocked(id: string, blocked: boolean): Observable<User> {
    return setUserBlocked(this.http, this.rootUrl, {
      userId: id,
      body: { blocked },
    }).pipe(map((r) => r.body));
  }
}
