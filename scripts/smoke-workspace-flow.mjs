import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HOST = '127.0.0.1'
const APP_PORT = Number(process.env.SMOKE_WORKSPACE_PORT || 4178)
const DEBUG_PORT = Number(process.env.SMOKE_WORKSPACE_DEBUG_PORT || 9224)
const BASE_URL = `http://${HOST}:${APP_PORT}`
const TIMEOUT_MS = 45_000

const testUser = {
  id: 9001,
  publicId: 'usr-smoke-workspace',
  username: 'smoke.teacher',
  displayName: 'Smoke Teacher',
  role: 'admin',
  permissions: ['questions:read', 'questions:write', 'questions:delete', 'answers:read', 'papers:read', 'papers:write', 'users:manage'],
  isActive: true,
  avatarUrl: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}


const limitedUser = {
  ...testUser,
  id: 9002,
  publicId: 'usr-smoke-limited',
  username: 'smoke.limited',
  displayName: 'Smoke Limited',
  role: 'viewer',
  permissions: [],
}

let authMode = 'full'
let protectedRequests = []
const sampleQuestions = [{
  id: 101,
  publicId: 'q-smoke-101',
  type: 'single_choice',
  subjects: ['Mathematics'],
  difficulty: 'easy',
  tags: ['smoke'],
  text: 'Smoke draft restoration question: 2 + 2 = ?',
  options: ['3', '4', '5', '6'],
  answer: '4',
  hasLatex: false,
  source: 'Workspace smoke',
  images: [],
  scoreWeight: 1,
  ownerId: testUser.id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}]

let appProcess
let browserProcess
let browserDir

function log(message) {
  console.log(`[workspace-smoke] ${message}`)
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function apiEnvelope(data) {
  return { success: true, data, error: null, meta: { requestId: 'workspace-smoke', timestamp: new Date().toISOString() } }
}

function currentAuthUser() {
  if (authMode === 'anonymous') return null
  return authMode === 'limited' ? limitedUser : testUser
}

function apiResponseFor(url) {
  const parsed = new URL(url)
  const path = parsed.pathname.replace(/^\/api\/v1/, '')
  const currentUser = currentAuthUser()
  if (path === '/auth/refresh') return apiEnvelope(currentUser ? { user: currentUser, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() } : null)
  if (path === '/auth/me') return apiEnvelope(currentUser)
  if (authMode !== 'full' && (path === '/questions' || path === '/questions/mine' || path === '/meta/subjects' || path === '/meta/tags')) {
    protectedRequests.push(path)
  }
  if (path === '/questions' || path === '/questions/mine') {
    return apiEnvelope({
      items: sampleQuestions,
      pagination: { page: 1, pageSize: 20, total: sampleQuestions.length, totalPages: 1 }
    })
  }
  if (path === '/meta/subjects') return apiEnvelope(['Mathematics'])
  if (path === '/meta/tags') return apiEnvelope(['smoke'])
  if (/^\/questions\/[^/]+\/corrections$/.test(path)) return apiEnvelope([])
  if (/^\/questions\/[^/]+\/revisions$/.test(path)) return apiEnvelope([])
  return apiEnvelope({})
}

async function waitForUrl(url, timeoutMs = TIMEOUT_MS) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, res => {
          res.resume()
          res.statusCode && res.statusCode < 500 ? resolve() : reject(new Error(`HTTP ${res.statusCode}`))
        })
        req.on('error', reject)
        req.setTimeout(1000, () => req.destroy(new Error('timeout')))
      })
      return
    } catch {
      await delay(500)
    }
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function startApp() {
  log(`starting Nuxt dev server on ${BASE_URL}`)
  appProcess = spawn(process.execPath, ['scripts/run-nuxi.mjs', 'dev', '--host', HOST, '--port', String(APP_PORT)], {
    cwd: new URL('..', import.meta.url),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NUXT_PUBLIC_WS_BASE: 'ws://127.0.0.1:9/ws' }
  })
  appProcess.stdout.on('data', chunk => {
    const text = chunk.toString()
    if (/Local:|ready|Nuxt/i.test(text)) process.stdout.write(text)
  })
  appProcess.stderr.on('data', chunk => process.stderr.write(chunk))
}

function candidateBrowsers() {
  return [...new Set([
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    `${process.env.LOCALAPPDATA || ''}\\Microsoft\\Edge\\Application\\msedge.exe`
  ].filter(Boolean))]
}

