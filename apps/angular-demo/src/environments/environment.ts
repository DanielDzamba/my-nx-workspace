// Production build (GitHub Pages). Pages hosts only static files; java-api and notification-service
// run on GKE behind one Gateway (k8s/overlays/prod), which routes /api/notifications/... to
// notification-service and every other /api/... to java-api. Hence the same URL twice.
export const environment = {
  apiUrl: 'https://api.tododan.life',
  notificationsApiUrl: 'https://api.tododan.life',
  // Auth0 SPA settings; public by design (a SPA has no client secret)
  auth0: {
    domain: 'todo-app-todos.eu.auth0.com',
    clientId: 'eVidDv50H7QIzyVYkIMMGJUTdMemENTs',
    audience: 'https://todo-api',
  },
};
