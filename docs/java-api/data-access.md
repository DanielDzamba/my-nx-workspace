# Data access (java-api)

How the todo API talks to PostgreSQL, and the performance traps it avoids. Code:
`apps/java-api/src/main/java/com/example/javaapi/todo`, tests: `TodoDataAccessTests`.

## Paging on the server

`GET /api/todos` never returns the whole table. Spring binds `?page=&size=&sort=` into a
`Pageable`; the repository turns it into `ORDER BY ... LIMIT 10 OFFSET 20` plus a `count(*)` for
`totalElements`, and the controller returns a `PagedModel`:

```json
{ "content": [ ... ], "page": { "size": 10, "number": 2, "totalElements": 57, "totalPages": 6 } }
```

Why on the server and not "load everything, page in the browser":

- Data volume grows without bound; response size, JSON parsing and memory would grow with it.
- The database can stop after 10 rows (with a matching index it reads only those rows).
- Filtering and counting stay correct across all rows, not just the loaded ones.

Rules the code enforces:

- `size` is capped (`spring.data.web.pageable.max-page-size=100`), so nobody can request 1M rows.
- Only whitelisted sort properties (`TodoPaging.SORTABLE`), otherwise 400.
- `id` is always appended as the last sort key. Without a unique last key, rows with equal
  `created_at` / `title` may swap between queries and appear on two pages or on none.

Offset paging gets slower for deep pages (`OFFSET 100000` still reads and throws away 100 000
rows). For infinite scrolling over huge tables the usual alternative is **keyset (cursor) paging**:
`WHERE (created_at, id) < (:lastCreatedAt, :lastId) ORDER BY created_at DESC, id DESC LIMIT 10`.
It cannot jump to page 37, which is fine for feeds, not for numbered pages.

## Dynamic filters (Specifications)

`status` and `q` are optional. `TodoSpecifications` adds a predicate only for the filters that are
set, so each combination produces a plain SQL `WHERE`. The common shortcut, one static query with
`(:status IS NULL OR completed = :status)`, gives the planner a condition it cannot match to an
index and a single cached plan for very different inputs.

The search is `lower(title) LIKE '%milk%' ESCAPE '\'`: `%` and `_` typed by the user are escaped,
so they are searched literally instead of acting as wildcards.

## Indexes and EXPLAIN

| Index                                                 | Serves                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `todo_owner_created_idx (owner_id, created_at, id)`   | a user's list, newest/oldest first (scanned backwards for DESC)   |
| `todo_title_trgm_idx gin (lower(title) gin_trgm_ops)` | `lower(title) LIKE '%...%'` (V4, `pg_trgm`)                       |
| `subtask_todo_created_idx (todo_id, created_at, id)`  | subtasks of a todo; the FK itself (PostgreSQL does not index FKs) |

A B-tree index only helps `LIKE 'milk%'` (fixed prefix). With a leading `%`, PostgreSQL has to read
every row, unless there is a trigram index. The index must be on the **same expression** as the
query (`lower(title)`, not `title`).

`EXPLAIN` shows the plan PostgreSQL chose; `EXPLAIN ANALYZE` also runs the query and shows real
times and row counts. Try it locally (`docker compose` database, `psql` or any SQL client):

```sql
-- 200 000 todos of 1 000 users
INSERT INTO todo (owner_id, title, completed, created_at)
SELECT 'user' || (i % 1000), 'Todo ' || i || CASE WHEN i % 50 = 0 THEN ' milk' ELSE '' END,
       i % 3 = 0, now() - i * interval '1 minute'
FROM generate_series(1, 200000) AS i;
ANALYZE todo;

EXPLAIN ANALYZE
SELECT * FROM todo WHERE owner_id = 'user42' ORDER BY created_at DESC, id DESC LIMIT 10;
-- Index Scan Backward using todo_owner_created_idx ... rows=10

EXPLAIN ANALYZE SELECT * FROM todo WHERE lower(title) LIKE '%milk%';
-- Bitmap Index Scan on todo_title_trgm_idx

EXPLAIN ANALYZE
SELECT * FROM todo WHERE owner_id = 'user42' AND lower(title) LIKE '%milk%';
-- BitmapAnd of todo_owner_created_idx and todo_title_trgm_idx

DELETE FROM todo WHERE owner_id LIKE 'user%';
```

The last query combines both indexes (two bitmaps, AND-ed). With only a few todos per user, the
same query uses just the owner index and applies the search as a `Filter` on those rows (that is
what happens on the small test table). Both are right: the planner decides from statistics
(`ANALYZE`) which plan is cheapest, not from which indexes exist. What to look for in a plan:

- `Seq Scan` on a big table in a frequent query: missing or unusable index.
- `rows=` estimate far from the actual rows: stale statistics or a condition the planner cannot
  estimate.
- `Sort` above a `LIMIT`: an index in the right order would avoid sorting everything.

On a tiny table a `Seq Scan` is always cheapest, so `TodoDataAccessTests` sets
`enable_seqscan = off` to check that an index _can_ serve a query.

## N+1 queries

Each list item shows its subtask progress ("1/3"). The obvious code is:

```java
page.map(todo -> new TodoSummaryResponse(..., todo.getSubtasks().size(), ...));
```

`subtasks` is a LAZY collection, so every `getSubtasks()` fires its own
`SELECT ... FROM subtask WHERE todo_id = ?`: **1** query for the page + **N** queries for N todos.
With 10 items that is 11 round trips; with 100 items, 101. It is invisible in development with
three rows and hurts in production.

Fixes, from most to least targeted:

1. **Aggregate query** (used here): one `GROUP BY` for all todos on the page,
   `SubtaskRepository.countByTodoIds(ids)`. Loads only the numbers, not the subtasks.
2. **Fetch join / `@EntityGraph`**: loads the collection in the same query. Used for the detail
   (`findWithSubtasksByIdAndOwnerId`, one todo). Not for paged lists: with a collection fetch,
   Hibernate cannot apply `LIMIT` in SQL and pages in memory (warning `HHH90003004`).
3. **`@BatchSize(size = 50)`** on the collection: lazy loading fetches the subtasks of up to 50
   todos per query (`WHERE todo_id IN (...)`): N+1 becomes 1 + N/50 without changing the code.

`TodoDataAccessTests` counts the SQL statements (Hibernate statistics), so a regression to N+1
fails the build. To watch queries while developing, set `logging.level.org.hibernate.SQL=debug`.

`@ManyToOne` is EAGER by default: `Subtask.todo` is explicitly LAZY, otherwise loading subtasks
could load their todos one by one, which is N+1 in the other direction.

## Open Session in View (OSIV)

With `spring.jpa.open-in-view=true` (Spring Boot's default, with a startup warning), the Hibernate
session stays open for the whole HTTP request, including the controller and JSON serialization.
Lazy relations then "just work" anywhere, which is the problem:

- Lazy loading can happen during JSON rendering, where nobody sees the queries (hidden N+1).
- The request holds a database connection until the response is written. Under load (or with a
  slow client) the connection pool runs dry although the database is idle.

This project sets `open-in-view=false`. The session lives only inside `@Transactional` service
methods, so:

- the service loads everything it needs explicitly (fetch join, aggregate query) and returns DTOs;
- touching a lazy relation outside the transaction throws `LazyInitializationException`
  (`TodoDataAccessTests.lazySubtasksCannotBeReadOutsideATransaction`). The fix is to load it in
  the service, never to turn OSIV back on or to use `FetchType.EAGER`.
