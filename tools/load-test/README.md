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

| Date       | Setup                                             | 500 VUs: req/s | p95    | failed | Bottleneck                      |
| ---------- | ------------------------------------------------- | -------------- | ------ | ------ | ------------------------------- |
| 2026-11-16 | A: 3 fixed java-api pods, 100m CPU request        | ~200 (ceiling) | 6.9 s  | 0.06 % | CPU of one node                 |
| 2026-11-17 | B: HPA 2–5, 500m request, e2-medium (max 5 nodes) | ~390           | 1.41 s | 0.00 % | node size: only 3 of 5 pods fit |
| 2026-11-17 | C: as B on e2-standard-2 (2–3 nodes)              | ~540           | 0.15 s | 0.00 % | none reached                    |

Test A in detail: two java-api pods ran on the same shared-core e2-medium node (about one core
sustained). Both used ~0.8 cores, so the node was saturated, requests held their database
connection for ~180 ms instead of ~13 ms, the pools (10 per pod) ran out and up to ~250 requests
waited for a connection. The third pod, alone on the other node, stayed at 13 ms with no waits:
the database was not the bottleneck, the full pool was a symptom. Memory reached 488 of 512 MiB.
Consequences: CPU request 500m (realistic), HPA 2–5 pods, up to 5 nodes.

Test B: throughput doubled and errors disappeared, but at 500 VUs p95 was still 1.3–1.9 s. The HPA
asked for 5 pods within a minute of crossing 70 % CPU and the Cluster Autoscaler grew to its
maximum of 5 nodes, yet 2 pods stayed Pending the whole test ("Insufficient cpu", "max node group
size reached"): an e2-medium leaves ~940m for pods, the small pods (notification-service, Redis,
Grafana, system pods) took enough on two nodes that no 500m slot was left there, and those two
nodes idled at ~0.17 cores. Spare CPU fragmented over small nodes; the same effect later blocked a
rollout. Consequences: PodDisruptionBudgets and hard topology spread, then e2-standard-2.

Test C: 2 nodes at rest; the HPA went 2 → 5 pods within about 2 minutes of the load rising, the
Cluster Autoscaler added a third node, and no pod waited for a connection (pool max 10 per pod,
at most 7 in use across all pods). p95 stayed at 50 ms up to ~190 req/s and 150 ms at ~540 req/s;
memory peaked at 424 of 512 MiB. Every threshold passed.
