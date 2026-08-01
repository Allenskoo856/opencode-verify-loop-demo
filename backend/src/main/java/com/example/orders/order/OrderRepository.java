package com.example.orders.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface OrderRepository extends JpaRepository<Order, UUID> { List<Order> findAllByUserIdOrderByCreatedAtDesc(UUID userId); Optional<Order> findByIdAndUserId(UUID id, UUID userId); }
