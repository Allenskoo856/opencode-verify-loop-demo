package com.example.orders;

import com.example.orders.auth.AuthController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.*;
import org.springframework.test.context.ContextConfiguration;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ContextConfiguration(initializers = OrdersIntegrationTest.Initializer.class)
class OrdersIntegrationTest {
  @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:14-alpine").withDatabaseName("orders").withUsername("orders").withPassword("orders-test-password");
  @Autowired TestRestTemplate http;
  @Test void realHttpAndPostgresSupportLoginAndOrderCreation() {
    AuthController.LoginRequest login = new AuthController.LoginRequest(); login.email = "demo@example.com"; login.password = "demo-password-only-for-local";
    ResponseEntity<Map> token = http.postForEntity("/api/auth/login", login, Map.class);
    assertEquals(HttpStatus.OK, token.getStatusCode()); assertNotNull(token.getBody().get("accessToken"));
    HttpHeaders headers = new HttpHeaders(); headers.setBearerAuth((String) token.getBody().get("accessToken")); headers.setContentType(MediaType.APPLICATION_JSON);
    ResponseEntity<Map> created = http.exchange("/api/orders", HttpMethod.POST, new HttpEntity<>("{\"title\":\"container order\"}", headers), Map.class);
    assertEquals(HttpStatus.CREATED, created.getStatusCode()); assertEquals("CREATED", created.getBody().get("status"));
  }
  static class Initializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {
    public void initialize(ConfigurableApplicationContext context) { TestPropertyValues.of("spring.datasource.url=" + POSTGRES.getJdbcUrl(), "spring.datasource.username=" + POSTGRES.getUsername(), "spring.datasource.password=" + POSTGRES.getPassword(), "JWT_SECRET=integration-test-secret-which-is-long-enough").applyTo(context.getEnvironment()); }
  }
}
