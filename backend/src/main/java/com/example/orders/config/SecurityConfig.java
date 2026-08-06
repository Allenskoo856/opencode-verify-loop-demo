package com.example.orders.config;

import com.example.orders.auth.AppUserRepository;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.cors.*;
import javax.servlet.FilterChain; import javax.servlet.ServletException; import javax.servlet.http.*; import java.io.IOException; import java.util.Collections;

@Configuration
public class SecurityConfig {
  @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
  @Bean UserDetailsService userDetailsService(AppUserRepository users) { return username -> users.findByEmail(username).map(u -> org.springframework.security.core.userdetails.User.withUsername(u.getEmail()).password(u.getPasswordHash()).authorities("ROLE_USER").build()).orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException(username)); }
  @Bean SecurityFilterChain filterChain(HttpSecurity http, JwtService jwt, AppUserRepository users) throws Exception {
    http.csrf().disable().cors().and().sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS).and().authorizeRequests(a -> a.antMatchers("/api/auth/login", "/actuator/health", "/v3/api-docs/**", "/swagger-ui/**").permitAll().antMatchers(HttpMethod.OPTIONS).permitAll().anyRequest().authenticated()).exceptionHandling(e -> e.authenticationEntryPoint((request, response, exception) -> {
      response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
      response.setContentType("application/json");
      response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"需要登录\"}");
    })).addFilterBefore(new JwtFilter(jwt), UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }
  @Bean CorsConfigurationSource corsConfigurationSource() { CorsConfiguration c = new CorsConfiguration(); c.setAllowedOrigins(Collections.singletonList("*")); c.setAllowedMethods(Collections.singletonList("*")); c.setAllowedHeaders(Collections.singletonList("*")); UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource(); s.registerCorsConfiguration("/**", c); return s; }
  static class JwtFilter extends org.springframework.web.filter.OncePerRequestFilter {
    private final JwtService jwt; JwtFilter(JwtService jwt) { this.jwt = jwt; }
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException { String h = req.getHeader("Authorization"); if (h != null && h.startsWith("Bearer ")) { try { String sub = jwt.subject(h.substring(7)); org.springframework.security.core.authority.SimpleGrantedAuthority role = new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"); org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(sub, null, Collections.singleton(role))); } catch (RuntimeException ignored) {} } chain.doFilter(req, res); }
  }
}
