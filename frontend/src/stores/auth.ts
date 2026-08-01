import { defineStore } from 'pinia'
import { login, type User } from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null as User | null, loading: false, error: '' }),
  getters: { isAuthenticated: (state) => Boolean(state.user && sessionStorage.getItem('access_token')) },
  actions: {
    async signIn(email: string, password: string) {
      this.loading = true
      this.error = ''
      try {
        const result = await login(email, password)
        sessionStorage.setItem('access_token', result.accessToken)
        this.user = result.user
      } catch (error: any) {
        this.error = error?.response?.data?.message ?? '登录失败，请检查账号或密码'
        throw error
      } finally {
        this.loading = false
      }
    },
    signOut() {
      this.user = null
      sessionStorage.removeItem('access_token')
    },
  },
})
