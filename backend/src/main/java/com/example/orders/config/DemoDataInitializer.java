package com.example.orders.config;

import com.example.orders.auth.AppUser; import com.example.orders.auth.AppUserRepository;
import org.springframework.beans.factory.annotation.Value; import org.springframework.boot.CommandLineRunner; import org.springframework.context.annotation.Bean; import org.springframework.context.annotation.Configuration; import org.springframework.security.crypto.password.PasswordEncoder; import java.util.UUID;

@Configuration
public class DemoDataInitializer {
  @Bean CommandLineRunner seed(AppUserRepository users, PasswordEncoder encoder, @Value("${app.demo-user}") String email, @Value("${app.demo-password}") String password) { return args -> { if (!users.findByEmail(email).isPresent()) users.save(new AppUser(UUID.randomUUID(), email, encoder.encode(password))); }; }
}
