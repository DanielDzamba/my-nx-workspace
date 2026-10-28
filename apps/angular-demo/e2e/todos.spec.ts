import { test, expect, type Page, type Route } from '@playwright/test';

interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
  version: number;
  subtasks: Subtask[];
}

interface Notification {
  id: number;
  type: 'TODO_COMPLETED';
  todoId: number;
  todoTitle: string;
  createdAt: string;
  read: boolean;
}

const PAGE_SIZE = 10;

/**
 * In-memory stand-in for java-api, so the e2e run needs neither the backend nor PostgreSQL.
 * Implements what the frontend uses: paged list with status and title filter (newest first),
 * detail with subtasks, the mutations, and the notifications that completing a todo creates
 * (on the real backend asynchronously, via RabbitMQ).
 */
async function mockTodoApi(
  page: Page,
  initial: Omit<Todo, 'subtasks' | 'version'>[] = []
): Promise<void> {
  const todos: Todo[] = initial.map((todo) => ({
    ...todo,
    version: 0,
    subtasks: [],
  }));
  let nextId = Math.max(0, ...todos.map((t) => t.id)) + 1;
  const notifications: Notification[] = [];

  function listPage(url: URL) {
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';
    const number = Number(url.searchParams.get('page') ?? 0);
    const matching = todos
      .filter((t) => status !== 'active' || !t.completed)
      .filter((t) => status !== 'completed' || t.completed)
      .filter((t) => t.title.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return {
      content: matching
        .slice(number * PAGE_SIZE, (number + 1) * PAGE_SIZE)
        .map(({ subtasks, ...todo }) => ({
          ...todo,
          subtaskCount: subtasks.length,
          completedSubtaskCount: subtasks.filter((s) => s.completed).length,
        })),
      page: {
        size: PAGE_SIZE,
        number,
        totalElements: matching.length,
        totalPages: Math.ceil(matching.length / PAGE_SIZE),
      },
    };
  }

  function withoutSubtasks(todo: Todo): Omit<Todo, 'subtasks'> {
    const { id, title, completed, createdAt, version } = todo;
    return { id, title, completed, createdAt, version };
  }

  async function handleSubtask(route: Route, todo: Todo, subtaskId?: number) {
    const request = route.request();
    const index = todo.subtasks.findIndex((s) => s.id === subtaskId);
    switch (request.method()) {
      case 'POST': {
        const subtask: Subtask = {
          id: nextId++,
          completed: false,
          createdAt: new Date().toISOString(),
          ...request.postDataJSON(),
        };
        todo.subtasks.push(subtask);
        return route.fulfill({ status: 201, json: subtask });
      }
      case 'PUT':
        todo.subtasks[index] = {
          ...todo.subtasks[index],
          ...request.postDataJSON(),
        };
        return route.fulfill({ json: todo.subtasks[index] });
      case 'DELETE':
        todo.subtasks.splice(index, 1);
        return route.fulfill({ status: 204 });
      default:
        return route.fallback();
    }
  }

  await page.route('**/api/todos**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // /api/todos[/{id}[/subtasks[/{subtaskId}]]]
    const [, , id, subtasks, subtaskId] = url.pathname
      .split('/')
      .filter(Boolean);
    const index = todos.findIndex((t) => t.id === Number(id));

    if (subtasks) {
      return handleSubtask(route, todos[index], Number(subtaskId));
    }
    switch (request.method()) {
      case 'GET':
        if (!id) {
          return route.fulfill({ json: listPage(url) });
        }
        return index < 0
          ? route.fulfill({ status: 404 })
          : route.fulfill({ json: todos[index] });
      case 'POST': {
        const todo: Todo = {
          id: nextId++,
          completed: false,
          createdAt: new Date().toISOString(),
          subtasks: [],
          ...request.postDataJSON(),
          version: 0,
        };
        todos.push(todo);
        return route.fulfill({ status: 201, json: withoutSubtasks(todo) });
      }
      case 'PUT': {
        const { version, ...changes } = request.postDataJSON();
        // Optimistic locking: a change based on an outdated version is rejected
        if (version !== undefined && version !== todos[index].version) {
          return route.fulfill({ status: 409 });
        }
        const wasCompleted = todos[index].completed;
        todos[index] = {
          ...todos[index],
          ...changes,
          version: todos[index].version + 1,
        };
        if (!wasCompleted && todos[index].completed) {
          notifications.unshift({
            id: nextId++,
            type: 'TODO_COMPLETED',
            todoId: todos[index].id,
            todoTitle: todos[index].title,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
        return route.fulfill({ json: withoutSubtasks(todos[index]) });
      }
      case 'DELETE':
        todos.splice(index, 1);
        return route.fulfill({ status: 204 });
      default:
        return route.fallback();
    }
  });

  await page.route('**/api/notifications**', (route) => {
    if (route.request().method() === 'POST') {
      // POST /api/notifications/read-all
      notifications.forEach((n) => (n.read = true));
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      json: {
        items: notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      },
    });
  });
}

/** Login through the fake AuthClient of the e2e build (no Auth0), which then opens /todos. */
async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prihlásiť sa' }).click();
  await expect(page).toHaveURL(/\/todos$/);
}

test('keeps anonymous users out of the todo list', async ({ page }) => {
  await page.goto('/todos');

  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(page.getByRole('heading', { name: 'TODO app' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prihlásiť sa' })
  ).toBeVisible();
});

test('logs in and out', async ({ page }) => {
  await mockTodoApi(page);
  await login(page);
  await expect(page.getByRole('heading', { name: 'TODO list' })).toBeVisible();

  await page.getByRole('link', { name: '← Domov' }).click();
  await expect(page.getByText('Prihlásený ako E2E používateľ')).toBeVisible();
  // The fake e2e user has no roles
  await expect(page.getByRole('link', { name: /admin/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Odhlásiť sa' }).click();

  await expect(
    page.getByRole('button', { name: 'Prihlásiť sa' })
  ).toBeVisible();
});

test('adds, completes and deletes a todo', async ({ page }) => {
  await mockTodoApi(page, [
    {
      id: 1,
      title: 'Kúpiť mlieko',
      completed: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ]);
  await login(page);

  await expect(page.getByRole('heading', { name: 'TODO list' })).toBeVisible();
  await expect(page.getByText('Kúpiť mlieko')).toBeVisible();

  await page.getByLabel('Nová úloha').fill('Napísať e2e test');
  await page.getByRole('button', { name: 'Pridať' }).click();
  await expect(page.getByText('Napísať e2e test')).toBeVisible();
  await expect(page.getByText('Počet úloh: 2')).toBeVisible();

  await page.getByLabel('Hotovo: Kúpiť mlieko').check();
  await expect(page.getByLabel('Hotovo: Kúpiť mlieko')).toBeChecked();

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Kúpiť mlieko' })
    .getByRole('button', { name: 'Zmazať' })
    .click();
  await expect(page.getByText('Kúpiť mlieko')).toHaveCount(0);
  await expect(page.getByText('Počet úloh: 1')).toBeVisible();
});

test('notifies about a completed todo', async ({ page }) => {
  await mockTodoApi(page, [
    {
      id: 1,
      title: 'Kúpiť mlieko',
      completed: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ]);
  await login(page);
  await expect(
    page.getByRole('button', { name: 'Notifikácie', exact: true })
  ).toBeVisible();

  await page.getByLabel('Hotovo: Kúpiť mlieko').check();
  await expect(page.getByLabel('Hotovo: Kúpiť mlieko')).toBeChecked();

  // Opening the panel loads the list without waiting for the next poll
  await page.getByRole('button', { name: /^Notifikácie/ }).click();
  const panel = page.getByRole('region', { name: 'Notifikácie' });
  await expect(
    panel.getByRole('link', { name: 'Dokončená úloha: Kúpiť mlieko' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Notifikácie, neprečítané: 1' })
  ).toBeVisible();

  await panel.getByRole('button', { name: 'Označiť ako prečítané' }).click();
  await expect(
    page.getByRole('button', { name: 'Notifikácie', exact: true })
  ).toBeVisible();

  await panel
    .getByRole('link', { name: 'Dokončená úloha: Kúpiť mlieko' })
    .click();
  await expect(page).toHaveURL(/\/todos\/1$/);
  await expect(page.getByLabel('Názov úlohy')).toHaveValue('Kúpiť mlieko');
});

test('filters, searches and pages through the URL', async ({ page }) => {
  await mockTodoApi(
    page,
    Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: i === 0 ? 'Kúpiť mlieko' : `Úloha ${i + 1}`,
      completed: i % 2 === 1,
      createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }))
  );
  await login(page);

  await expect(page.getByText('Strana 1 z 2')).toBeVisible();
  await page.getByRole('button', { name: 'Ďalšia ›' }).click();
  await expect(page).toHaveURL(/\/todos\?page=2$/);
  await expect(page.getByText('Kúpiť mlieko')).toBeVisible();

  await page.getByRole('button', { name: 'Hotové', exact: true }).click();
  await expect(page).toHaveURL(/\/todos\?status=completed$/);
  await expect(page.getByText('Počet úloh: 6')).toBeVisible();

  await page.getByRole('button', { name: 'Všetky' }).click();
  await page.getByLabel('Hľadať v názve').fill('MLIEKO');
  await page.getByRole('button', { name: 'Hľadať' }).click();
  await expect(page).toHaveURL(/\/todos\?q=MLIEKO$/);
  await expect(page.getByText('Počet úloh: 1')).toBeVisible();

  // The URL alone restores the list, e.g. with the back button. (A reload would too, but it
  // logs out the fake e2e user, whose session only lives in memory.)
  await page.getByRole('link', { name: '← Domov' }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/todos\?q=MLIEKO$/);
  await expect(page.getByLabel('Hľadať v názve')).toHaveValue('MLIEKO');
  await expect(page.getByText('Počet úloh: 1')).toBeVisible();
});

test('opens the detail, manages subtasks and goes back to the filtered list', async ({
  page,
}) => {
  await mockTodoApi(page, [
    {
      id: 1,
      title: 'Výlet',
      completed: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ]);
  await login(page);
  await page.getByRole('button', { name: 'Nehotové' }).click();
  await expect(page).toHaveURL(/status=active/);

  await page.getByRole('link', { name: 'Výlet' }).click();
  await expect(page).toHaveURL(/\/todos\/1\?status=active$/);
  await expect(page.getByLabel('Názov úlohy')).toHaveValue('Výlet');

  await page.getByLabel('Nová podúloha').fill('Zbaliť sa');
  await page.getByRole('button', { name: 'Pridať' }).click();
  await page.getByLabel('Nová podúloha').fill('Kúpiť lístky');
  await page.getByRole('button', { name: 'Pridať' }).click();
  await page.getByLabel('Hotovo: Zbaliť sa').check();
  await expect(page.getByLabel('Hotovo: Zbaliť sa')).toBeChecked();

  await page.getByRole('link', { name: '← Späť na zoznam' }).click();
  await expect(page).toHaveURL(/\/todos\?status=active$/);
  await expect(page.getByLabel('Podúlohy: 1 z 2')).toBeVisible();
});

test('shows an error when the backend is unreachable', async ({ page }) => {
  await page.route('**/api/todos**', (route) => route.abort());
  await login(page);

  await expect(page.getByRole('alert')).toHaveText(
    'Nepodarilo sa načítať úlohy. Beží backend?'
  );
});

test('sends a blocked user to the account blocked page', async ({ page }) => {
  // What java-api answers on every request once an admin has blocked the user
  // (USER_BLOCKED_PROBLEM_TYPE in the app)
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/problem+json',
      json: {
        type: 'https://todo-api/problems/user-blocked',
        title: 'Account blocked',
        status: 403,
      },
    })
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Prihlásiť sa' }).click();

  await expect(page).toHaveURL(/\/account-blocked$/);
  await expect(
    page.getByRole('heading', { name: 'Účet je zablokovaný' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Odhlásiť sa' }).click();
  await expect(
    page.getByRole('button', { name: 'Prihlásiť sa' })
  ).toBeVisible();
});