function findBrowser() {
  const browser = candidateBrowsers().find(path => existsSync(path))
  if (!browser) throw new Error('Could not find Chrome or Edge. Set CHROME_PATH or EDGE_PATH to run the browser smoke test.')
  return browser
}

function startBrowser() {
  const browserPath = findBrowser()
  browserDir = join(tmpdir(), `testpapers-workspace-smoke-${randomBytes(6).toString('hex')}`)
  mkdirSync(browserDir, { recursive: true })
  log(`launching ${browserPath}`)
  browserProcess = spawn(browserPath, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${browserDir}`,
    '--headless=new',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-gpu-rasterization',
    '--disable-software-rasterizer',
    '--disable-3d-apis',
    '--disable-accelerated-2d-canvas',
    '--disable-accelerated-video-decode',
    '--disable-features=Vulkan,UseSkiaRenderer,UseDawn,CanvasOopRasterization',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  browserProcess.stderr.on('data', chunk => {
    const text = chunk.toString()
    if (!/DevTools listening|ERROR:CONSOLE|ssl_client_socket/i.test(text)) process.stderr.write(text)
  })
}

async function requestJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`${method} ${url} failed with HTTP ${res.statusCode}: ${body}`))
          return
        }
        try { resolve(JSON.parse(body)) } catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

class CdpClient {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.handlers = new Map()
    this.buffer = Buffer.alloc(0)
    socket.on('data', chunk => this.onData(chunk))
    socket.on('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('CDP socket closed'))
      this.pending.clear()
    })
  }

  static async connect(webSocketDebuggerUrl) {
    const url = new URL(webSocketDebuggerUrl)
    const key = randomBytes(16).toString('base64')
    const socket = net.connect(Number(url.port), url.hostname)
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('error', reject)
    })
    socket.write([
      `GET ${url.pathname}${url.search} HTTP/1.1`,
      `Host: ${url.host}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '',
      ''
    ].join('\r\n'))
    await new Promise((resolve, reject) => {
      let response = ''
      const onData = chunk => {
        response += chunk.toString('latin1')
        if (!response.includes('\r\n\r\n')) return
        socket.off('data', onData)
        const headersEnd = response.indexOf('\r\n\r\n')
        const headerLines = response.slice(0, headersEnd).split('\r\n')
        const statusLine = headerLines.shift() || ''
        const statusCode = Number(statusLine.split(/\s+/)[1])
        const headers = new Map()
        for (const line of headerLines) {
          const separatorIndex = line.indexOf(':')
          if (separatorIndex === -1) continue
          headers.set(line.slice(0, separatorIndex).trim().toLowerCase(), line.slice(separatorIndex + 1).trim())
        }
        const expectedAccept = createHash('sha1')
          .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
          .digest('base64')
        if (statusCode !== 101) {
          reject(new Error(`WebSocket upgrade failed: ${statusLine}`))
          return
        }
        if (headers.get('sec-websocket-accept') !== expectedAccept) {
          reject(new Error('WebSocket upgrade failed: invalid Sec-WebSocket-Accept header'))
          return
        }
        resolve()
      }
      socket.on('data', onData)
      socket.once('error', reject)
    })
    return new CdpClient(socket)
  }

  on(event, handler) {
    this.handlers.set(event, handler)
  }

  send(method, params = {}) {
    const id = this.nextId++
    this.socket.write(encodeFrame(Buffer.from(JSON.stringify({ id, method, params }))))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length) {
      const frame = decodeFrame(this.buffer)
      if (!frame) return
      this.buffer = this.buffer.subarray(frame.bytesRead)
      if (!frame.payload.length) continue
      const message = JSON.parse(frame.payload.toString('utf8'))
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result)
      } else if (message.method && this.handlers.has(message.method)) {
        void this.handlers.get(message.method)(message.params)
      }
    }
  }

  close() {
    this.socket.end()
  }
}

