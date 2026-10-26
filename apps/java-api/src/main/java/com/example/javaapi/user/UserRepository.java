package com.example.javaapi.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, String> {

	/**
	 * Creates the user, or updates name and email of an existing one. One atomic statement: two
	 * first requests of a new user arriving at the same moment do not fail on the primary key, as a
	 * separate {@code exists} check followed by an insert would. A missing claim ({@code null})
	 * keeps the stored value.
	 */
	@Modifying
	@Query(nativeQuery = true, value = """
			INSERT INTO users (id, name, email) VALUES (:id, :name, :email)
			ON CONFLICT (id) DO UPDATE
			SET name = COALESCE(EXCLUDED.name, users.name), email = COALESCE(EXCLUDED.email, users.email)
			""")
	void upsert(String id, String name, String email);

	/** Newest first; {@code id} as the last key keeps the order stable between pages. */
	@Query("SELECT u FROM User u ORDER BY u.createdAt DESC, u.id DESC")
	Page<User> findNewestFirst(Pageable pageable);

}
