<template><main class="shell"><header><h1>订单中心</h1><nav v-if="auth.isAuthenticated"><RouterLink to="/orders">订单</RouterLink><button data-testid="logout" @click="logout">退出</button></nav></header><RouterView /></main></template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
const auth = useAuthStore()
const router = useRouter()
function logout() { auth.signOut(); router.push('/login') }
</script>
