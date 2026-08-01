import { spawn, spawnSync } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

type Runner = 'shell' | 'http' | 'module'

type GatePolicy = {
  runner: Runner
  command?: string
  url?: string
  module?: string
  expectedStatus?: number
  timeoutSeconds?: number
  requires?: Record<string, string>
}

type Policy = {
  schemaVersion: string
  protected: string[]
  defaults?: { timeoutSeconds?: number }
  profiles: Record<string, string[]>
  gates: Record<string, GatePolicy>
}

type GateEvidence = {
  name: string
  runner: Runner
  target: string
  status: 'PASS' | 'FAIL' | 'BLOCKED'
  exitCode: number
  durationMs: number
  outputFile?: string
}

type Evidence = {
  schemaVersion: 'verify/v2'
  runId: string
  profile: string
  model?: string
  baseSha: string
  startedAt: string
  finishedAt: string
  iteration: number
  conclusion: 'PASS' | 'FAILED' | 'BLOCKED_PROTECTED_PATH'
  policyFile: string
  gates: GateEvidence[]
  protectedViolation?: string[]
}

type CommandResult = { output: string; exitCode: number }

const secretPattern = /(authorization:\s*bearer\s+|password|passwd|secret|token|api[_-]?key|cookie)(\s*[=:]\s*|\s+)[^\s,;]+/gi

function redact(value: string): string {
  return value
    .replace(secretPattern, '$1$2[REDACTED]')
    .replace(/gho_[A-Za-z0-9_]+/g, 'gho_[REDACTED]')
}

function rootDir(): string {
  return process.env.VERIFY_WORKTREE ? resolve(process.env.VERIFY_WORKTREE) : process.cwd()
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

export function expandEnv(input: string, env: NodeJS.ProcessEnv = process.env): string {
  return input.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_match, name: string) => env[name] ?? '')
}

export function isProtectedPath(file: string, patterns: string[]): boolean {
  const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '')
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replaceAll('\\', '/').replace(/^\.\//, '')
    if (normalizedPattern.endsWith('/**')) return normalized.startsWith(normalizedPattern.slice(0, -2))
    return normalized === normalizedPattern
  })
}

function protectedChanges(root: string, baseSha: string, patterns: string[]): string[] {
  const changed = git(root, ['diff', '--name-only', baseSha, '--']).split('\n').filter(Boolean)
  for (const entry of git(root, ['status', '--porcelain']).split('\n')) {
    if (entry.length >= 4) changed.push(entry.slice(3).trim())
  }
  return [...new Set(changed.filter((file) => isProtectedPath(file, patterns)))]
}

async function execute(file: string, args: string[], cwd: string, timeoutSeconds: number): Promise<CommandResult> {
  return await new Promise((done) => {
    const child = spawn(file, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.stderr.on('data', (chunk) => { output += String(chunk) })
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutSeconds * 1000)
    child.on('error', (error) => {
      clearTimeout(timer)
      done({ output: redact(`${output}\n${error.message}`), exitCode: 127 })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const exitCode = signal === 'SIGTERM' ? 124 : (code ?? 1)
      done({ output: redact(output), exitCode })
    })
  })
}

function requirementFailure(requires: Record<string, string> | undefined): string | undefined {
  for (const [name, expected] of Object.entries(requires ?? {})) {
    const actual = process.env[name]
    if (expected === 'present' && actual) continue
    if (expected !== 'present' && actual === expected) continue
    return `${name} must be ${expected === 'present' ? 'set' : JSON.stringify(expected)}`
  }
  return undefined
}

