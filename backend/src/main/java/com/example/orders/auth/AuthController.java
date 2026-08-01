package com.example.orders.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import javax.validation.Valid;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;

@RestController @RequestMapping("/api/auth")
public class AuthController {
  private final AuthService authService;
  public AuthController(AuthService authService) { this.authService = authService; }
  @PostMapping("/login") public LoginResponse login(@Valid @RequestBody LoginRequest request) {
    try { return authService.login(request.email, request.password); }
    catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "邮箱或密码错误"); }
  }
  public static class LoginRequest { @Email @NotBlank public String email; @NotBlank public String password; }
  public static class LoginResponse { public final String accessToken; public final UserResponse user; public LoginResponse(String token, UserResponse user) { this.accessToken = token; this.user = user; } }
  public static class UserResponse { public final String id; public final String email; public UserResponse(AppUser user) { this.id = user.getId().toString(); this.email = user.getEmail(); } }
}
