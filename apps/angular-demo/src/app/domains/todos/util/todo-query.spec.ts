import {
  DEFAULT_TODO_QUERY,
  TODO_SORTS,
  TODO_STATUSES,
  pageParam,
  parsePageParam,
  parseTodoQuery,
  todoQueryParams,
} from './todo-query';

// test() rather than it(): the Playwright lint rules (applied to all files) only recognize test()
describe('todo query', () => {
  test('uses the defaults for missing params', () => {
    expect(parseTodoQuery({})).toEqual(DEFAULT_TODO_QUERY);
  });

  test('parses valid params, with a one-based page in the URL', () => {
    expect(
      parseTodoQuery({
        status: TODO_STATUSES.completed,
        q: '  milk ',
        sort: TODO_SORTS.titleDesc,
        page: '3',
      })
    ).toEqual({
      status: TODO_STATUSES.completed,
      q: 'milk',
      sort: TODO_SORTS.titleDesc,
      page: 2,
    });
  });

  test('falls back to the defaults for hand-edited nonsense', () => {
    expect(
      parseTodoQuery({ status: 'later', sort: 'random', page: '-1' })
    ).toEqual(DEFAULT_TODO_QUERY);
    expect(parsePageParam('1.5')).toBe(0);
    expect(parsePageParam('abc')).toBe(0);
  });

  test('leaves default values out of the URL', () => {
    expect(todoQueryParams(DEFAULT_TODO_QUERY)).toEqual({
      status: null,
      q: null,
      sort: null,
      page: null,
    });
    expect(
      todoQueryParams({
        status: TODO_STATUSES.active,
        q: 'milk',
        sort: TODO_SORTS.oldest,
        page: 1,
      })
    ).toEqual({
      status: TODO_STATUSES.active,
      q: 'milk',
      sort: TODO_SORTS.oldest,
      page: '2',
    });
  });

  test('round-trips through the URL', () => {
    const query = {
      status: TODO_STATUSES.active,
      q: 'milk',
      sort: TODO_SORTS.titleAsc,
      page: 4,
    };
    const params = todoQueryParams(query);

    expect(
      parseTodoQuery({
        status: params.status ?? undefined,
        q: params.q ?? undefined,
        sort: params.sort ?? undefined,
        page: params.page ?? undefined,
      })
    ).toEqual(query);
    expect(pageParam(0)).toBeNull();
  });
});
