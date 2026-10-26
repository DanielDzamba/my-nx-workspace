# Caching with Redis (java-api)

Every API request needs to know who its user is: whether they exist in the `users` table yet and
whether an admin has blocked them. That question is asked on every request, including the
notification polling every few seconds, while the answer almost never changes. This is a good
place for a cache.

```
request with JWT
  UserProvisioningFilter (security chain, right after the token is validated)
    UserService.findProfile(sub)          @Cacheable("users")
      ├─ Redis hit  ──► UserProfile (~1 ms, no database)
      └─ Redis miss ──► SELECT ... FROM users ──► stored in Redis for 5 min
    new user or new name/email in the token ──► provision(): upsert + @CacheEvict
    blocked ──► 403 Problem Details (type https://todo-api/problems/user-blocked)
  controller

PUT /api/admin/users/{id}/blocked ──► setBlocked(): UPDATE users + @CacheEvict
```

Code: `user/` (`UserService`, `UserProvisioningFilter`, `AdminUserController`), `config/CacheConfig`,
migration `V7`. Tests: `UserProvisioningTests`, `AdminUserControllerTests`, `RedisOutageTests`.

## Cache-aside

The pattern Spring's `@Cacheable` implements: look in the cache first; on a miss, call the method
(the source of truth, here PostgreSQL) and store its result. The method body does not know about
the cache. Keys look like `java-api:users::auth0|64f1...` (prefix, cache name, method argument),
values are JSON:

```sh
docker compose exec redis redis-cli KEYS 'java-api:*'
docker compose exec redis redis-cli GET 'java-api:users::auth0|64f1...'
docker compose exec redis redis-cli TTL 'java-api:users::auth0|64f1...'
```

An empty result (unknown user) is not cached (`unless = "#result == null"`), so the user's first
request reaches the database and creates them.

## Stale data: evict or expire

A cache holds a copy. When the original changes, the copy is wrong until it is removed. Two ways
to remove it:

| Way                  | When                                      | Here                                                                   |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Event: `@CacheEvict` | the app itself makes the change           | `provision`, `setBlocked`                                              |
| Time: TTL            | the change happens elsewhere, or as a net | `spring.cache.redis.time-to-live=5m`: no entry is older than 5 minutes |

Forgetting an eviction is a real bug, not a performance issue: a blocked user would keep working
until the entry expires. `UserProvisioningTests.servesTheProfileFromRedis` shows it by blocking a
user directly in the database, behind the cache's back: the next request still passes.

**Transaction-aware cache.** `CacheConfig` makes the cache apply puts and evictions after the
database commit. Without it, an eviction could happen before the commit, and a request running in
between would read the old row and put it back into the cache.

## The proxy trap

`@Cacheable`, `@CacheEvict` and `@Transactional` work through a proxy that Spring puts around the
bean. Only calls that come from outside the bean go through the proxy. A call inside the class,
like `this.findProfile(id)`, calls the method directly and skips the cache. That is why the filter
(a different object) calls `UserService`, and why `UserService` never calls its own cached methods.

## When Redis is down

A cache must make the app faster, never break it. `CacheConfig.errorHandler()` turns a failed read
into a miss (the method runs and reads the database) and only logs failed writes. Short timeouts
(`spring.data.redis.timeout=500ms`) keep a hanging Redis from slowing every request.
`RedisOutageTests` stops the Redis container and checks that provisioning and blocking still work.
Redis is not part of the readiness probe for the same reason.

## Why Redis and not an in-memory cache

With one instance, a map in the JVM (e.g. Caffeine) would be faster and simpler. With two
instances, each one has its own map. An admin blocks a user, the request lands on instance A and
evicts A's entry, but instance B still has `blocked: false`, and half of the user's requests still
pass. Redis is one cache shared by all instances, so one eviction is seen by all of them. It also
survives a restart of the app.

Redis is still **not the primary store**. It keeps data in memory and drops entries when it runs
out of space (`allkeys-lru` on Render) or restarts. The free Render Key Value has no persistence
at all. The `users` table in PostgreSQL is the source of truth; Redis only holds copies that can be
thrown away at any time.

## When not to cache

The admin todo list also shows owner names. It loads them with one more query by ID
(`UserService.findProfiles`), not from the cache: the request reads the database for the page
anyway, and a second indexed query is cheaper than one Redis round trip per owner. A cache pays off
when the source is slow (a remote API, an expensive aggregation) or overloaded (the same read many
times per second). Measure first; every cache adds invalidation code and a way to show stale data.
