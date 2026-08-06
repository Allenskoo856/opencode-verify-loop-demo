const bearerPattern = /(["']?authorization["']?\s*[:=]\s*["']?bearer\s+)([^"'`,;\s}]+)/gi
const secretPattern = /(["']?(?:password|passwd|secret|token|api[_-]?key|cookie)["']?\s*[:=]\s*["']?)([^"'`,;\s}]+)/gi

export function redact(value: string): string {
  return value
    .replace(bearerPattern, '$1[REDACTED]')
    .replace(secretPattern, '$1[REDACTED]')
    .replace(/gho_[A-Za-z0-9_]+/g, 'gho_[REDACTED]')
}
