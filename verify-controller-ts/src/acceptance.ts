import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { execute } from './process.js'
import { redact } from './security.js'

export type JsonAssertion = {
  path: string
  present?: boolean
  equals?: unknown
  contains?: string
  matches?: string
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
}

export type ApiStep = {
  id?: string
  request: {
    method?: string
    path: string
    headers?: Record<string, string>
    query?: Record<string, string>
    json?: unknown
    body?: string
  }
  expect?: {
    status?: number
    headers?: Record<string, string>
    bodyContains?: string
    json?: JsonAssertion[]
  }
  capture?: Record<string, string>
}

export type ApiCase = {
  id: string
  description?: string
  requirementIds?: string[]
  steps: ApiStep[]
}

export type AcceptanceSpec = {
  schemaVersion: 'acceptance/v1'
  id: string
  source?: string
  safety?: {
    mutates?: boolean
    allowedEnvironments?: string[]
  }
  api?: {
    baseUrl: string
    cases: ApiCase[]
  }
  frontend?: {
    runner: string
    projectTarget?: string
    cases: Array<{ id: string; testFile: string; requirementIds?: string[] }>
  }
}

type ProjectTarget = {
  command: string
  cwd?: string
  env?: Record<string, string>
}

type ProjectManifest = {
  schemaVersion: 'acceptance/project/v1'
  [key: string]: unknown
}

type JsonPathResult = { found: boolean; value?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonPathTokens(path: string): Array<string | number> | undefined {
  if (path === '$') return []
  if (!path.startsWith('$.')) return undefined
  const tokens: Array<string | number> = []
  const expression = path.slice(2)
  let index = 0
  while (index < expression.length) {
    const property = expression.slice(index).match(/^([A-Za-z_][A-Za-z0-9_-]*)/)
    if (property) {
      tokens.push(property[1])
      index += property[1].length
    } else {
      const array = expression.slice(index).match(/^\[(\d+)\]/)
      if (!array) return undefined
      tokens.push(Number(array[1]))
      index += array[0].length
    }
    if (expression[index] === '.') index += 1
  }
  return tokens
}

function readJsonPath(value: unknown, path: string): JsonPathResult {
  const tokens = jsonPathTokens(path)
  if (!tokens) return { found: false }
  let current: unknown = value
  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token >= current.length) return { found: false }
      current = current[token]
    } else {
      if (!isRecord(current) || !(token in current)) return { found: false }
      current = current[token]
    }
  }
  return { found: true, value: current }
}

function valueType(value: unknown): JsonAssertion['type'] {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function expandString(value: string, env: NodeJS.ProcessEnv, variables: Record<string, unknown>): string {
  return value.replace(/\$\{([A-Za-z][A-Za-z0-9_.-]*)\}/g, (_match, name: string) => {
    if (name in variables) return String(variables[name])
    if (env[name] !== undefined) return env[name] as string
    return ''
  })
}

function expandValue(value: unknown, env: NodeJS.ProcessEnv, variables: Record<string, unknown>): unknown {
  if (typeof value === 'string') return expandString(value, env, variables)
  if (Array.isArray(value)) return value.map((item) => expandValue(item, env, variables))
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandValue(item, env, variables)]))
  return value
}

