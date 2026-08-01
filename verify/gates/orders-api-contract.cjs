function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

exports.run = async () => {
  const base = required('API_BASE_URL').replace(/\/$/, '')
  const email = required('E2E_USER')
  const password = required('E2E_PASSWORD')
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  if (login.status !== 200) return { ok: false, output: `login expected 200, got ${login.status}` }
  const token = (await login.json()).accessToken
  if (!token) return { ok: false, output: 'login response has no accessToken' }
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const list = await fetch(`${base}/orders`, { headers })
  if (list.status !== 200) return { ok: false, output: `list orders expected 200, got ${list.status}` }
  const create = await fetch(`${base}/orders`, { method: 'POST', headers, body: JSON.stringify({ title: `verify-${Date.now()}` }) })
  if (create.status !== 201) return { ok: false, output: `create order expected 201, got ${create.status}` }
  const order = await create.json()
  const cancel = await fetch(`${base}/orders/${order.id}/cancel`, { method: 'POST', headers })
  return { ok: cancel.status === 200, output: `orders list=200 create=201 cancel=${cancel.status}` }
}