async function executeGate(root: string, gate: GatePolicy, timeoutSeconds: number): Promise<CommandResult> {
  const requirement = requirementFailure(gate.requires)
  if (requirement) return { output: requirement, exitCode: 2 }
  if (gate.runner === 'shell') {
    if (!gate.command) return { output: 'shell gate is missing command', exitCode: 2 }
    return execute('sh', ['-c', expandEnv(gate.command)], root, timeoutSeconds)
  }
  if (gate.runner === 'http') {
    if (!gate.url) return { output: 'http gate is missing url', exitCode: 2 }
    const target = expandEnv(gate.url)
    if (!target) return { output: 'http gate URL expanded to an empty value', exitCode: 2 }
    const signal = AbortSignal.timeout(timeoutSeconds * 1000)
    try {
      const response = await fetch(target, { signal })
      const body = (await response.text()).slice(0, 4096)
      const expected = gate.expectedStatus ?? 200
      return { output: `${response.status} ${target}\n${body}`, exitCode: response.status === expected ? 0 : 1 }
    } catch (error) {
      return { output: redact(error instanceof Error ? error.message : String(error)), exitCode: 1 }
    }
  }
  if (!gate.module) return { output: 'module gate is missing module', exitCode: 2 }
  try {
    const modulePath = resolve(root, expandEnv(gate.module))
    // CJS keeps this adapter dependency-free and is available on Node 20/22.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require(modulePath) as { run?: (context: { root: string; env: NodeJS.ProcessEnv }) => Promise<{ ok: boolean; output: string }> | { ok: boolean; output: string } }
    if (!plugin.run) return { output: `module ${modulePath} has no run(context) export`, exitCode: 2 }
    const result = await plugin.run({ root, env: process.env })
    return { output: redact(result.output), exitCode: result.ok ? 0 : 1 }
  } catch (error) {
    return { output: redact(error instanceof Error ? error.stack ?? error.message : String(error)), exitCode: 1 }
  }
}

async function writeFile(root: string, runId: string, name: string, content: string): Promise<string> {
  const file = resolve(root, 'artifacts', 'verify', runId, `${name}.log`)
  await fs.mkdir(dirname(file), { recursive: true, mode: 0o750 })
  await fs.writeFile(file, content, { mode: 0o600 })
  return relative(root, file)
}

function nowRunId(): string {
  return new Date().toISOString().replace(/[-:.]/g, '').replace('T', 'T').replace('Z', 'Z')
}

async function loadPolicy(root: string, policyFile: string): Promise<Policy> {
  const target = isAbsolute(policyFile) ? policyFile : resolve(root, policyFile)
  return JSON.parse(await fs.readFile(target, 'utf8')) as Policy
}

async function saveEvidence(root: string, evidence: Evidence): Promise<string> {
  const file = resolve(root, 'artifacts', 'verify', evidence.runId, 'evidence.json')
  await fs.mkdir(dirname(file), { recursive: true, mode: 0o750 })
  await fs.writeFile(file, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  return relative(root, file)
}

async function verify(root: string, policyFile: string, profile: string, model: string | undefined, runId: string, iteration: number, baseSha: string): Promise<{ evidence: Evidence; code: number }> {
  const policy = await loadPolicy(root, policyFile)
  const startedAt = new Date().toISOString()
  const violations = protectedChanges(root, baseSha, policy.protected)
  const evidence: Evidence = {
    schemaVersion: 'verify/v2', runId, profile, model, baseSha, startedAt, finishedAt: startedAt,
    iteration, conclusion: 'FAILED', policyFile, gates: [], protectedViolation: violations,
  }
  if (violations.length > 0) {
    evidence.conclusion = 'BLOCKED_PROTECTED_PATH'
    evidence.finishedAt = new Date().toISOString()
    console.log(`protected paths changed: ${violations.join(', ')}`)
    return { evidence, code: 1 }
  }
  const names = policy.profiles[profile]
  if (!names) throw new Error(`unknown profile ${profile}`)
  for (const name of names) {
    const gate = policy.gates[name]
    if (!gate) throw new Error(`profile ${profile} references unknown gate ${name}`)
    const started = Date.now()
    const target = gate.command ?? gate.url ?? gate.module ?? ''
    const result = await executeGate(root, gate, gate.timeoutSeconds ?? policy.defaults?.timeoutSeconds ?? 1200)
    const status: GateEvidence['status'] = result.exitCode === 0 ? 'PASS' : (result.exitCode === 2 ? 'BLOCKED' : 'FAIL')
    const outputFile = await writeFile(root, runId, `${iteration}-${name}`, result.output)
    const item: GateEvidence = { name, runner: gate.runner, target: redact(target), status, exitCode: result.exitCode, durationMs: Date.now() - started, outputFile }
    evidence.gates.push(item)
    console.log(`gate=${name} runner=${gate.runner} status=${status} exit=${result.exitCode} duration_ms=${item.durationMs}`)
    if (result.exitCode !== 0) break
  }
  evidence.conclusion = evidence.gates.every((gate) => gate.status === 'PASS') && evidence.gates.length === names.length ? 'PASS' : 'FAILED'
  evidence.finishedAt = new Date().toISOString()
  console.log(`conclusion=${evidence.conclusion}`)
  return { evidence, code: evidence.conclusion === 'PASS' ? 0 : 1 }
}

function parseFlags(values: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) continue
    const [name, inline] = value.slice(2).split('=', 2)
    flags[name] = inline ?? values[index + 1] ?? ''
    if (inline === undefined) index += 1
  }
  return flags
}

