import { InjectionToken } from '@angular/core';

/**
 * Origin of the backend API, e.g. `https://java-api.example.com`.
 * Empty string means same origin (the dev server proxies `/api`).
 * Provided by the app shell from `environment.apiUrl`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '',
});
