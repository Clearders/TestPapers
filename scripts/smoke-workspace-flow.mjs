import { randomBytes } from 'node:crypto'
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

function apiResponseFor(url) {
  const parsed = new URL(url)
  const path = parsed.pathname.replace(/^\/api\/v1/, '')
  if (path === '/auth/refresh') return apiEnvelope({ user: testUser, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
  if (path === '/auth/me') return apiEnvelope(testUser)
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
        response.includes('101 Switching Protocols') ? resolve() : reject(new Error(`WebSocket upgrade failed: ${response.split('\r\n')[0]}`))
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
  await requestJson(`http://${HOST}:${DEBUG_PORT}/json/new?${encodeURIComponent(`${BASE_URL}/questions`)}`, 'PUT')
  const pages = await requestJson(`http://${HOST}:${DEBUG_PORT}/json/list`)
  const page = pages.find(item => item.type === 'page' && item.url.includes('/questions')) || pages.find(item => item.type === 'page')
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
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, predicate)) return
    await delay(250)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function assertVisiblePage(cdp, label) {
  const state = await evaluate(cdp, jsExpression(`
    const main = document.querySelector('main')
    const text = document.body.innerText.trim()
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
      .find(el => el.innerText && el.innerText.includes(${JSON.stringify(text)}))
    if (!target) return false
    target.click()
    return true
  `))
  if (!clicked) throw new Error(`Could not click ${selector} containing "${text}"`)
}

async function runSmoke(cdp) {
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

  await cdp.send('Page.navigate', { url: `${BASE_URL}/questions` })
  await waitFor(cdp, `document.querySelector('#paper-title') && document.body.innerText.includes('Smoke draft restoration question')`, 'Workspace question bank')
  await assertVisiblePage(cdp, 'Workspace')

  await evaluate(cdp, jsExpression(`
    const title = document.querySelector('#paper-title')
    title.value = 'Workspace Smoke Draft'
    title.dispatchEvent(new Event('input', { bubbles: true }))
    const subject = document.querySelector('#paper-subject')
    subject.value = 'Mathematics'
    subject.dispatchEvent(new Event('input', { bubbles: true }))
  `))
  await clickByText(cdp, 'button', 'Add to Paper')
  await waitFor(cdp, `document.body.innerText.includes('Q1') && document.querySelector('#paper-title')?.value === 'Workspace Smoke Draft'`, 'draft paper build')
  await delay(500)

  await cdp.send('Page.reload', { ignoreCache: true })
  await waitFor(cdp, `document.querySelector('#paper-title')?.value === 'Workspace Smoke Draft' && document.body.innerText.includes('Q1')`, 'restored Workspace draft')
  await assertVisiblePage(cdp, 'Workspace after refresh')

  await clickByText(cdp, 'a', 'Home')
  await waitFor(cdp, `location.pathname === '/' && document.body.innerText.includes('Craft Perfect')`, 'Home route')
  await assertVisiblePage(cdp, 'Home')

  await clickByText(cdp, 'a', 'LaTeX Preview')
  await waitFor(cdp, `location.pathname === '/latex' && document.querySelector('.latex-input')`, 'LaTeX route')
  await assertVisiblePage(cdp, 'LaTeX')

  await clickByText(cdp, 'a', 'Workspace')
  await waitFor(cdp, `location.pathname === '/questions' && document.querySelector('#paper-title')`, 'Workspace return')
  await assertVisiblePage(cdp, 'Workspace return')
}

async function cleanup(cdp) {
  try { cdp?.close() } catch {}
  if (browserProcess && !browserProcess.killed) browserProcess.kill()
  if (appProcess && !appProcess.killed) appProcess.kill()
  if (browserDir) {
    try { rmSync(browserDir, { recursive: true, force: true }) } catch {}
  }
}

let cdp
try {
  startApp()
  await waitForUrl(BASE_URL)
  startBrowser()
  await waitForUrl(`http://${HOST}:${DEBUG_PORT}/json/version`)
  cdp = await createPageClient()
  await runSmoke(cdp)
  log('Workspace flow smoke passed')
} catch (error) {
  console.error(`[workspace-smoke] ${error.stack || error.message}`)
  process.exitCode = 1
} finally {
  await cleanup(cdp)
}



