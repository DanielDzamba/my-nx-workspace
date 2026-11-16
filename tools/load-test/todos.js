// Load test of https://api.tododan.life as the Auth0 test user loadtest@tododan.life.
// Run with `node tools/load-test/run.mjs [profile]` (reads secrets.env); see README.md.
//
// One virtual user (VU) behaves like a person in the app: open the list, now and then create a
// todo, complete it (java-api → outbox → RabbitMQ → notification-service) and delete it again,
// then pause ~1 s. All VUs share the test user, so the data stays out of real users' lists, and
// every todo created here is deleted in the same iteration.
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'https://api.tododan.life';

// Profiles: how many VUs over time. `smoke` checks the script; `ramp` climbs in steps, each held
// long enough to fill the 4-minute rate() window of the Grafana dashboard.
const PROFILES = {
  smoke: [
    { duration: '30s', target: 5 },
    { duration: '30s', target: 5 },
  ],
  ramp: [
    { duration: '1m', target: 50 },
    { duration: '4m', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '4m', target: 200 },
    { duration: '1m', target: 500 },
    { duration: '4m', target: 500 },
    { duration: '1m', target: 0 },
  ],
};

const PROFILE = __ENV.PROFILE || 'smoke';
// Share of iterations that create, complete and delete a todo (the rest only read the list)
const WRITE_RATIO = PROFILE === 'smoke' ? 0.3 : 0.1;

export const options = {
  stages: PROFILES[PROFILE],
  // Reported at the end (and marked ✓/✗); they do not stop the test
  thresholds: {
    http_req_failed: ['rate<0.01'], // under 1 % failed requests
    'http_req_duration{name:list}': ['p(95)<500'], // the list answers in 0.5 s for 95 %
  },
};

// Runs once before the VUs start: one token for all of them (Auth0 rate-limits /oauth/token)
export function setup() {
  const response = http.post(
    `https://${__ENV.AUTH0_DOMAIN}/oauth/token`,
    JSON.stringify({
      grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
      realm: 'Username-Password-Authentication',
      username: __ENV.LOADTEST_USER,
      password: __ENV.LOADTEST_PASSWORD,
      client_id: __ENV.AUTH0_CLIENT_ID,
      client_secret: __ENV.AUTH0_CLIENT_SECRET,
      audience: 'https://todo-api',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (response.status !== 200) {
    throw new Error(
      `Auth0 token request failed: ${response.status} ${response.body}`
    );
  }
  return { token: response.json('access_token') };
}

export default function (data) {
  const params = (name) => ({
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
    tags: { name }, // groups the URLs with ids into one line in the results
  });

  const list = http.get(`${API}/api/todos?size=20`, params('list'));
  check(list, { 'list 200': (r) => r.status === 200 });

  // Some iterations write: create → complete → delete. Every completion is a RabbitMQ message, and
  // the CloudAMQP free plan has a monthly message quota, so the big profiles write less.
  if (Math.random() < WRITE_RATIO) {
    const created = http.post(
      `${API}/api/todos`,
      JSON.stringify({ title: `[load-test] VU ${__VU} iteration ${__ITER}` }),
      params('create')
    );
    if (check(created, { 'create 201': (r) => r.status === 201 })) {
      const id = created.json('id');
      const completed = http.put(
        `${API}/api/todos/${id}`,
        JSON.stringify({ title: created.json('title'), completed: true }),
        params('complete')
      );
      check(completed, { 'complete 200': (r) => r.status === 200 });
      const deleted = http.del(
        `${API}/api/todos/${id}`,
        null,
        params('delete')
      );
      check(deleted, { 'delete 204': (r) => r.status === 204 });
    }
  }

  sleep(1); // think time: a person does not click without pause
}
