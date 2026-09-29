export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface TodoRequest {
  title: string;
  completed?: boolean;
}

/** A todo in the paged list, with how far its subtasks are. */
export interface TodoSummary extends Todo {
  subtaskCount: number;
  completedSubtaskCount: number;
}

export interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

export type SubtaskRequest = TodoRequest;

/** One todo with its subtasks (`GET /api/todos/{id}`). */
export interface TodoDetail extends Todo {
  subtasks: Subtask[];
}

/** A todo in the admin overview of all users' todos. */
export interface AdminTodo extends Todo {
  /** Auth0 user ID of the owner; `legacy` for todos created before login existed. */
  ownerId: string;
}

/** One page of a list, as Spring Data's `PagedModel` serializes it. */
export interface Page<T> {
  content: T[];
  page: {
    size: number;
    /** Zero-based. */
    number: number;
    totalElements: number;
    totalPages: number;
  };
}
