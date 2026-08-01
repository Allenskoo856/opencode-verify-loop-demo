package com.example.orders.auth;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "app_user")
public class AppUser {
  @Id private UUID id;
  @Column(nullable = false, unique = true) private String email;
  @Column(name = "password_hash", nullable = false) private String passwordHash;
  @Column(name = "created_at", nullable = false) private Instant createdAt;
  protected AppUser() {}
  public AppUser(UUID id, String email, String passwordHash) { this.id = id; this.email = email; this.passwordHash = passwordHash; this.createdAt = Instant.now(); }
  public UUID getId() { return id; } public String getEmail() { return email; } public String getPasswordHash() { return passwordHash; }
}