function encodeFrame(payload) {
  const length = payload.length
  if (length >= 65536) throw new Error('CDP frame too large')
  const short = length < 126
  const header = Buffer.alloc(short ? 6 : 8)
  header[0] = 0x81
  header[1] = 0x80 | (short ? length : 126)
  if (!short) header.writeUInt16BE(length, 2)
  const maskOffset = short ? 2 : 4
  randomBytes(4).copy(header, maskOffset)
  const mask = header.subarray(maskOffset, maskOffset + 4)
  const masked = Buffer.from(payload)
  for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i % 4]
  return Buffer.concat([header, masked])
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null
  const firstLength = buffer[1] & 0x7f
  let offset = 2
  let length = firstLength
  if (firstLength === 126) {
    if (buffer.length < 4) return null
    length = buffer.readUInt16BE(2)
    offset = 4
  } else if (firstLength === 127) {
    throw new Error('Unsupported large CDP frame')
  }
  const masked = Boolean(buffer[1] & 0x80)
  const maskOffset = offset
  if (masked) offset += 4
  if (buffer.length < offset + length) return null
  const payload = Buffer.from(buffer.subarray(offset, offset + length))
  if (masked) {
    const mask = buffer.subarray(maskOffset, maskOffset + 4)
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]
  }
  return { payload, bytesRead: offset + length }
}

async function createPageClient() {
  const newPage = await requestJson(`http://${HOST}:${DEBUG_PORT}/json/new?${encodeURIComponent(`${BASE_URL}/questions`)}`, 'PUT')
  if (newPage.webSocketDebuggerUrl) return await CdpClient.connect(newPage.webSocketDebuggerUrl)
  const pages = await requestJson(`http://${HOST}:${DEBUG_PORT}/json/list`)
  const page = pages.find(item => item.id === newPage.id) || pages.find(item => item.type === 'page' && item.url.includes('/questions')) || pages.find(item => item.type === 'page')
  if (!page) throw new Error('Could not create browser tab')
  return await CdpClient.connect(page.webSocketDebuggerUrl)
}

function jsExpression(source) {
  return `(() => { ${source} })()`
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}

async function waitFor(cdp, predicate, label, timeoutMs = TIMEOUT_MS) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeoutMs) {
    try {
      if (await evaluate(cdp, predicate)) return
    } catch (error) {
      lastError = error
    }
    await delay(250)
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`)
}

async function assertVisiblePage(cdp, label) {
  const state = await evaluate(cdp, jsExpression(`
    const body = document.body
    const main = document.querySelector('main')
    const text = body ? body.innerText.trim() : ''
    const error = document.querySelector('.error-fallback')
    return {
      path: location.pathname,
      textLength: text.length,
      mainHeight: main ? main.getBoundingClientRect().height : 0,
      errorText: error ? error.innerText : ''
    }
  `))
  if (state.textLength < 20 || state.mainHeight < 40 || state.errorText) {
    throw new Error(`${label} rendered blank or errored: ${JSON.stringify(state)}`)
  }
  log(`${label} rendered (${state.path})`)
}

async function clickByText(cdp, selector, text) {
  const clicked = await evaluate(cdp, jsExpression(`
    const target = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find(el => el.innerText && el.innerText.includes(${JSON.stringify(text)}) && el.getClientRects().length && !el.disabled)
    if (!target) return false
    target.click()
    return true
  `))
  if (!clicked) throw new Error(`Could not click ${selector} containing "${text}"`)
}

async function clickByTextUntil(cdp, selector, text, predicate, label, timeoutMs = TIMEOUT_MS) {
  const started = Date.now()
  let lastState = null
  while (Date.now() - started < timeoutMs) {
    const state = await evaluate(cdp, jsExpression(`
      const target = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find(el => el.innerText && el.innerText.includes(${JSON.stringify(text)}) && el.getClientRects().length && !el.disabled)
      if (target) target.click()
      return {
        clicked: Boolean(target),
        matched: Boolean(${predicate})
      }
    `))
    lastState = state
    if (state.matched) return
    await delay(250)
  }
  throw new Error(`Could not activate ${label}: ${JSON.stringify(lastState)}`)
}

async function clickByAriaLabel(cdp, selector, label) {
  const clicked = await evaluate(cdp, jsExpression(`
    const target = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find(el => el.getAttribute('aria-label') === ${JSON.stringify(label)} && el.getClientRects().length && !el.disabled)
    if (!target) return false
    target.click()
    return true
  `))
  if (!clicked) throw new Error(`Could not click ${selector} with aria-label "${label}"`)
}

function workspaceDraftKey(userId) {
  return userId ? `testpapers.workspaceDraft.v1.${userId}` : 'testpapers.workspaceDraft.v1.guest'
}

function sampleWorkspaceDraft() {
  return {
    version: 1,
    paper: {
      title: 'Workspace Access Draft',
      subject: 'Mathematics',
      duration: 60,
      totalMarks: 100,
      questions: sampleQuestions
    },
    generationForm: {
      difficultyCoefficient: 0.5,
      questionTypes: ['single_choice'],
      typeCounts: { single_choice: 1 },
      subjects: [],
      requiredTagsStr: '',
      requiredTags: [],
      preferredTagsStr: '',
      preferredTags: [],
      customTagInput: ''
    },
    exportMode: 'paper',
    layoutDensity: 'auto',
    includeAnswersInExport: false,
    savedPaperId: null,
    savedPaperSignature: '',
    generationDiagnostics: null
  }
}

async function installApiMocks(cdp) {
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${BASE_URL}/api/v1/*` }] })
  cdp.on('Fetch.requestPaused', async params => {
    const body = Buffer.from(JSON.stringify(apiResponseFor(params.request.url))).toString('base64')
    await cdp.send('Fetch.fulfillRequest', {
      requestId: params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
      body
    })
  })
}

