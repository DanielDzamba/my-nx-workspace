// `nx serve` - relative /api calls go through proxy.conf.json to http://localhost:8080
export const environment = {
  apiUrl: '',
  // Same Auth0 application as production; http://localhost:4200/ is an allowed callback URL
  auth0: {
    domain: 'todo-app-todos.eu.auth0.com',
    clientId: 'eVidDv50H7QIzyVYkIMMGJUTdMemENTs',
    audience: 'https://todo-api',
  },
};
