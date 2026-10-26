package com.example.javaapi.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.cache.autoconfigure.RedisCacheManagerBuilderCustomizer;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;

import com.example.javaapi.user.UserProfile;
import com.example.javaapi.user.UserService;

/**
 * {@code @Cacheable} / {@code @CacheEvict} backed by Redis. Spring Boot builds the cache manager
 * from {@code spring.cache.*} in application.properties (TTL, key prefix); this class adds what
 * properties cannot express. Concepts: docs/java-api/caching.md.
 */
@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

	private static final Logger logger = LoggerFactory.getLogger(CacheConfig.class);

	/**
	 * <ul>
	 * <li>Transaction-aware: a put or evict inside a transaction is applied after the commit (and
	 * dropped on a rollback), so the cache never gets ahead of the database.</li>
	 * <li>Values as JSON of their exact type, readable in {@code redis-cli}. A typed serializer per
	 * cache instead of one generic serializer that stores class names in the JSON: deserializing a
	 * class name taken from the data is a known attack vector.</li>
	 * </ul>
	 */
	@Bean
	RedisCacheManagerBuilderCustomizer redisCacheManagerCustomizer() {
		return (builder) -> {
			RedisCacheConfiguration defaults = builder.cacheDefaults();
			builder.transactionAware()
				.withCacheConfiguration(UserService.CACHE, defaults.serializeValuesWith(
						SerializationPair.fromSerializer(new JacksonJsonRedisSerializer<>(UserProfile.class))));
		};
	}

	/**
	 * A cache must only make the app faster, never break it: when Redis is down, a read counts as a
	 * miss (the method runs and reads the database) and a failed write is logged. A failed evict can
	 * leave an outdated entry behind; the TTL bounds how long it stays.
	 */
	@Override
	public CacheErrorHandler errorHandler() {
		return new CacheErrorHandler() {

			@Override
			public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
				logger.warn("Cache {}: get {} failed, reading the source instead", cache.getName(), key, exception);
			}

			@Override
			public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
				logger.warn("Cache {}: put {} failed", cache.getName(), key, exception);
			}

			@Override
			public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
				logger.warn("Cache {}: evict {} failed, the entry stays until its TTL ends", cache.getName(), key,
						exception);
			}

			@Override
			public void handleCacheClearError(RuntimeException exception, Cache cache) {
				logger.warn("Cache {}: clear failed", cache.getName(), exception);
			}

		};
	}

}
