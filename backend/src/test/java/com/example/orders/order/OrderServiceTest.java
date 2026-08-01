package com.example.orders.order;

import com.example.orders.auth.AppUser; import com.example.orders.auth.AppUserRepository; import org.junit.jupiter.api.Test; import org.junit.jupiter.api.extension.ExtendWith; import org.mockito.InjectMocks; import org.mockito.Mock; import org.mockito.junit.jupiter.MockitoExtension; import java.util.UUID; import static org.junit.jupiter.api.Assertions.*; import static org.mockito.ArgumentMatchers.any; import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
  @Mock OrderRepository orders; @Mock AppUserRepository users; @InjectMocks OrderService service;
  @Test void rejectsBlankTitle() { assertThrows(IllegalArgumentException.class, () -> service.create(UUID.randomUUID().toString(), "  ")); verifyNoInteractions(users, orders); }
  @Test void createsTrimmedOrder() { UUID uid=UUID.randomUUID(); AppUser user=new AppUser(uid,"a@b.test","hash"); when(users.findById(uid)).thenReturn(java.util.Optional.of(user)); when(orders.save(any())).thenAnswer(i -> i.getArgument(0)); Order order=service.create(uid.toString(), "  test  "); assertEquals("test", order.getTitle()); assertEquals(Order.Status.CREATED, order.getStatus()); }
}
