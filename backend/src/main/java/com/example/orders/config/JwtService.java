package com.example.orders.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Service
public class JwtService {
  @Value("${app.jwt-secret}") private String secret; @Value("${app.jwt-ttl-seconds}") private long ttl; private Key key;
  @PostConstruct void init() { if (secret.length() < 32) throw new IllegalStateException("JWT_SECRET must be at least 32 characters"); key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)); }
  public String issue(String userId, String email) { long now = System.currentTimeMillis(); return Jwts.builder().setSubject(userId).claim("email", email).setIssuedAt(new Date(now)).setExpiration(new Date(now + ttl * 1000)).signWith(key, SignatureAlgorithm.HS256).compact(); }
  public String subject(String token) { return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody().getSubject(); }
}
