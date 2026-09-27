import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';
import { authInterceptors, authProviders } from './auth.providers';
import { API_BASE_URL } from './domains/shared/util';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors(authInterceptors)),
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    ...authProviders,
  ],
};