function targetUrl(baseUrl: string, path: string, query: Record<string, string> | undefined): string {
  const expandedPath = path.trim()
  const target = /^https?:\/\//i.test(expandedPath)
    ? new URL(expandedPath)
    : new URL(expandedPath.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  for (const [name, value] of Object.entries(query ?? {})) target.searchParams.set(name, value)
  return target.toString()
}

function checkAssertion(body: unknown, assertion: JsonAssertion): string | undefined {
  const result = readJsonPath(body, assertion.path)
  if (assertion.present !== undefined && result.found !== assertion.present) return `json ${assertion.path} present=${result.found}, expected ${assertion.present}`
  if (!result.found) return assertion.present === false ? undefined : `json ${assertion.path} was not found`
  if (assertion.equals !== undefined && !equalJson(result.value, assertion.equals)) return `json ${assertion.path}=${JSON.stringify(result.value)}, expected ${JSON.stringify(assertion.equals)}`
  if (assertion.contains !== undefined && (typeof result.value !== 'string' || !result.value.includes(assertion.contains))) return `json ${assertion.path} does not contain ${JSON.stringify(assertion.contains)}`
  if (assertion.matches !== undefined && (typeof result.value !== 'string' || !new RegExp(assertion.matches).test(result.value))) return `json ${assertion.path} does not match ${JSON.stringify(assertion.matches)}`
  if (assertion.type !== undefined && valueType(result.value) !== assertion.type) return `json ${assertion.path} type=${valueType(result.value)}, expected ${assertion.type}`
  return undefined
}

function validateAssertion(value: unknown, location: string, errors: string[]): void {
  if (!isRecord(value) || typeof value.path !== 'string' || !value.path.startsWith('$')) {
    errors.push(`${location} must contain a JSON path beginning with $`)
    return
  }
  const keys = ['present', 'equals', 'contains', 'matches', 'type']
  if (!keys.some((key) => key in value)) errors.push(`${location} must define present, equals, contains, matches, or type`)
  if (value.type !== undefined && !['string', 'number', 'boolean', 'object', 'array', 'null'].includes(String(value.type))) errors.push(`${location}.type is invalid`)
}

export function validateAcceptanceSpec(input: unknown): string[] {
  const errors: string[] = []
  if (!isRecord(input)) return ['spec must be an object']
  if (input.schemaVersion !== 'acceptance/v1') errors.push('schemaVersion must be acceptance/v1')
  if (typeof input.id !== 'string' || input.id.trim() === '') errors.push('id must be a non-empty string')
  if (input.safety !== undefined) {
    if (!isRecord(input.safety)) errors.push('safety must be an object')
    else if (input.safety.mutates !== undefined && typeof input.safety.mutates !== 'boolean') errors.push('safety.mutates must be boolean')
  }
  if (input.api === undefined) {
    errors.push('api is required for the contract runner')
  } else if (!isRecord(input.api)) {
    errors.push('api must be an object')
  } else {
    if (typeof input.api.baseUrl !== 'string' || input.api.baseUrl.trim() === '') errors.push('api.baseUrl must be a non-empty string')
    if (!Array.isArray(input.api.cases) || input.api.cases.length === 0) {
      errors.push('api.cases must be a non-empty array')
    } else {
      const caseIds = new Set<string>()
      input.api.cases.forEach((item, caseIndex) => {
        const location = `api.cases[${caseIndex}]`
        if (!isRecord(item) || typeof item.id !== 'string' || item.id.trim() === '') {
          errors.push(`${location}.id must be a non-empty string`)
          return
        }
        if (caseIds.has(item.id)) errors.push(`${location}.id is duplicated: ${item.id}`)
        caseIds.add(item.id)
        if (!Array.isArray(item.steps) || item.steps.length === 0) {
          errors.push(`${location}.steps must be a non-empty array`)
          return
        }
        item.steps.forEach((step, stepIndex) => {
          const stepLocation = `${location}.steps[${stepIndex}]`
          if (!isRecord(step) || !isRecord(step.request)) {
            errors.push(`${stepLocation}.request must be an object`)
            return
          }
          if (typeof step.request.path !== 'string' || step.request.path.trim() === '') errors.push(`${stepLocation}.request.path must be a non-empty string`)
          if (step.request.json !== undefined && step.request.body !== undefined) errors.push(`${stepLocation}.request cannot define both json and body`)
          if (step.expect === undefined) errors.push(`${stepLocation}.expect is required; every request needs a deterministic assertion`)
          else if (!isRecord(step.expect)) errors.push(`${stepLocation}.expect must be an object`)
          if (isRecord(step.expect) && !('status' in step.expect) && !('headers' in step.expect) && !('bodyContains' in step.expect) && !('json' in step.expect)) errors.push(`${stepLocation}.expect must define status, headers, bodyContains, or json`)
          if (isRecord(step.expect) && step.expect.json !== undefined) {
            if (!Array.isArray(step.expect.json)) errors.push(`${stepLocation}.expect.json must be an array`)
            else step.expect.json.forEach((assertion, assertionIndex) => validateAssertion(assertion, `${stepLocation}.expect.json[${assertionIndex}]`, errors))
          }
          if (step.capture !== undefined && !isRecord(step.capture)) errors.push(`${stepLocation}.capture must map variable names to JSON paths`)
        })
      })
    }
  }
  if (input.frontend !== undefined) {
    if (!isRecord(input.frontend) || typeof input.frontend.runner !== 'string' || !Array.isArray(input.frontend.cases)) {
      errors.push('frontend must contain runner and cases')
    } else {
      input.frontend.cases.forEach((item, index) => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.testFile !== 'string') errors.push(`frontend.cases[${index}] must contain id and testFile`)
      })
    }
  }
  return errors
}

