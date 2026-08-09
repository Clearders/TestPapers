import { expect, test, type Browser, type Page } from '@playwright/test'

const adminUsername = process.env.E2E_ADMIN_USERNAME || 'e2e-admin'
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'E2eAdmin123!'

async function waitForHydration (page: Page) {
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: unknown } | null)?.__vue_app__
  ))
}

async function login (page: Page, username: string, password: string) {
  await page.goto('/login')
  await waitForHydration(page)
  await page.locator('#login-username').fill(username)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/questions(?:\?.*)?$/)
}

async function clickEnabledButton (page: Page, name: string) {
  const button = page.locator('button:enabled').filter({ hasText: name })
  await expect(button).toHaveCount(1)
  await button.click()
}

async function registerViewer (browser: Browser, nonce: string) {
  const username = `e2e-bank-viewer-${nonce}`.slice(0, 60)
  const password = 'ViewerPass123!'
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/register')
  await waitForHydration(page)
  await page.locator('#register-username').fill(username)
  await page.locator('#register-displayname').fill(`Bank Viewer ${nonce}`)
  await page.locator('#register-password').fill(password)
  await page.locator('#register-confirmpassword').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page).toHaveURL(/\/questions(?:\?.*)?$/)
  await context.close()

  return { password, username }
}

test('published bank subscriptions stay version-pinned and forks remain independent', async ({ browser }) => {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const bankName = `CLE-20 public bank ${nonce}`
  const questionV1 = `CLE-20 published question v1 ${nonce}`
  const questionV2 = `CLE-20 published question v2 ${nonce}`
  const answerV1 = `secret answer v1 ${nonce}`
  const viewer = await registerViewer(browser, nonce)

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await login(ownerPage, adminUsername, adminPassword)

  // Create a source question through the real authoring interface.
  await ownerPage.goto('/add-problem')
  await waitForHydration(ownerPage)
  await ownerPage.locator('#problem-type').selectOption('short_answer')
  await ownerPage.locator('#problem-subject').fill('Mathematics')
  await ownerPage.locator('#problem-subject').press('Enter')
  await ownerPage.locator('#problem-difficulty').selectOption('medium')
  await ownerPage.locator('#problem-text').fill(questionV1)
  await ownerPage.locator('#problem-answer').fill(answerV1)
  await ownerPage.getByRole('button', { name: 'Save Problem' }).click()
  await expect(ownerPage.getByText('Problem saved successfully.')).toBeVisible()

  // Planned CLE-20 discovery route: create a public bank, add the question, and publish v1.
  await ownerPage.goto('/banks')
  await waitForHydration(ownerPage)
  await ownerPage.getByRole('button', { name: 'Create bank' }).click()
  await ownerPage.getByLabel('Bank name').fill(bankName)
  await ownerPage.getByLabel('Description').fill('A public lifecycle fixture')
  await ownerPage.getByLabel('Visibility').selectOption('public')
  await ownerPage.getByRole('form', { name: 'Create bank' }).getByRole('button', { name: 'Create bank' }).click()
  await expect(ownerPage).toHaveURL(/\/banks\/[\w-]+$/)
  await ownerPage.getByLabel('Add question to bank').fill(questionV1)
  await ownerPage.getByRole('option', { name: questionV1 }).click()
  await ownerPage.getByRole('button', { name: 'Add question' }).click()
  await expect(
    ownerPage.getByRole('region', { name: 'Bank questions' }).filter({ hasText: questionV1 })
  ).toBeVisible()
  await clickEnabledButton(ownerPage, 'Publish version 1')
  await expect(ownerPage.getByRole('button', { name: 'Withdraw publication' })).toBeVisible()

  const publicLink = ownerPage.getByRole('link', { name: 'Public bank link' })
  await expect(publicLink).toHaveAttribute('href', /\/banks\/[\w-]+$/)
  const publicPath = new URL((await publicLink.getAttribute('href'))!, ownerPage.url()).pathname

  // An unauthenticated visitor sees the immutable public snapshot but never the answer.
  const anonymousContext = await browser.newContext()
  const anonymousPage = await anonymousContext.newPage()
  await anonymousPage.goto(publicPath)
  await waitForHydration(anonymousPage)
  await expect(anonymousPage.getByRole('heading', { name: bankName })).toBeVisible()
  await expect(anonymousPage.getByText(questionV1)).toBeVisible()
  await expect(anonymousPage.getByText(answerV1)).toHaveCount(0)
  await expect(anonymousPage.getByRole('button', { name: 'Subscribe' })).toBeVisible()
  await anonymousPage.getByRole('button', { name: 'Subscribe' }).click()
  await expect(anonymousPage).toHaveURL(url => url.pathname === '/login' && url.searchParams.get('redirect') === publicPath)
  await anonymousContext.close()

  const viewerContext = await browser.newContext()
  const viewerPage = await viewerContext.newPage()
  await login(viewerPage, viewer.username, viewer.password)
  await viewerPage.goto(publicPath)
  await waitForHydration(viewerPage)
  await viewerPage.getByRole('button', { name: 'Subscribe to version 1' }).click()
  await expect(viewerPage.getByRole('heading', { name: 'Subscribed to version 1' })).toBeVisible()
  await clickEnabledButton(viewerPage, 'Fork version 1')
  await expect(viewerPage.getByText('Fork created as a private bank')).toBeVisible()
  const forkLink = viewerPage.getByRole('link', { name: 'Open fork' })
  const forkPath = new URL((await forkLink.getAttribute('href'))!, viewerPage.url()).pathname

  // Publishing v2 requires a withdrawal, then creates a new immutable snapshot.
  await ownerPage.goto(publicPath)
  await waitForHydration(ownerPage)
  await ownerPage.getByRole('button', { name: 'Withdraw publication' }).click()
  await ownerPage.getByRole('button', { name: 'Confirm withdrawal' }).click()
  await expect(ownerPage.getByText('Publication withdrawn')).toBeVisible()

  await ownerPage.goto('/add-problem')
  await waitForHydration(ownerPage)
  await ownerPage.locator('#problem-type').selectOption('short_answer')
  await ownerPage.locator('#problem-subject').fill('Mathematics')
  await ownerPage.locator('#problem-subject').press('Enter')
  await ownerPage.locator('#problem-difficulty').selectOption('medium')
  await ownerPage.locator('#problem-text').fill(questionV2)
  await ownerPage.locator('#problem-answer').fill(`answer v2 ${nonce}`)
  await ownerPage.getByRole('button', { name: 'Save Problem' }).click()
  await expect(ownerPage.getByText('Problem saved successfully.')).toBeVisible()

  await ownerPage.goto(publicPath)
  await waitForHydration(ownerPage)
  await ownerPage.getByLabel('Add question to bank').fill(questionV2)
  await ownerPage.getByRole('option', { name: questionV2 }).click()
  await ownerPage.getByRole('button', { name: 'Add question' }).click()
  await clickEnabledButton(ownerPage, 'Publish version 2')
  await expect(ownerPage.getByRole('button', { name: 'Withdraw publication' })).toBeVisible()

  // The subscription remains pinned until the viewer explicitly advances it.
  await viewerPage.reload()
  await expect(viewerPage.getByText('Update available: version 2')).toBeVisible()
  await expect(viewerPage.getByRole('heading', { name: 'Subscribed to version 1' })).toBeVisible()
  await viewerPage.getByRole('button', { name: 'Update to version 2' }).click()
  await viewerPage.getByRole('button', { name: 'Confirm update' }).click()
  await expect(viewerPage.getByRole('heading', { name: 'Subscribed to version 2' })).toBeVisible()

  // The independently forked v1 bank must not acquire v2 during the subscription update.
  await viewerPage.goto(forkPath)
  await waitForHydration(viewerPage)
  await expect(viewerPage.getByText(questionV1)).toBeVisible()
  await expect(viewerPage.getByText(questionV2)).toHaveCount(0)

  await viewerContext.close()
  await ownerContext.close()
})
