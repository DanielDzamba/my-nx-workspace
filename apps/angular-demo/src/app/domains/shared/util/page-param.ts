/**
 * One-based `?page=` → zero-based page index. Anything that is not a positive whole number
 * (hand-edited URL) means the first page.
 */
export function parsePageParam(page: string | undefined): number {
  const parsed = Number(page);
  return Number.isInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}

/** Zero-based page index → `?page=` value; the first page is left out of the URL. */
export function pageParam(page: number): string | null {
  return page > 0 ? String(page + 1) : null;
}
