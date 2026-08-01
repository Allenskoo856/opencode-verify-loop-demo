import { readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { tool } from '@opencode-ai/plugin'

const protectedPatterns = [/^\.opencode\//, /^e2e\/specs\//, /^verify\/policy\.json$/, /^verify\/gates\//, /^offline\/SHA256SUMS$/]

export default async ({ worktree, client }: any) => ({
  tool: {
    verify_status: tool({
      description: '读取外部 Verify Controller 的最新证据；不能自行判定代码完成。',
      args: { json: tool.schema.boolean().optional() },
      async execute(_args, context) {
        try {
          const root = resolve(worktree, 'artifacts/verify')
          const glob = new Bun.Glob('*/evidence.json')
          const entries: string[] = []
          for await (const entry of glob.scan({ cwd: root })) entries.push(entry)
          const latest = entries.sort().at(-1)
          if (!latest) return { title: 'verify_status', output: 'NO_RUN：尚未有外部验证证据' }
          const evidence = await readFile(resolve(root, latest), 'utf8')
          context.metadata({ title: 'external verification', metadata: { evidence: latest } })
          return { title: 'verify_status', output: evidence }
        } catch { return { title: 'verify_status', output: 'NO_RUN：尚未有外部验证证据' } }
      },
    }),
  },
  event: async ({ event }: any) => {
    if (event.type === 'session.idle') {
      try { await client.tui?.showToast?.({ body: '会话已空闲；请等待外部 verify-loop 判定。', variant: 'warning' }) } catch { /* toast is advisory */ }
    }
  },
  'tool.execute.before': async (input: any) => {
    const args = JSON.stringify(input?.args ?? {}).replaceAll('\\', '/')
    if (protectedPatterns.some((pattern) => pattern.test(args))) throw new Error('verify-policy: 受保护的验收/策略文件不能由模型修改')
  },
})
