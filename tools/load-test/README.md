# Load test (k6)

Virtual users against production (https://api.tododan.life), logged in as the Auth0 test user
`loadtest@tododan.life`, so the data stays out of real users' lists. Every todo a test creates is
deleted in the same iteration. There is no staging environment: the app has no real users, and a
second environment would double the cost. In a company this would run against staging.

```
node tools/load-test/run.mjs          # smoke: 5 VUs, 1 minute, checks the script
node tools/load-test/run.mjs ramp     # 50 → 200 → 500 VUs, each held 4 minutes, ~16 minutes
```

Watch the Grafana dashboard _Todo – services_ meanwhile (`infra/terraform/gke/README.md`). Each
step is held 4 minutes because the dashboard's `rate()` averages over about 4 minutes.

## One virtual user

List the todos (`GET /api/todos?size=20`); in 30 % (smoke) or 10 % (ramp) of the iterations create
a todo, complete it (an event through RabbitMQ to notification-service) and delete it; pause 1 s.
The ramp writes less because every completion is a CloudAMQP message, and the free plan has a
monthly quota.

## Setup (once)

- Auth0: application **k6 load test** (Regular Web Application, grant type _Password_ only,
  connection _Username-Password-Authentication_ only, user-delegated access to the Todo API) and
  the user `loadtest@tododan.life` in that connection. Password grant is for test tooling only.
- `winget install GrafanaLabs.k6`
- Copy `secrets.env.example` to `secrets.env` (git-ignored) and fill in the client secret and the
  test user's password. `run.mjs` passes them to k6 as environment variables.

## Results

| Date       | Setup                                   | 500 VUs: req/s | p95   | failed | Bottleneck      |
| ---------- | --------------------------------------- | -------------- | ----- | ------ | --------------- |
| 2026-11-16 | 3 fixed java-api pods, 100m CPU request | ~200 (ceiling) | 6.9 s | 0.06 % | CPU of one node |

Test A in detail: two java-api pods ran on the same shared-core e2-medium node (about one core
sustained). Both used ~0.8 cores, so the node was saturated, requests held their database
connection for ~180 ms instead of ~13 ms, the pools (10 per pod) ran out and up to ~250 requests
waited for a connection. The third pod, alone on the other node, stayed at 13 ms with no waits:
the database was not the bottleneck, the full pool was a symptom. Memory reached 488 of 512 MiB.
Consequences: CPU request 500m (realistic), HPA 2–5 pods, up to 5 nodes.
