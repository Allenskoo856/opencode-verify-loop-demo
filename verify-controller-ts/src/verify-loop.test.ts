import assert from 'node:assert/strict'
import test from 'node:test'
import { __test, expandEnv, isProtectedPath } from './verify-loop.js'

test('expands only declared uppercase environment variables', () => {
  assert.equal(expandEnv('https://${HOST}/api', { HOST: 'orders.intra' }), 'https://orders.intra/api')
  assert.equal(expandEnv('${MISSING}', {}), '')
})

test('detects exact and recursive protected paths', () => {
  assert.equal(isProtectedPath('verify/policy.json', ['verify/policy.json']), true)
  assert.equal(isProtectedPath('verify/gates/api-contract.cjs', ['verify/gates/**']), true)
  assert.equal(isProtectedPath('frontend/src/App.vue', ['verify/gates/**']), false)
})

test('redacts secrets and validates required environment values', () => {
  assert.match(__test.redact('password=top-secret'), /\[REDACTED\]/)
  assert.equal(__test.requirementFailure({ TARGET_ENV: 'staging' }), 'TARGET_ENV must be "staging"')
})