async function opencodePrompt(root: string, model: string | undefined, prompt: string, first: boolean): Promise<CommandResult> {
  const args = ['run', '--dir', root, '--format', 'json']
  if (model) args.push('--model', model)
  if (!first) args.push('--continue')
  args.push(prompt)
  return execute('opencode', args, root, 20 * 60)
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const flags = parseFlags(process.argv.slice(3))
  const root = rootDir()
  const policyFile = flags.policy ?? 'verify/policy.json'
  if (!command) throw new Error('usage: verify-loop verify|run|status|doctor|version')
  if (command === 'version') { console.log('verify-loop-ts 0.2.0'); return }
  if (command === 'doctor') {
    const needOpenCode = flags['require-opencode'] === 'true'
    const checks = {
      worktree: root,
      node: process.version,
      policy: existsSync(resolve(root, policyFile)),
      opencode: Boolean(spawnSync('sh', ['-c', 'command -v opencode'], { encoding: 'utf8' }).stdout.trim()),
    }
    console.log(JSON.stringify(checks, null, 2))
    if (!checks.policy || (needOpenCode && !checks.opencode)) process.exitCode = 2
    return
  }
  if (command === 'status') {
    const evidenceDir = resolve(root, 'artifacts', 'verify')
    const entries = existsSync(evidenceDir) ? await fs.readdir(evidenceDir) : []
    const latest = entries.sort().at(-1)
    if (!latest) { console.log('{"conclusion":"NO_RUN"}'); return }
    console.log(await fs.readFile(resolve(evidenceDir, latest, 'evidence.json'), 'utf8'))
    return
  }
  const profile = flags.profile ?? 'auto'
  const model = flags.model
  const baseSha = git(root, ['rev-parse', 'HEAD']) || 'HEAD'
  const runId = nowRunId()
  if (command === 'verify') {
    const result = await verify(root, policyFile, profile, model, runId, 1, baseSha)
    console.log(await saveEvidence(root, result.evidence))
    process.exitCode = result.code
    return
  }
  if (command === 'run') {
    const taskFile = flags['task-file']
    const maxIterations = Number.parseInt(flags['max-iterations'] ?? '5', 10)
    if (!taskFile || !Number.isFinite(maxIterations) || maxIterations < 1) throw new Error('--task-file and a positive --max-iterations are required')
    const task = await fs.readFile(resolve(root, taskFile), 'utf8')
    let first = true
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const result = await verify(root, policyFile, profile, model, runId, iteration, baseSha)
      const evidenceFile = await saveEvidence(root, result.evidence)
      console.log(evidenceFile)
      if (result.code === 0) return
      const feedback = `外部 Verify Controller 第 ${iteration} 轮未通过。不要修改 verify/policy.json、verify/gates/、.opencode/ 或 e2e/specs/ 来规避失败。请根据证据 ${evidenceFile} 修复实现，然后等待下一轮验证。任务：\n${task}`
      const continuation = await opencodePrompt(root, model, feedback, first)
      first = false
      if (continuation.exitCode !== 0) throw new Error(`OpenCode continuation failed: ${continuation.output}`)
    }
    process.exitCode = 1
    return
  }
  throw new Error(`unknown command: ${command}`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(redact(error instanceof Error ? error.stack ?? error.message : String(error)))
    process.exitCode = 2
  })
}

export const __test = { redact, requirementFailure }