async function seedWorkspaceDraft(cdp, key) {
  const draft = sampleWorkspaceDraft()
  await evaluate(cdp, jsExpression(`
    localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(draft))})
    return true
  `))
  await cdp.send('Page.reload', { ignoreCache: true })
}

async function setWorkspaceMetadata(cdp, titleValue, subjectValue) {
  await evaluate(cdp, jsExpression(`
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const setInput = (selector, value) => {
      const input = document.querySelector(selector)
      if (!input) return false
      valueSetter.call(input, value)
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    return setInput('#paper-title', ${JSON.stringify(titleValue)}) && setInput('#paper-subject', ${JSON.stringify(subjectValue)})
  `))
  await waitFor(
    cdp,
    `document.querySelector('#paper-title')?.value === ${JSON.stringify(titleValue)} && document.querySelector('#paper-subject')?.value === ${JSON.stringify(subjectValue)}`,
    'Workspace metadata entry'
  )
}

async function runAccessSmoke(cdp, mode, expectedPrompt, draftKey, label) {
  authMode = mode
  protectedRequests = []
  await installApiMocks(cdp)
  await cdp.send('Page.navigate', { url: `${BASE_URL}/questions?smoke=${mode}` })
  await waitFor(cdp, `document.querySelector('#paper-title') && document.body.innerText.includes('Paper Editor')`, `${label} Workspace shell`)
  await seedWorkspaceDraft(cdp, draftKey)
  await waitFor(cdp, `document.querySelector('#paper-title')?.value === 'Workspace Access Draft' && document.body.innerText.includes('Q1')`, `${label} restored draft`)
  await evaluate(cdp, jsExpression(`
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const title = document.querySelector('#paper-title')
    valueSetter.call(title, 'Workspace Access Draft')
    title.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Workspace Access Draft' }))
    const subject = document.querySelector('#paper-subject')
    valueSetter.call(subject, 'Mathematics')
    subject.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Mathematics' }))
  `))
  await evaluate(cdp, jsExpression(`
    window.__workspacePrintCount = 0
    window.print = () => { window.__workspacePrintCount += 1 }
    return true
  `))
  await clickByAriaLabel(cdp, 'button', 'Print paper')
  const printState = await evaluate(cdp, jsExpression(`
    return {
      printCount: window.__workspacePrintCount,
      hasExpectedPrompt: document.body.innerText.includes(${JSON.stringify(expectedPrompt)}),
      bodyText: document.body.innerText.slice(0, 1200)
    }
  `))
  if (printState.printCount !== 0 || !printState.hasExpectedPrompt) {
    throw new Error(`${label} print access bypassed export rules: ${JSON.stringify(printState)}`)
  }
  await clickByAriaLabel(cdp, 'button', 'Close')
  await waitFor(cdp, `!document.body.innerText.includes(${JSON.stringify(expectedPrompt)})`, `${label} print access prompt dismissed`)
  await evaluate(cdp, jsExpression(`
    const exportButton = [...document.querySelectorAll('button')].find(el => el.innerText && el.innerText.includes('Export Paper'))
    if (!exportButton) return false
    exportButton.disabled = false
    return true
  `))
  await clickByText(cdp, 'button', 'Export Paper')
  const exportState = await evaluate(cdp, jsExpression(`
    const exportButton = [...document.querySelectorAll('button')].find(el => el.innerText && el.innerText.includes('Export Paper'))
    return {
      exportButtonDisabled: exportButton ? exportButton.disabled : null,
      hasExpectedPrompt: document.body.innerText.includes(${JSON.stringify(expectedPrompt)}),
      hasPreview: document.body.innerText.includes('Questions follow the order from the paper builder.'),
      bodyText: document.body.innerText.slice(0, 1200)
    }
  `))
  if (!exportState.hasExpectedPrompt) {
    throw new Error(`${label} export prompt missing: ${JSON.stringify(exportState)}`)
  }
  await clickByText(cdp, 'button', 'Open Bank')
  await waitFor(cdp, `document.body.innerText.includes(${JSON.stringify(mode === 'anonymous' ? 'Create an account to use the question bank' : 'Question bank access required')})`, `${label} access card`)
  if (protectedRequests.length) throw new Error(`${label} made protected requests: ${protectedRequests.join(', ')}`)
  await assertVisiblePage(cdp, `${label} Workspace`)
  log(`${label} access smoke passed`)
}