function parseJsonBody(text: string, contentType: string | null): unknown {
  if (!text) return undefined
  if (contentType?.toLowerCase().includes('json')) {
    try { return JSON.parse(text) } catch { return undefined }
  }
  try { return JSON.parse(text) } catch { return undefined }
}

async function runApiStep(
  baseUrl: string,
  testCase: ApiCase,
  step: ApiStep,
  env: NodeJS.ProcessEnv,
  variables: Record<string, unknown>,
  timeoutSeconds: number,
): Promise<{ ok: boolean; output: string }> {
  const request = step.request
  const expandedPath = expandString(request.path, env, variables)
  const expandedQuery = expandValue(request.query, env, variables) as Record<string, string> | undefined
  const url = targetUrl(baseUrl, expandedPath, expandedQuery)
  const headers: Record<string, string> = { ...(request.headers ? expandValue(request.headers, env, variables) as Record<string, string> : {}) }
  const init: RequestInit = { method: request.method ?? 'GET', headers, signal: AbortSignal.timeout(timeoutSeconds * 1000) }
  if (request.json !== undefined) {
    if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json'
    init.body = JSON.stringify(expandValue(request.json, env, variables))
  } else if (request.body !== undefined) {
    init.body = expandString(request.body, env, variables)
  }
  let response: Response
  let text: string
  try {
    response = await fetch(url, init)
    text = await response.text()
  } catch (error) {
    return { ok: false, output: `case=${testCase.id} step=${step.id ?? request.path} request failed: ${redact(error instanceof Error ? error.message : String(error))}` }
  }
  const body = parseJsonBody(text, response.headers.get('content-type'))
  const expectedStatus = step.expect?.status
  if (expectedStatus !== undefined && response.status !== expectedStatus) return { ok: false, output: `case=${testCase.id} step=${step.id ?? request.path} status=${response.status}, expected=${expectedStatus} body=${redact(text.slice(0, 2000))}` }
  for (const [name, expected] of Object.entries(step.expect?.headers ?? {})) {
    const actual = response.headers.get(name)
    if (actual !== expected) return { ok: false, output: `case=${testCase.id} step=${step.id ?? request.path} header=${name} value=${redact(actual ?? '')}, expected=${redact(expected)}` }
  }
  if (step.expect?.bodyContains !== undefined && !text.includes(expandString(step.expect.bodyContains, env, variables))) return { ok: false, output: `case=${testCase.id} step=${step.id ?? request.path} body does not contain expected text` }
  for (const assertion of step.expect?.json ?? []) {
    const failure = checkAssertion(body, expandValue(assertion, env, variables) as JsonAssertion)
    if (failure) return { ok: false, output: `case=${testCase.id} step=${step.id ?? request.path} ${failure} body=${redact(text.slice(0, 2000))}` }
  }
  for (const [name, path] of Object.entries(step.capture ?? {})) {
    const captured = readJsonPath(body, expandString(path, env, variables))
    if (!captured.found) return { ok: false, output: `case=${testCase.id} step=${step.id ?? request.path} capture ${name} failed at ${path}` }
    variables[name] = captured.value
  }
  return { ok: true, output: `case=${testCase.id} step=${step.id ?? request.path} status=${response.status}` }
}

