import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../shared/util';
import { TODO_SORTS, TODO_STATUSES, TodoQuery, TodoSort } from '../util';
import {
  AdminTodo,
  Page,
  Subtask,
  SubtaskRequest,
  Todo,
  TodoDetail,
  TodoRequest,
  TodoSummary,
} from './todo';

/** `sort` parameter of the API (Spring Data: `property,direction`) for each sort option. */
const API_SORT: Record<TodoSort, string> = {
  [TODO_SORTS.newest]: 'createdAt,desc',
  [TODO_SORTS.oldest]: 'createdAt,asc',
  [TODO_SORTS.titleAsc]: 'title,asc',
  [TODO_SORTS.titleDesc]: 'title,desc',
};

@Injectable({ providedIn: 'root' })
export class TodoClient {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiUrl}/api/todos`;

  /** One page of the signed-in user's todos; filtering, sorting and paging happen on the server. */
  getPage(query: TodoQuery): Observable<Page<TodoSummary>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('sort', API_SORT[query.sort]);
    if (query.status !== TODO_STATUSES.all) {
      params = params.set('status', query.status);
    }
    if (query.q) {
      params = params.set('q', query.q);
    }
    return this.http.get<Page<TodoSummary>>(this.baseUrl, { params });
  }

  /** One page of all users' todos; the backend answers 403 unless the user has the ADMIN role. */
  getAllOwners(page: number): Observable<Page<AdminTodo>> {
    return this.http.get<Page<AdminTodo>>(`${this.apiUrl}/api/admin/todos`, {
      params: { page },
    });
  }

  get(id: number): Observable<TodoDetail> {
    return this.http.get<TodoDetail>(`${this.baseUrl}/${id}`);
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

  addSubtask(todoId: number, request: SubtaskRequest): Observable<Subtask> {
    return this.http.post<Subtask>(
      `${this.baseUrl}/${todoId}/subtasks`,
      request
    );
  }

  updateSubtask(
    todoId: number,
    id: number,
    request: SubtaskRequest
  ): Observable<Subtask> {
    return this.http.put<Subtask>(
      `${this.baseUrl}/${todoId}/subtasks/${id}`,
      request
    );
  }

  deleteSubtask(todoId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${todoId}/subtasks/${id}`);
  }
}
