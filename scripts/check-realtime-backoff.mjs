import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const sourcePath = new URL('../app/utils/realtimeBackoff.ts', import.meta.url)
const source = readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText

const tempDir = mkdtempSync(join(tmpdir(), 'realtime-backoff-'))
const modulePath = join(tempDir, 'realtimeBackoff.mjs')
writeFileSync(modulePath, compiled)

const { createRealtimeReconnectBackoff } = await import(pathToFileURL(modulePath))

const scheduled = []
const backoff = createRealtimeReconnectBackoff({
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  stableConnectionMs: 5_000,
  setTimeoutFn (callback, delay) {
    const timer = {
      delay,
      cleared: false,
      run () {
        if (!this.cleared) callback()
      }
    }
    scheduled.push(timer)
    return timer
  },
  clearTimeoutFn (timer) {
    timer.cleared = true
  }
})

assert.deepEqual(
  Array.from({ length: 7 }, () => backoff.nextDelay()),
  [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000],
  'reconnect attempts should back off to the cap'
)

backoff.markConnected()
assert.equal(scheduled.at(-1).delay, 5_000, 'stable connections should schedule a reset')
scheduled.at(-1).run()
assert.equal(backoff.nextDelay(), 1_000, 'stable connections should reset later reconnect delay')

backoff.nextDelay()
backoff.markConnected()
const pendingStableReset = scheduled.at(-1)
backoff.cancelStableReset()
pendingStableReset.run()
assert.equal(
  backoff.nextDelay(),
  4_000,
  'connections that close before becoming stable should keep their accumulated backoff'
)

console.log('Realtime reconnect backoff reset/decay check passed')
