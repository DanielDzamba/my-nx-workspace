package com.example.javaapi.config;

import org.springdoc.core.configuration.SpringDocConfiguration;
import org.springdoc.core.properties.SpringDocConfigProperties;
import org.springdoc.core.providers.ObjectMapperProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger UI for the static contract ({@code springdoc.swagger-ui.url=/openapi.yaml}) while the
 * spec generation from the code stays off ({@code springdoc.api-docs.enabled=false}). springdoc's
 * Swagger UI configuration requires these beans, which that property would otherwise switch off
 * together with the generation (springdoc FAQ: "use swagger-ui with a static file").
 * <p>
 * The {@code SpringDocConfiguration} instance only satisfies {@code @ConditionalOnBean}: a
 * configuration returned from a {@code @Bean} method is not processed, so nothing scans the
 * controllers.
 */
@Configuration
@ConditionalOnProperty(name = "springdoc.swagger-ui.enabled", matchIfMissing = true)
class SwaggerUiConfig {

	@Bean
	SpringDocConfiguration springDocConfiguration() {
		return new SpringDocConfiguration();
	}

	@Bean
	SpringDocConfigProperties springDocConfigProperties() {
		return new SpringDocConfigProperties();
	}

	@Bean
	ObjectMapperProvider objectMapperProvider(SpringDocConfigProperties springDocConfigProperties) {
		return new ObjectMapperProvider(springDocConfigProperties);
	}

}
