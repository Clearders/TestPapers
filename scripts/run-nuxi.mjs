import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const nuxiEntry = resolve(rootDir, 'node_modules', '@nuxt', 'cli', 'bin', 'nuxi.mjs')
const ignoredWarnings = [
  '[DEP0155] DeprecationWarning: Use of deprecated trailing slash pattern mapping',
  '(Use `node --trace-deprecation ...` to show where the warning was created)'
]

const child = spawn(process.execPath, [nuxiEntry, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: ['inherit', 'inherit', 'pipe'],
  env: process.env
})

let stderrBuffer = ''

child.stderr.on('data', (chunk) => {
  stderrBuffer += chunk.toString()
  const lines = stderrBuffer.split(/\r?\n/)
  stderrBuffer = lines.pop() || ''

  for (const line of lines) {
    if (ignoredWarnings.some((warning) => line.includes(warning))) continue
    process.stderr.write(`${line}\n`)
  }
})

child.on('exit', (code, signal) => {
  if (stderrBuffer && !ignoredWarnings.some((warning) => stderrBuffer.includes(warning))) {
    process.stderr.write(stderrBuffer)
  }

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
