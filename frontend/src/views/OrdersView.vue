<template>
  <section class="card"><div class="row"><h2>我的订单</h2><button data-testid="refresh" @click="load">刷新</button></div>
    <form class="row" data-testid="create-order-form" @submit.prevent="create">
      <input v-model.trim="title" data-testid="order-title" maxlength="120" placeholder="订单标题" required />
      <button :disabled="saving">创建订单</button>
    </form>
    <p v-if="message" class="success" role="status">{{ message }}</p><p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="loading">加载中…</p><p v-else-if="orders.length === 0">暂无订单</p>
    <ul v-else class="orders" data-testid="order-list"><li v-for="order in orders" :key="order.id"><span><strong>{{ order.title }}</strong><small>{{ order.status }} · {{ new Date(order.createdAt).toLocaleString() }}</small></span><button v-if="order.status === 'CREATED'" :data-testid="`cancel-${order.id}`" @click="cancel(order.id)">取消</button></li></ul>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { cancelOrder, createOrder, listOrders, type Order } from '../api'
const orders = ref<Order[]>([]); const title = ref(''); const loading = ref(false); const saving = ref(false); const error = ref(''); const message = ref('')
async function load() { loading.value = true; error.value = ''; try { orders.value = await listOrders() } catch { error.value = '订单加载失败，请稍后重试' } finally { loading.value = false } }
async function create() { saving.value = true; error.value = ''; message.value = ''; try { await createOrder(title.value); title.value = ''; message.value = '订单创建成功'; await load() } catch (e: any) { error.value = e?.response?.data?.message ?? '订单创建失败' } finally { saving.value = false } }
async function cancel(id: string) { error.value = ''; try { await cancelOrder(id); message.value = '订单已取消'; await load() } catch { error.value = '订单取消失败，请稍后重试' } }
onMounted(load)
</script>
