import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../shared/util';
import { AdminTodo, Todo, TodoRequest } from './todo';

@Injectable({ providedIn: 'root' })
export class TodoClient {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiUrl}/api/todos`;

  /** Todos of the signed-in user. */
  getAll(): Observable<Todo[]> {
    return this.http.get<Todo[]>(this.baseUrl);
  }

  /** Todos of all users; the backend answers 403 unless the user has the ADMIN role. */
  getAllOwners(): Observable<AdminTodo[]> {
    return this.http.get<AdminTodo[]>(`${this.apiUrl}/api/admin/todos`);
  }

  get(id: number): Observable<Todo> {
    return this.http.get<Todo>(`${this.baseUrl}/${id}`);
  }

  add(request: TodoRequest): Observable<Todo> {
    return this.http.post<Todo>(this.baseUrl, request);
  }

  update(id: number, request: TodoRequest): Observable<Todo> {
    return this.http.put<Todo>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