async function runSmoke(cdp) {
  authMode = 'full'
  protectedRequests = []
  await installApiMocks(cdp)

  await cdp.send('Page.navigate', { url: `${BASE_URL}/questions` })
  await waitFor(cdp, `document.querySelector('#paper-title') && document.body.innerText.includes('Paper Editor')`, 'Workspace editor')
  await assertVisiblePage(cdp, 'Workspace')

  await setWorkspaceMetadata(cdp, 'Workspace Smoke Draft', 'Mathematics')
  try {
    await clickByTextUntil(
      cdp,
      'button',
      'Open Bank',
      `location.search.includes('section=bank') && !document.querySelector('#paper-title')`,
      'Workspace bank tab'
    )
  } catch (error) {
    const tabState = await evaluate(cdp, jsExpression(`
      return {
        path: location.pathname,
        search: location.search,
        hasPaperTitle: Boolean(document.querySelector('#paper-title')),
        buttons: [...document.querySelectorAll('button')].map(button => button.innerText).slice(0, 20),
        text: document.body.innerText.slice(0, 1600)
      }
    `))
    throw new Error(`Workspace bank tab did not activate: ${JSON.stringify(tabState)}; ${error.message}`, { cause: error })
  }
  try {
    await waitFor(cdp, `document.body.innerText.includes('Smoke draft restoration question')`, 'Workspace question bank')
  } catch (error) {
    const bankState = await evaluate(cdp, jsExpression(`
      return {
        path: location.pathname,
        search: location.search,
        hasPaperTitle: Boolean(document.querySelector('#paper-title')),
        text: document.body.innerText.slice(0, 1600)
      }
    `))
    throw new Error(`Workspace question bank did not load: ${JSON.stringify(bankState)}; ${error.message}`, { cause: error })
  }
  await clickByTextUntil(
    cdp,
    'button',
    'Add to Paper',
    `document.body.innerText.includes('Remove from Paper')`,
    'question added to paper'
  )
  try {
    await clickByTextUntil(
      cdp,
      'button',
      'Paper Editor',
      `document.body.innerText.includes('Q1') && document.querySelector('#paper-title')`,
      'draft paper build'
    )
  } catch (error) {
    const draftState = await evaluate(cdp, jsExpression(`
      return {
        path: location.pathname,
        search: location.search,
        titleValue: document.querySelector('#paper-title')?.value ?? null,
        subjectValue: document.querySelector('#paper-subject')?.value ?? null,
        hasQ1: document.body.innerText.includes('Q1'),
        selectedText: [...document.querySelectorAll('.workspace-stats .tag')].map(item => item.innerText),
        buttons: [...document.querySelectorAll('button')].map(button => button.innerText).slice(0, 30),
        text: document.body.innerText.slice(0, 1600)
      }
    `))
    throw new Error(`Draft paper build did not activate: ${JSON.stringify(draftState)}; ${error.message}`, { cause: error })
  }
  await setWorkspaceMetadata(cdp, 'Workspace Smoke Draft', 'Mathematics')
  await evaluate(cdp, jsExpression(`
    const draftName = document.querySelector('#exam-draft-name')
    draftName.value = 'Smoke Named Draft'
    draftName.dispatchEvent(new Event('input', { bubbles: true }))
  `))
  await clickByText(cdp, 'button', 'Save Draft')
  await waitFor(cdp, `document.body.innerText.includes('Draft saved') && [...document.querySelectorAll('#exam-draft-select option')].some(option => option.textContent.includes('Smoke Named Draft'))`, 'named draft saved')
  await evaluate(cdp, jsExpression(`
    window.confirm = () => true
    return true
  `))
  await clickByText(cdp, 'button', 'New Paper')
  await waitFor(cdp, `document.querySelector('#paper-title')?.value === '' && !document.body.innerText.includes('Q1')`, 'new paper cleared editor')
  await evaluate(cdp, jsExpression(`
    const select = document.querySelector('#exam-draft-select')
    const option = [...select.options].find(item => item.textContent.includes('Smoke Named Draft'))
    if (!option) return false
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  `))
  await clickByText(cdp, 'button', 'Load')
  await waitFor(cdp, `document.querySelector('#paper-title')?.value === 'Workspace Smoke Draft' && document.body.innerText.includes('Q1') && document.body.innerText.includes('Editing Smoke Named Draft')`, 'named draft loaded')
  await evaluate(cdp, jsExpression(`
    window.__workspacePrintCount = 0
    window.print = () => { window.__workspacePrintCount += 1 }
    return true
  `))
  await clickByAriaLabel(cdp, 'button', 'Print paper')
  await waitFor(cdp, `window.__workspacePrintCount === 1`, 'authorized preview print')
  await delay(500)

  await cdp.send('Page.reload', { ignoreCache: true })
  await waitFor(cdp, `document.readyState === 'complete' && performance.getEntriesByType('navigation').slice(-1)[0]?.type === 'reload'`, 'Workspace reload')
  await waitFor(cdp, `document.querySelector('#paper-title')?.value === 'Workspace Smoke Draft' && document.body.innerText.includes('Q1')`, 'restored Workspace draft')
  await assertVisiblePage(cdp, 'Workspace after refresh')

  await clickByTextUntil(
    cdp,
    'a.logo',
    'TestPapers',
    `location.pathname === '/' && document.body.innerText.includes('Craft Perfect')`,
    'Home route'
  )
  await assertVisiblePage(cdp, 'Home')

  await clickByTextUntil(
    cdp,
    'a',
    'LaTeX Preview',
    `location.pathname === '/latex' && document.querySelector('.latex-input')`,
    'LaTeX route'
  )
  await assertVisiblePage(cdp, 'LaTeX')

  await evaluate(cdp, jsExpression(`
    const toggle = document.querySelector('button[aria-label="Toggle navigation"]')
    if (toggle && toggle.getClientRects().length && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
    return true
  `))
  await clickByTextUntil(
    cdp,
    'a',
    'Workspace',
    `location.pathname === '/questions' && document.querySelector('#paper-title')`,
    'Workspace return'
  )
  await assertVisiblePage(cdp, 'Workspace return')
}

async function cleanup(cdp) {
  try { cdp?.close() } catch { /* ignore close errors */ }
  if (browserProcess && !browserProcess.killed) browserProcess.kill()
  if (appProcess && !appProcess.killed) appProcess.kill()
  if (browserDir) {
    try { rmSync(browserDir, { recursive: true, force: true }) } catch { /* ignore cleanup errors */ }
  }
}

let cdp
try {
  startApp()
  await waitForUrl(BASE_URL)
  startBrowser()
  await waitForUrl(`http://${HOST}:${DEBUG_PORT}/json/version`)

  cdp = await createPageClient()
  await runAccessSmoke(cdp, 'anonymous', 'Create an account to export papers', workspaceDraftKey(null), 'Anonymous')
  cdp.close()

  cdp = await createPageClient()
  await runAccessSmoke(cdp, 'limited', 'Export permission required', workspaceDraftKey(limitedUser.id), 'Limited-permission')
  cdp.close()

  cdp = await createPageClient()
  await runSmoke(cdp)
  log('Workspace flow smoke passed')
} catch (error) {
  console.error(`[workspace-smoke] ${error.stack || error.message}`)
  process.exitCode = 1
} finally {
  await cleanup(cdp)
}



