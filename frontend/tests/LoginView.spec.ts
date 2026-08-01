import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import LoginView from '../src/views/LoginView.vue'
import { useAuthStore } from '../src/stores/auth'

vi.mock('../src/api', () => ({ login: vi.fn(async () => ({ accessToken: 'test-token', user: { id: '1', email: 'demo@example.com' } })) }))

describe('LoginView', () => {
  it('submits credentials and stores session', async () => {
    const wrapper = mount(LoginView, { global: { plugins: [createPinia()] } })
    await wrapper.get('[data-testid="password"]').setValue('correct')
    await wrapper.get('[data-testid="login-form"]').trigger('submit')
    expect(useAuthStore().user?.email).toBe('demo@example.com')
    expect(sessionStorage.getItem('access_token')).toBe('test-token')
  })
})
