package com.example.orders.auth;

import com.example.orders.config.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final AppUserRepository users; private final PasswordEncoder encoder; private final JwtService jwt;
  public AuthService(AppUserRepository users, PasswordEncoder encoder, JwtService jwt) { this.users = users; this.encoder = encoder; this.jwt = jwt; }
  public AuthController.LoginResponse login(String email, String password) {
    AppUser user = users.findByEmail(email).filter(u -> encoder.matches(password, u.getPasswordHash())).orElseThrow(() -> new IllegalArgumentException("invalid credentials"));
    return new AuthController.LoginResponse(jwt.issue(user.getId().toString(), user.getEmail()), new AuthController.UserResponse(user));
  }
}