export async function runApiContract(
  root: string,
  specFile: string,
  env: NodeJS.ProcessEnv = process.env,
  timeoutSeconds = 120,
): Promise<{ ok: boolean; output: string }> {
  const target = isAbsolute(specFile) ? specFile : resolve(root, specFile)
  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.readFile(target, 'utf8'))
  } catch (error) {
    return { ok: false, output: `cannot read acceptance spec ${specFile}: ${redact(error instanceof Error ? error.message : String(error))}` }
  }
  const errors = validateAcceptanceSpec(parsed)
  if (errors.length > 0) return { ok: false, output: `invalid acceptance spec ${specFile}:\n${errors.join('\n')}` }
  const spec = parsed as AcceptanceSpec
  const targetEnvironment = env.TARGET_ENV ?? ''
  if (spec.safety?.mutates) {
    const allowed = spec.safety.allowedEnvironments ?? []
    if (!allowed.includes(targetEnvironment)) return { ok: false, output: `acceptance spec ${spec.id} mutates data and refuses TARGET_ENV=${targetEnvironment || '[missing]'}; allowed=${allowed.join(',')}` }
    if (env.ALLOW_MUTATING_E2E !== 'true') return { ok: false, output: `acceptance spec ${spec.id} requires ALLOW_MUTATING_E2E=true` }
  }
  const baseUrl = expandString(spec.api!.baseUrl, env, {})
  if (!baseUrl) return { ok: false, output: `acceptance spec ${spec.id} expanded api.baseUrl to an empty value` }
  const lines = [`acceptance=${spec.id}`, `source=${spec.source ?? '[unspecified]'}`, `baseUrl=${redact(baseUrl)}`]
  for (const testCase of spec.api!.cases) {
    const variables: Record<string, unknown> = { runId: `acceptance-${Date.now()}`, uuid: randomUUID(), timestamp: String(Date.now()), caseId: testCase.id }
    for (const step of testCase.steps) {
      const result = await runApiStep(baseUrl, testCase, step, env, variables, timeoutSeconds)
      lines.push(result.output)
      if (!result.ok) return { ok: false, output: redact(lines.join('\n')) }
    }
  }
  lines.push(`conclusion=PASS cases=${spec.api!.cases.length}`)
  return { ok: true, output: redact(lines.join('\n')) }
}

function readProjectTarget(manifest: ProjectManifest, target: string): ProjectTarget | undefined {
  let current: unknown = manifest
  for (const segment of target.split('.')) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  if (!isRecord(current) || typeof current.command !== 'string' || current.command.trim() === '') return undefined
  return {
    command: current.command,
    cwd: typeof current.cwd === 'string' ? current.cwd : undefined,
    env: isRecord(current.env) ? Object.fromEntries(Object.entries(current.env).filter(([, value]) => typeof value === 'string')) as Record<string, string> : undefined,
  }
}

export async function runProjectTarget(
  root: string,
  manifestFile: string,
  target: string,
  env: NodeJS.ProcessEnv = process.env,
  timeoutSeconds = 1200,
): Promise<{ output: string; exitCode: number }> {
  const manifestPath = isAbsolute(manifestFile) ? manifestFile : resolve(root, manifestFile)
  let manifest: ProjectManifest
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ProjectManifest
  } catch (error) {
    return { output: `cannot read project manifest ${manifestFile}: ${redact(error instanceof Error ? error.message : String(error))}`, exitCode: 2 }
  }
  if (manifest.schemaVersion !== 'acceptance/project/v1') return { output: `unsupported project manifest schema in ${manifestFile}`, exitCode: 2 }
  const definition = readProjectTarget(manifest, target)
  if (!definition) return { output: `project target ${target} must define a command`, exitCode: 2 }
  const cwd = resolve(root, definition.cwd ?? '.')
  const outside = relative(root, cwd).startsWith('..')
  if (outside) return { output: `project target ${target} cwd escapes worktree: ${definition.cwd}`, exitCode: 2 }
  const commandEnv: NodeJS.ProcessEnv = { ...env }
  for (const [name, value] of Object.entries(definition.env ?? {})) commandEnv[name] = expandString(value, env, {})
  const result = await execute('sh', ['-c', definition.command], cwd, timeoutSeconds, commandEnv)
  return { output: `project=${manifestFile} target=${target} cwd=${relative(root, cwd) || '.'}\n${result.output}`, exitCode: result.exitCode }
}

export const __test = { checkAssertion, jsonPathTokens, readJsonPath, expandString }
