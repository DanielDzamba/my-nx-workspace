// Production build (GitHub Pages). Pages hosts only static files; java-api runs on Render (render.yaml).
export const environment = {
  apiUrl: 'https://danieldzamba-java-api.onrender.com',
  // Auth0 SPA settings; public by design (a SPA has no client secret)
  auth0: {
    domain: 'todo-app-todos.eu.auth0.com',
    clientId: 'eVidDv50H7QIzyVYkIMMGJUTdMemENTs',
    audience: 'https://todo-api',
  },
};
