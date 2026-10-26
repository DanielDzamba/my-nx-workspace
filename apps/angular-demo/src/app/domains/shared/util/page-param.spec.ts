import { pageParam, parsePageParam } from './page-param';

// test() rather than it(): the Playwright lint rules (applied to all files) only recognize test()
describe('page param', () => {
  test('turns the one-based ?page= into a zero-based index', () => {
    expect(parsePageParam('3')).toBe(2);
    expect(parsePageParam(undefined)).toBe(0);
  });

  test('falls back to the first page for hand-edited nonsense', () => {
    expect(parsePageParam('0')).toBe(0);
    expect(parsePageParam('-1')).toBe(0);
    expect(parsePageParam('1.5')).toBe(0);
    expect(parsePageParam('abc')).toBe(0);
  });

  test('leaves the first page out of the URL', () => {
    expect(pageParam(0)).toBeNull();
    expect(pageParam(2)).toBe('3');
  });
});
