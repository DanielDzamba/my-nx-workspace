package com.example.javaapi.user;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.javaapi.api.model.UserResponse;
import com.example.javaapi.messaging.UserBlockedEvent;
import com.example.javaapi.messaging.UserUnblockedEvent;
import com.example.javaapi.outbox.Outbox;

/**
 * The users who have signed in. {@link #findProfile} runs on every API request
 * ({@link UserProvisioningFilter}), so its result is cached in Redis (cache-aside, see
 * docs/java-api/caching.md): a request reads the database only on a cache miss.
 * <p>
 * Every method that changes a user evicts its cache entry, otherwise requests would go on seeing
 * the old profile until the entry expires (e.g. a blocked user could keep working). The cache is
 * transaction-aware ({@code CacheConfig}): the eviction happens after the commit, so a request
 * running in between cannot put the old row back into the cache.
 * <p>
 * The caching annotations work through a proxy around this bean, so they apply only to calls from
 * other beans; a call from inside this class ({@code this.findProfile(...)}) would bypass the cache.
 */
@Service
@Transactional(readOnly = true)
public class UserService {

	/** Name of the cache; its Redis keys are {@code java-api:users::<user ID>}. */
	public static final String CACHE = "users";

	private final UserRepository repository;

	private final Outbox outbox;

	UserService(UserRepository repository, Outbox outbox) {
		this.repository = repository;
		this.outbox = outbox;
	}

	/** Empty for an unknown user; an empty result is not cached, so the user's first request creates them. */
	@Cacheable(cacheNames = CACHE, key = "#id", unless = "#result == null")
	public Optional<UserProfile> findProfile(String id) {
		return this.repository.findById(id).map(UserProfile::of);
	}

	/** Creates the user or updates name and email (just-in-time provisioning). */
	@Transactional
	@CacheEvict(cacheNames = CACHE, key = "#id")
	public void provision(String id, String name, String email) {
		this.repository.upsert(id, name, email);
	}

	/**
	 * Blocks or unblocks a user; takes effect on their next request. An admin cannot block
	 * themselves (409), as nobody might be left to unblock them.
	 * <p>
	 * A change is also recorded as {@link UserBlockedEvent} / {@link UserUnblockedEvent} in the
	 * outbox, in this transaction: notification-service keeps its own copy of the blocked status and
	 * applies it about a second later. Setting the current value again records nothing.
	 */
	@Transactional
	@CacheEvict(cacheNames = CACHE, key = "#id")
	public UserResponse setBlocked(String adminId, String id, boolean blocked) {
		if (blocked && id.equals(adminId)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot block yourself");
		}
		User user = this.repository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User " + id + " not found"));
		if (user.isBlocked() != blocked) {
			user.setBlocked(blocked);
			if (blocked) {
				this.outbox.record("User", id, UserBlockedEvent.TYPE, new UserBlockedEvent(id, Instant.now()));
			}
			else {
				this.outbox.record("User", id, UserUnblockedEvent.TYPE, new UserUnblockedEvent(id, Instant.now()));
			}
		}
		return UserMapper.toResponse(user);
	}

	/** One page of all users, newest first; a {@code sort} parameter is ignored. */
	public Page<UserResponse> findPage(Pageable pageable) {
		return this.repository.findNewestFirst(PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
			.map(UserMapper::toResponse);
	}

	/**
	 * The profiles of the given users in one query, straight from the database. Not cached: the
	 * caller (admin todo list) queries the database for the page anyway, and one more indexed query
	 * is cheaper than a round trip to Redis per user.
	 */
	public Map<String, UserProfile> findProfiles(Collection<String> ids) {
		return this.repository.findAllById(ids)
			.stream()
			.map(UserProfile::of)
			.collect(Collectors.toMap(UserProfile::id, Function.identity()));
	}

}
