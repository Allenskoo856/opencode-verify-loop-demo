package com.example.orders.order;

import com.example.orders.auth.AppUser;
import com.example.orders.auth.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class OrderService {
  private final OrderRepository orders; private final AppUserRepository users;
  public OrderService(OrderRepository orders, AppUserRepository users) { this.orders = orders; this.users = users; }
  private AppUser user(String id) { return users.findById(UUID.fromString(id)).orElseThrow(() -> new NoSuchElementException("user")); }
  @Transactional(readOnly = true) public List<Order> list(String userId) { return orders.findAllByUserIdOrderByCreatedAtDesc(UUID.fromString(userId)); }
  @Transactional(readOnly = true) public Order get(String userId, UUID id) { return orders.findByIdAndUserId(id, UUID.fromString(userId)).orElseThrow(() -> new NoSuchElementException("order")); }
  @Transactional public Order create(String userId, String title) { String normalized = title == null ? "" : title.trim(); if (normalized.isEmpty() || normalized.length() > 120) throw new IllegalArgumentException("订单标题必须为 1-120 个字符"); return orders.save(new Order(UUID.randomUUID(), user(userId), normalized)); }
  @Transactional public Order cancel(String userId, UUID id) { Order order = orders.findByIdAndUserId(id, UUID.fromString(userId)).orElseThrow(() -> new NoSuchElementException("order")); if (order.getStatus() == Order.Status.CREATED) order.cancel(); return order; }
}
