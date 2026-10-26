# api-contract

The REST API of `java-api`, described in [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0). It is the
**single source of truth** for the API (design-first / API-first): backend and frontend code is
generated from it, never the other way round.

```
                          api-contract/openapi.yaml
                         /                         \
   mvn compile (generate-sources)          nx generate-api angular-demo
   openapi-generator-maven-plugin          ng-openapi-gen
                |                                    |
   TodosApi, AdminApi, UsersApi,           fn/* functions + models, per domain:
   NotificationsApi, HelloApi              apps/angular-demo/src/app/domains/<domain>/data/api
   + request/response DTOs                 (tags per ng-openapi-gen*.json, git-ignored)
   apps/java-api/target/generated-sources
                |                                    |
   TodoController implements TodosApi      TodoClient calls the functions
```

Generated code is never committed and never edited. Both generators run automatically: Maven
before every compile, Nx before `build`, `serve`, `test`, `typecheck` and `lint` of `angular-demo`
(`dependsOn: ["generate-api"]`).

## Adding or changing an endpoint

1. **Contract.** Edit `openapi.yaml`: path, `operationId` (becomes the method name on both
   sides), `tags` (`todos` → `TodosApi`), parameters, request body, every response including errors,
   and the schemas with `required` fields (otherwise they are optional in TypeScript).
   `npx nx lint api-contract` checks the file (Redocly, `recommended-strict`).
2. **Review.** The contract change can be its own PR, so backend and frontend agree on the API
   before anyone implements it. CI fails on breaking changes against `main` (oasdiff).
3. **Backend.** `npx nx build java-api` (or any `mvn compile`) regenerates the interface. The
   controller no longer compiles until it implements the new method; implement it there. In the IDE,
   reload the Maven project so it sees `target/generated-sources/openapi`.
4. **Frontend.** `npx nx generate-api angular-demo` (also runs on `serve`/`test`/`build`). Add the
   call to the domain client (`TodoClient`) and, if needed, a type alias in `data/todo.ts`. A new
   tag goes into the `includeTags` of the domain's `ng-openapi-gen*.json` (a new domain gets its
   own config and a command in the `generate-api` target).
   The frontend does not wait for the backend: its unit tests flush mocked responses typed by the
   generated models.

## Rules

- **Additive changes** keep old clients working: a new endpoint, a new optional parameter, a new
  response field. Removing or renaming fields, making something required or changing a type is a
  breaking change: it needs a new version of the endpoint, not an edit of the old one.
- Request and response DTOs exist only in the contract. Do not write Java records or TypeScript
  interfaces for API types by hand; entities never leave the service (`TodoMapper`).
- Errors with a body are `ProblemDetail` (RFC 9457, `application/problem+json`); 401 and 403 come
  from Spring Security without a body.
- Defaults belong in the contract (e.g. `size` default 10): the generator turns them into
  `@PageableDefault` / `@RequestParam(defaultValue = ...)`.

## Viewing it

- Swagger UI: http://localhost:8080/swagger-ui.html (with `npx nx serve java-api`). It shows this
  file, served by the app as `/openapi.yaml`. To try a request, click **Authorize** and paste an
  Auth0 access token (DevTools → Network → any `/api` request → `Authorization` header, without
  `Bearer `). Swagger UI is off in production (`SPRINGDOC_SWAGGER_UI_ENABLED=false` in
  `render.yaml`).
- Or open `openapi.yaml` in an editor with an OpenAPI preview (e.g. the Redocly VS Code extension).
