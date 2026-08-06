import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { runApiContract, runProjectTarget, validateAcceptanceSpec } from './acceptance.js'

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') reject(new Error('server did not bind to a TCP port'))
      else resolve(address.port)
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('validates the acceptance contract shape', () => {
  assert.deepEqual(validateAcceptanceSpec({ schemaVersion: 'acceptance/v1', id: 'missing-api' }), ['api is required for the contract runner'])
  assert.ok(validateAcceptanceSpec({ schemaVersion: 'wrong', id: '', api: { baseUrl: '', cases: [] } }).length >= 3)
  assert.match(validateAcceptanceSpec({ schemaVersion: 'acceptance/v1', id: 'missing-assertion', api: { baseUrl: 'http://localhost', cases: [{ id: 'case', steps: [{ request: { path: '/health' } }] }] } }).join('\n'), /expect is required/)
})

test('runs real HTTP requests, captures values, and checks JSON assertions', async () => {
  const orders = new Map<string, string>()
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
    const path = request.url?.split('?')[0]
    if (request.method === 'POST' && path === '/login') {
      if (body?.password === 'wrong-password') {
        response.writeHead(401, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ message: '登录失败' }))
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ accessToken: 'test-token' }))
      return
    }
    if (request.headers.authorization !== 'Bearer test-token') {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ message: 'unauthorized' }))
      return
    }
    if (request.method === 'POST' && path === '/orders') {
      const id = randomUUID()
      orders.set(id, 'CREATED')
      response.writeHead(201, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ id, status: 'CREATED' }))
      return
    }
    const cancel = path?.match(/^\/orders\/([^/]+)\/cancel$/)
    if (request.method === 'POST' && cancel) {
      orders.set(cancel[1], 'CANCELLED')
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ id: cancel[1], status: 'CANCELLED' }))
      return
    }
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ message: 'not found' }))
  })
  const port = await listen(server)
  const root = await fs.mkdtemp(join(tmpdir(), 'acceptance-contract-'))
  const specFile = join(root, 'contract.json')
  await fs.writeFile(specFile, JSON.stringify({
    schemaVersion: 'acceptance/v1',
    id: 'test-contract',
    api: {
      baseUrl: `http://127.0.0.1:${port}`,
      cases: [{
        id: 'lifecycle',
        steps: [
          { request: { method: 'POST', path: '/login', json: { email: '${E2E_USER}', password: '${E2E_PASSWORD}' } }, expect: { status: 200 }, capture: { token: '$.accessToken' } },
          { request: { method: 'POST', path: '/orders', headers: { Authorization: 'Bearer ${token}' }, json: { title: 'verify-${uuid}' } }, expect: { status: 201, json: [{ path: '$.status', equals: 'CREATED' }] }, capture: { orderId: '$.id' } },
          { request: { method: 'POST', path: '/orders/${orderId}/cancel', headers: { Authorization: 'Bearer ${token}' } }, expect: { status: 200, json: [{ path: '$.status', equals: 'CANCELLED' }] } },
        ],
      }],
    },
  }), 'utf8')
  try {
    const result = await runApiContract(root, specFile, { E2E_USER: 'demo@example.com', E2E_PASSWORD: 'demo-password', TARGET_ENV: 'local', ALLOW_MUTATING_E2E: 'true' })
    assert.equal(result.ok, true, result.output)
    assert.match(result.output, /conclusion=PASS cases=1/)
    assert.equal(orders.size, 1)
    assert.equal([...orders.values()][0], 'CANCELLED')
  } finally {
    await close(server)
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('runs a project target from a version-specific adapter manifest', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'acceptance-project-'))
  await fs.mkdir(join(root, 'server'))
  await fs.writeFile(join(root, 'project.json'), JSON.stringify({
    schemaVersion: 'acceptance/project/v1',
    backend: { test: { cwd: 'server', command: 'printf "%s" "$PROJECT_TEST_VALUE"' } },
  }), 'utf8')
  try {
    const result = await runProjectTarget(root, 'project.json', 'backend.test', { PROJECT_TEST_VALUE: 'java-toolchain-ok' }, 10)
    assert.equal(result.exitCode, 0, result.output)
    assert.match(result.output, /java-toolchain-ok/)
    assert.match(result.output, /cwd=server/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
