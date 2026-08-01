exports.run = async ({ env }) => {
  if (env.TARGET_ENV !== 'staging') return { ok: false, output: 'TARGET_ENV must equal staging; production mutation is forbidden.' }
  if (env.ALLOW_MUTATING_E2E !== 'true') return { ok: false, output: 'ALLOW_MUTATING_E2E=true is required for create/cancel test data.' }
  if ((env.E2E_BASE_URL ?? '').includes('production')) return { ok: false, output: 'E2E_BASE_URL looks like production and is refused.' }
  return { ok: true, output: 'staging mutation guard passed' }
}
