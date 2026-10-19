import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../shared/util';
import { TODO_SORTS, TODO_STATUSES, TodoQuery, TodoSort } from '../util';
import {
  createSubtask,
  createTodo,
  deleteSubtask,
  deleteTodo,
  getTodo,
  listAllTodos,
  listTodos,
  updateSubtask,
  updateTodo,
} from './api/functions';
import { StrictHttpResponse } from './api/strict-http-response';
import {
  AdminTodoPage,
  Subtask,
  SubtaskRequest,
  Todo,
  TodoDetail,
  TodoPage,
  TodoRequest,
} from './todo';

/** `sort` parameter of the API (Spring Data: `property,direction`) for each sort option. */
const API_SORT: Record<TodoSort, string> = {
  [TODO_SORTS.newest]: 'createdAt,desc',
  [TODO_SORTS.oldest]: 'createdAt,asc',
  [TODO_SORTS.titleAsc]: 'title,asc',
  [TODO_SORTS.titleDesc]: 'title,desc',
};

/** The generated functions answer with the whole response; the stores only need the body. */
function body<T>(response: Observable<StrictHttpResponse<T>>): Observable<T> {
  return response.pipe(map((r) => r.body));
}

/**
 * Todo API for the stores. Paths, parameters and types come from the functions generated from
 * the API contract (`./api`); this class maps the domain's query to their parameters and passes
 * `HttpClient` (with the auth interceptor) and the API origin.
 */
@Injectable({ providedIn: 'root' })
export class TodoClient {
  private readonly http = inject(HttpClient);
  private readonly rootUrl = inject(API_BASE_URL);

  /** One page of the signed-in user's todos; filtering, sorting and paging happen on the server. */
  getPage(query: TodoQuery): Observable<TodoPage> {
    return body(
      listTodos(this.http, this.rootUrl, {
        page: query.page,
        sort: API_SORT[query.sort],
        // Defaults are left out of the request
        status: query.status === TODO_STATUSES.all ? undefined : query.status,
        q: query.q || undefined,
      })
    );
  }

  /** One page of all users' todos; the backend answers 403 unless the user has the ADMIN role. */
  getAllOwners(page: number): Observable<AdminTodoPage> {
    return body(listAllTodos(this.http, this.rootUrl, { page }));
  }

  get(id: number): Observable<TodoDetail> {
    return body(getTodo(this.http, this.rootUrl, { id }));
  }

  add(request: TodoRequest): Observable<Todo> {
    return body(createTodo(this.http, this.rootUrl, { body: request }));
  }

  update(id: number, request: TodoRequest): Observable<Todo> {
    return body(updateTodo(this.http, this.rootUrl, { id, body: request }));
  }

  delete(id: number): Observable<void> {
    return body(deleteTodo(this.http, this.rootUrl, { id }));
  }

  addSubtask(todoId: number, request: SubtaskRequest): Observable<Subtask> {
    return body(
      createSubtask(this.http, this.rootUrl, { id: todoId, body: request })
    );
  }

  updateSubtask(
    todoId: number,
    id: number,
    request: SubtaskRequest
  ): Observable<Subtask> {
    return body(
      updateSubtask(this.http, this.rootUrl, {
        id: todoId,
        subtaskId: id,
        body: request,
      })
    );
  }

  deleteSubtask(todoId: number, id: number): Observable<void> {
    return body(
      deleteSubtask(this.http, this.rootUrl, { id: todoId, subtaskId: id })
    );
  }
}
