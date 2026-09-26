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
