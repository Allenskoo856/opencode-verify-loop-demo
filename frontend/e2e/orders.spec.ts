import { test, expect } from '@playwright/test'

const email = process.env.E2E_USER ?? 'demo@example.com'
const password = process.env.E2E_PASSWORD ?? 'demo-password-only-for-local'

test('login, create and cancel order', async ({ page }) => {
  const title = `verify-${Date.now()}`
  await page.goto('/login')
  await page.getByTestId('email').fill(email)
  await page.getByTestId('password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/orders$/)
  await page.getByTestId('order-title').fill(title)
  await page.getByRole('button', { name: '创建订单' }).click()
  const item = page.getByTestId('order-list').getByText(title)
  await expect(item).toBeVisible()
  const row = item.locator('xpath=../..')
  await row.getByRole('button', { name: '取消' }).click()
  await expect(row).toContainText('CANCELLED')
})

test('invalid login is visible and unauthenticated users are redirected', async ({ page }) => {
  await page.goto('/orders')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByTestId('password').fill('wrong-password')
  await page.getByTestId('login-submit').click()
  await expect(page.getByRole('alert')).toContainText('登录失败')
})
