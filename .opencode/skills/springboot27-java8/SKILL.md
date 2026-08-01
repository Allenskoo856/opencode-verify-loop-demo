---
name: springboot27-java8
description: Build and test Spring Boot 2.7.18 services with Java 8 compatibility, real HTTP, PostgreSQL migrations, and deterministic Verify Controller gates.
---

# Spring Boot 2.7 / Java 8

- Keep `java.version`, compiler source and target at 1.8; do not introduce Java 9+ APIs.
- Use Maven Wrapper or Maven in CI and fail fast if the runtime is not Java 8.
- Use Flyway against PostgreSQL for runtime schema. Do not treat an in-memory database as production validation.
- Keep status codes deterministic: bad request 400, missing/invalid auth 401, missing resource 404.
- Test business rules with JUnit/Mockito, then test real HTTP and database behavior through `@SpringBootTest(RANDOM_PORT)` and Testcontainers.
- Never print JWT secrets, passwords, Authorization headers or JDBC credentials.

Before reporting backend completion, run `./verify-controller/bin/verify-loop verify --profile backend` and attach its evidence path.
