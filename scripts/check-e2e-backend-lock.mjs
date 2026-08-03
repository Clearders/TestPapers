import { readFile } from 'node:fs/promises'

const lockUrl = new URL('../e2e/backend.lock.json', import.meta.url)
const lock = JSON.parse(await readFile(lockUrl, 'utf8'))

if (lock.repository !== 'https://github.com/Clearders/TestPaper-backend') {
  throw new Error('E2E Backend lock must reference the canonical public Backend repository.')
}
if (!/^[0-9a-f]{40}$/.test(lock.commit)) {
  throw new Error('E2E Backend lock commit must be a lowercase 40-character Git SHA.')
}

console.log(`E2E Backend lock verified (${lock.commit}).`)
