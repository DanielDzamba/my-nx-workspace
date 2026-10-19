/**
 * Models of the todos domain: the types generated from the API contract
 * (`api-contract/openapi.yaml` → `./api`, `nx generate-api angular-demo`) under domain names.
 * Their docs come from the contract. Never hand-write an API type: change the contract and
 * regenerate.
 */
export type {
  AdminTodoResponse as AdminTodo,
  AdminTodoPage,
  SubtaskResponse as Subtask,
  SubtaskRequest,
  TodoResponse as Todo,
  TodoDetailResponse as TodoDetail,
  TodoSummaryPage as TodoPage,
  TodoRequest,
  TodoSummaryResponse as TodoSummary,
} from './api/models';
