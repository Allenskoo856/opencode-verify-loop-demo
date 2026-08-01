package com.example.orders.order;

import com.example.orders.auth.AppUser;
import javax.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "orders")
public class Order {
  public enum Status { CREATED, CANCELLED }
  @Id private UUID id; @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id") private AppUser user;
  @Column(nullable = false, length = 120) private String title; @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;
  @Column(name = "created_at", nullable = false) private Instant createdAt; @Column(name = "updated_at", nullable = false) private Instant updatedAt;
  protected Order() {}
  public Order(UUID id, AppUser user, String title) { this.id = id; this.user = user; this.title = title; this.status = Status.CREATED; this.createdAt = Instant.now(); this.updatedAt = this.createdAt; }
  public UUID getId() { return id; } public AppUser getUser() { return user; } public String getTitle() { return title; } public Status getStatus() { return status; } public Instant getCreatedAt() { return createdAt; }
  public void cancel() { this.status = Status.CANCELLED; this.updatedAt = Instant.now(); }
}
