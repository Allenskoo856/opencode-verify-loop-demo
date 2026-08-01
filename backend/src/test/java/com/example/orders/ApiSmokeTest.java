package com.example.orders;

import org.junit.jupiter.api.Test; import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.datasource.url=jdbc:h2:mem:orders;MODE=PostgreSQL", "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password="})
class ApiSmokeTest { @Test void contextConfigurationIsLoadable() {} }
