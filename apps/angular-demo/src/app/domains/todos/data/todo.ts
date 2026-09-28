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

/** A todo in the admin overview of all users' todos. */
export interface AdminTodo extends Todo {
  /** Auth0 user ID of the owner; `legacy` for todos created before login existed. */
  ownerId: string;
}
