<template>
  <section class="card narrow"><h2>登录</h2><form data-testid="login-form" @submit.prevent="submit">
    <label>邮箱<input v-model.trim="email" data-testid="email" type="email" autocomplete="username" required /></label>
    <label>密码<input v-model="password" data-testid="password" type="password" autocomplete="current-password" required /></label>
    <p v-if="auth.error" class="error" role="alert">{{ auth.error }}</p>
    <button data-testid="login-submit" :disabled="auth.loading">{{ auth.loading ? '登录中…' : '登录' }}</button>
  </form></section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore(); const router = useRouter()
const email = ref('demo@example.com'); const password = ref('demo-password-only-for-local')
async function submit() { try { await auth.signIn(email.value, password.value); await router.push('/orders') } catch { /* error is displayed by store */ } }
</script>
