/**
 * Models of the notifications domain: the types generated from the API contract
 * (`api-contract/openapi.yaml` → `./api`) under domain names. Never hand-write an API type.
 */
export type {
  NotificationList,
  NotificationResponse as Notification,
} from './api/models';

/**
 * Notification types this app can show. The contract may add new ones; the store drops types
 * that are not listed here instead of showing something it cannot describe.
 */
export const NOTIFICATION_TYPES = {
  todoCompleted: 'TODO_COMPLETED',
} as const;
