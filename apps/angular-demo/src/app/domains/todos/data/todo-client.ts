import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../shared/util';
import { Todo, TodoRequest } from './todo';

@Injectable({ providedIn: 'root' })
export class TodoClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/api/todos`;

  getAll(): Observable<Todo[]> {
    return this.http.get<Todo[]>(this.baseUrl);
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
