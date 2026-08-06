import { spawn } from 'node:child_process'
import { redact } from './security.js'

export type CommandResult = { output: string; exitCode: number }

export async function execute(
  file: string,
  args: string[],
  cwd: string,
  timeoutSeconds: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CommandResult> {
  return await new Promise((done) => {
    const child = spawn(file, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
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
