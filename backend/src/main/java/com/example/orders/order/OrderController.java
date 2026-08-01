package com.example.orders.order;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import javax.validation.Valid; import javax.validation.constraints.NotBlank; import javax.validation.constraints.Size; import java.time.Instant; import java.util.*;

@RestController @RequestMapping("/api/orders")
public class OrderController {
  private final OrderService service; public OrderController(OrderService service) { this.service = service; }
  private String user(org.springframework.security.core.Authentication a) { return a.getName(); }
  @GetMapping public List<Response> list(org.springframework.security.core.Authentication a) { return map(service.list(user(a))); }
  @PostMapping public Response create(org.springframework.security.core.Authentication a, @Valid @RequestBody CreateRequest request) { try { return new Response(service.create(user(a), request.title)); } catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage()); } }
  @GetMapping("/{id}") public Response get(org.springframework.security.core.Authentication a, @PathVariable UUID id) { try { return new Response(service.get(user(a), id)); } catch (NoSuchElementException e) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"); } }
  @PostMapping("/{id}/cancel") public Response cancel(org.springframework.security.core.Authentication a, @PathVariable UUID id) { try { return new Response(service.cancel(user(a), id)); } catch (NoSuchElementException e) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"); } }
  private List<Response> map(List<Order> source) { List<Response> result = new ArrayList<>(); for (Order order : source) result.add(new Response(order)); return result; }
  public static class CreateRequest { @NotBlank @Size(max = 120) public String title; }
  public static class Response { public final String id; public final String title; public final String status; public final Instant createdAt; Response(Order o) { id=o.getId().toString(); title=o.getTitle(); status=o.getStatus().name(); createdAt=o.getCreatedAt(); } }
}
