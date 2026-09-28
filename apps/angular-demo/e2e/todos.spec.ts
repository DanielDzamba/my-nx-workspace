import { test, expect, type Page } from '@playwright/test';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

/** In-memory stand-in for java-api, so the e2e run needs neither the backend nor PostgreSQL. */
async function mockTodoApi(page: Page, initial: Todo[] = []): Promise<void> {
  const todos = [...initial];
  let nextId = Math.max(0, ...todos.map((t) => t.id)) + 1;

  await page.route('**/api/todos**', async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split('/').pop());
    const index = todos.findIndex((t) => t.id === id);

    switch (request.method()) {
      case 'GET':
        return route.fulfill({ json: todos });
      case 'POST': {
        const todo: Todo = {
          id: nextId++,
          completed: false,
          createdAt: new Date().toISOString(),
          ...request.postDataJSON(),
        };
        todos.push(todo);
        return route.fulfill({ status: 201, json: todo });
      }
      case 'PUT':
        todos[index] = { ...todos[index], ...request.postDataJSON() };
        return route.fulfill({ json: todos[index] });
      case 'DELETE':
        todos.splice(index, 1);
        return route.fulfill({ status: 204 });
      default:
        return route.fallback();
    }
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
  await expect(page.getByText('Zostáva: 2 z 2')).toBeVisible();

  await page.getByLabel('Hotovo: Kúpiť mlieko').check();
  await expect(page.getByText('Zostáva: 1 z 2')).toBeVisible();

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Kúpiť mlieko' })
    .getByRole('button', { name: 'Zmazať' })
    .click();
  await expect(page.getByText('Kúpiť mlieko')).toHaveCount(0);
  await expect(page.getByText('Zostáva: 1 z 1')).toBeVisible();
});

test('shows an error when the backend is unreachable', async ({ page }) => {
  await page.route('**/api/todos**', (route) => route.abort());
  await login(page);

  await expect(page.getByRole('alert')).toHaveText(
    'Nepodarilo sa načítať úlohy. Beží backend?'
  );
});
