import axios from 'axios'

export type User = { id: string; email: string }
export type Order = { id: string; title: string; status: 'CREATED' | 'CANCELLED'; createdAt: string }
export type ApiError = { message?: string }

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api' })

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function login(email: string, password: string) {
  const { data } = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password })
  return data
}

export async function listOrders() {
  const { data } = await api.get<Order[]>('/orders')
  return data
}

export async function createOrder(title: string) {
  const { data } = await api.post<Order>('/orders', { title })
  return data
}

export async function cancelOrder(id: string) {
  const { data } = await api.post<Order>(`/orders/${id}/cancel`)
  return data
}
