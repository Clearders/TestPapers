import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'

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

test('critical authoring and collaboration journey uses the real Cloud stack', async ({ browser }, testInfo) => {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const viewerUsername = `e2e-viewer-${nonce}`.slice(0, 60)
  const viewerPassword = 'ViewerPass123!'
  const questionText = `CLE-17 full-stack question ${nonce}`
  const draftName = `CLE-17 shared draft ${nonce}`
  const commentText = `Review note ${nonce}`

  const registrationContext = await browser.newContext()
  const registrationPage = await registrationContext.newPage()
  await registrationPage.goto('/register')
  await waitForHydration(registrationPage)
  await registrationPage.locator('#register-username').fill(viewerUsername)
  await registrationPage.locator('#register-displayname').fill(`E2E Viewer ${nonce}`)
  await registrationPage.locator('#register-password').fill(viewerPassword)
  await registrationPage.locator('#register-confirmpassword').fill(viewerPassword)
  await registrationPage.getByRole('button', { name: 'Create Account' }).click()
  await expect(registrationPage).toHaveURL(/\/questions(?:\?.*)?$/)
  await registrationContext.close()

  const adminContext = await browser.newContext({ acceptDownloads: true })
  const adminPage = await adminContext.newPage()
  await login(adminPage, adminUsername, adminPassword)

  await adminPage.goto('/add-problem')
  await waitForHydration(adminPage)
  await adminPage.locator('#problem-type').selectOption('short_answer')
  await adminPage.locator('#problem-subject').fill('Mathematics')
  await adminPage.locator('#problem-subject').press('Enter')
  await adminPage.locator('#problem-difficulty').selectOption('medium')
  await adminPage.locator('#problem-text').fill(questionText)
  await adminPage.locator('#problem-answer').fill('42')
  expect(await adminPage.locator('form').evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(true)
  await adminPage.getByRole('button', { name: 'Save Problem' }).click()
  await expect(adminPage.getByText('Problem saved successfully.')).toBeVisible()
  await adminPage.getByRole('link', { name: 'Open the workspace' }).click()
  await expect(adminPage).toHaveURL(/\/questions(?:\?.*)?$/)
  await waitForHydration(adminPage)
  await expect(adminPage.getByRole('button', { name: /User menu for E2E Admin/ })).toBeVisible()

  const questionBankTab = adminPage.getByRole('tab', { name: 'Question Bank' })
  await questionBankTab.click()
  await expect(questionBankTab).toHaveAttribute('aria-selected', 'true')
  await adminPage.getByLabel('Search questions').fill(questionText)
  const questionCard = adminPage.locator('.q-card').filter({ hasText: questionText })
  await expect(questionCard).toHaveCount(1)
  await questionCard.getByRole('button', { name: 'Add to Paper' }).click()

  await adminPage.getByRole('tab', { name: 'Paper Editor' }).click()
  await adminPage.locator('#paper-title').fill(`CLE-17 paper ${nonce}`)
  await adminPage.locator('#paper-subject').fill('Mathematics')
  await adminPage.locator('#paper-duration').fill('45')
  await adminPage.getByRole('button', { name: 'Save Paper' }).click()
  await expect(adminPage.getByText('Paper saved.')).toBeVisible()

  await adminPage.locator('#cloud-draft-name').fill(draftName)
  await adminPage.getByRole('button', { name: 'Create Cloud Draft' }).click()
  await expect(adminPage.locator('.cloud-draft-status')).toContainText('Cloud draft saved')

  const sharingBox = adminPage.locator('.sharing-box')
  await sharingBox.locator('input[name="cloudDraftCollaborator"]').fill(viewerUsername)
  await sharingBox.locator('select[name="cloudDraftCollaboratorRole"]').selectOption('editor')
  await sharingBox.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(sharingBox).toContainText(`@${viewerUsername}`)

  const viewerContext = await browser.newContext()
  const viewerPage = await viewerContext.newPage()
  await login(viewerPage, viewerUsername, viewerPassword)
  const viewerDraftOption = viewerPage.locator('#cloud-draft-select option').filter({ hasText: draftName })
  await expect(viewerDraftOption).toHaveCount(1)
  const viewerDraftId = await viewerDraftOption.getAttribute('value')
  expect(viewerDraftId).toBeTruthy()
  await viewerPage.locator('#cloud-draft-select').selectOption(viewerDraftId!)
  await viewerPage.getByRole('button', { name: 'Load', exact: true }).click()
  await expect(viewerPage.locator('#paper-title')).toHaveValue(`CLE-17 paper ${nonce}`)
  await expect(adminPage.locator('.presence-members')).toContainText(`E2E Viewer ${nonce}`)

  await viewerPage.locator('#paper-title').fill(`Viewer unsaved edit ${nonce}`)
  await expect(adminPage.locator('.presence-member--editing').filter({ hasText: `E2E Viewer ${nonce}` })).toBeVisible()
  await adminPage.locator('#paper-duration').fill('50')
  await adminPage.getByRole('button', { name: 'Save Cloud Draft' }).click()
  await expect(viewerPage.locator('.cloud-draft-status.status-banner--error')).toContainText('This cloud draft changed elsewhere.')
  await viewerPage.getByRole('button', { name: 'Load Latest' }).click()
  await expect(viewerPage.locator('#paper-duration')).toHaveValue('50')

  await viewerPage.getByRole('button', { name: 'Open draft comments' }).click()
  await viewerPage.locator('#draft-comment-message').fill(commentText)
  await viewerPage.getByRole('button', { name: 'Add Comment' }).click()
  await expect(viewerPage.locator('[aria-label="Draft comments"]')).toContainText(commentText)

  await expect(adminPage.locator('.active-cloud-meta')).toContainText('1 open comment')
  const approveButton = adminPage.locator('.review-actions').getByRole('button', { name: 'Approved', exact: true })
  await expect(approveButton).toBeDisabled()
  await expect(approveButton).toHaveAttribute('title', 'Resolve open comments before approval.')

  await viewerPage.locator('.comment-item').filter({ hasText: commentText }).getByRole('button', { name: 'Resolve' }).click()
  await expect(adminPage.locator('.active-cloud-meta')).toContainText('0 open comments')
  await approveButton.click()
  await expect(adminPage.locator('.cloud-draft-head')).toContainText('Approved')

  const responsePromise = adminPage.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname.includes('/api/v1/drafts/')
      && url.pathname.endsWith('/download')
      && url.searchParams.get('format') === 'docx'
  })
  const downloadPromise = adminPage.waitForEvent('download')
  await adminPage.getByRole('button', { name: 'Download Saved Draft' }).click()
  const [downloadResponse, download] = await Promise.all([responsePromise, downloadPromise])
  expect(downloadResponse.status()).toBe(200)
  expect(downloadResponse.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  expect(download.suggestedFilename()).toMatch(/\.docx$/i)

  const downloadPath = testInfo.outputPath('shared-draft.docx')
  await download.saveAs(downloadPath)
  const docxBytes = new Uint8Array(await readFile(downloadPath))
  expect(Array.from(docxBytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
  const documentXml = unzipSync(docxBytes)['word/document.xml']
  expect(documentXml).toBeTruthy()
  expect(strFromU8(documentXml)).toContain(questionText)

  await adminPage.reload()
  await expect(adminPage).toHaveURL(/\/questions(?:\?.*)?$/)
  await adminPage.getByRole('button', { name: /User menu for/ }).click()
  await adminPage.getByRole('button', { name: 'Logout' }).click()
  await expect(adminPage).toHaveURL(/\/login$/)

  await viewerContext.close()
  await adminContext.close()
})
