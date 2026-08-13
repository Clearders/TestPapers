import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const adminUsername = process.env.E2E_ADMIN_USERNAME || 'e2e-admin'
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'E2eAdmin123!'

async function waitForHydration (page: Page) {
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: unknown } | null)?.__vue_app__
  ))
}

async function loginWeb (page: Page, username: string, password: string) {
  await page.goto('/login')
  await waitForHydration(page)
  await page.locator('#login-username').fill(username)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/questions(?:\?.*)?$/)
}

async function nativeToken (api: APIRequestContext, username: string, password: string, deviceId: string) {
  const response = await api.post('/api/v1/auth/token', {
    data: { username, password, deviceId, deviceName: 'CLE-68 E2E' }
  })
  if (!response.ok()) throw new Error(`Native login failed (${response.status()}): ${await response.text()}`)
  return (await response.json()).data.accessToken as string
}

async function push (api: APIRequestContext, token: string, deviceId: string, mutations: Record<string, unknown>[]) {
  const response = await api.post('/api/v1/sync/push', {
    headers: { Authorization: `Bearer ${token}` },
    data: { protocolVersion: 1, batchId: randomUUID(), deviceId, mutations }
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.results as Array<Record<string, unknown>>
}

test('personal Sync recovery survives reload and supports merge, undo, and restore', async ({ page, request }) => {
  const entityId = randomUUID()
  const cloudDevice = `cloud-${randomUUID()}`
  const localDevice = `local-${randomUUID()}`
  const cloudToken = await nativeToken(request, adminUsername, adminPassword, cloudDevice)
  const localToken = await nativeToken(request, adminUsername, adminPassword, localDevice)
  const basePayload = { text: `CLE-68 baseline ${entityId}`, answer: '4', difficulty: 'medium' }
  const created = await push(request, cloudToken, cloudDevice, [{
    operationId: randomUUID(), entityType: 'question', entityId, kind: 'create', payload: basePayload, dependsOn: []
  }])
  expect(created[0]?.status).toBe('applied')
  const baseHash = created[0]?.contentHash as string

  const cloudPayload = { ...basePayload, answer: 'Cloud answer' }
  const cloudUpdate = await push(request, cloudToken, cloudDevice, [{
    operationId: randomUUID(), entityType: 'question', entityId, kind: 'update',
    baseVersion: 1, baseContentHash: baseHash, payload: cloudPayload, dependsOn: []
  }])
  expect(cloudUpdate[0]?.status).toBe('applied')

  const localPayload = { ...basePayload, answer: 'Local answer', explanation: 'Preserved offline explanation' }
  const staleUpdate = await push(request, localToken, localDevice, [{
    operationId: randomUUID(), entityType: 'question', entityId, kind: 'update',
    baseVersion: 1, baseContentHash: baseHash, payload: localPayload, dependsOn: []
  }])
  expect(staleUpdate[0]?.status).toBe('conflict')
  const conflictId = staleUpdate[0]?.conflictId as string
  expect(conflictId).toBeTruthy()

  await loginWeb(page, adminUsername, adminPassword)
  await page.goto(`/sync-recovery?conflict=${conflictId}`)
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Common baseline · Local · Cloud' })).toBeVisible()
  await expect(page.getByText('Not a collaborative revision')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Local answer', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Cloud answer', exact: true })).toBeVisible()

  const merge = page.locator('#manual-merge-payload')
  await merge.fill(JSON.stringify({ ...basePayload, answer: 'Reviewed answer', explanation: 'Combined safely' }, null, 2))
  await page.reload()
  await expect(page.getByText('Recovered unfinished draft')).toBeVisible()
  await expect(page.locator('#manual-merge-payload')).toHaveValue(/Reviewed answer/)

  await page.getByRole('button', { name: 'Accept manual merge' }).click()
  await expect(page.getByText('Resolution accepted as a new auditable version.')).toBeVisible()
  const auditTrail = page.getByRole('region', { name: 'Resolution history' })
  await expect(auditTrail).toContainText('Manual Merge → version 3')

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Undo latest resolution' }).click()
  await expect(page.getByText('The latest resolution was undone as a new auditable version.')).toBeVisible()
  await expect(auditTrail).toContainText('Undo → version 4')

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Restore as new version' }).last().click()
  await expect(page.getByText('Resolution accepted as a new auditable version.')).toBeVisible()
  await expect(auditTrail).toContainText('Restore Version → version 5')
})
