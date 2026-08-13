<template>
  <section class="recovery-shell" aria-labelledby="recovery-title">
    <header class="recovery-hero">
      <div>
        <span class="recovery-kicker">Personal device Sync</span>
        <h1 id="recovery-title">Compare, recover, and keep every version.</h1>
        <p>This is a personal-device Sync conflict. It is separate from realtime collaborative draft revisions.</p>
      </div>
      <span class="origin-badge">Not a collaborative revision</span>
    </header>

    <p v-if="busy && !conflict" class="status-banner" role="status" aria-live="polite">Loading preserved snapshots…</p>
    <p v-if="error" class="status-banner status-banner--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="status-banner status-banner--success" role="status" aria-live="polite">{{ notice }}</p>

    <template v-if="conflict">
      <section class="card conflict-summary" aria-labelledby="summary-title">
        <div>
          <span class="recovery-kicker">{{ conflict.entityType }}</span>
          <h2 id="summary-title">{{ conflict.entityId }}</h2>
        </div>
        <dl>
          <div><dt>Reason</dt><dd>{{ label(conflict.reason) }}</dd></div>
          <div><dt>Detected</dt><dd>{{ formatDate(conflict.detectedAt) }}</dd></div>
          <div><dt>Local device</dt><dd>{{ conflict.local.deviceId }}</dd></div>
          <div><dt>Cloud device</dt><dd>{{ conflict.cloud.deviceId }}</dd></div>
        </dl>
      </section>

      <section class="card" aria-labelledby="comparison-title">
        <div class="section-heading">
          <div><span class="recovery-kicker">Three-way comparison</span><h2 id="comparison-title">Common baseline · Local · Cloud</h2></div>
          <span class="badge">{{ divergentFields }} divergent field{{ divergentFields === 1 ? '' : 's' }}</span>
        </div>
        <div class="comparison-table" role="table" aria-label="Conflict field comparison">
          <div class="comparison-row comparison-row--head" role="row">
            <span role="columnheader">Field</span><span role="columnheader">Common baseline</span><span role="columnheader">Local</span><span role="columnheader">Cloud</span>
          </div>
          <div v-for="difference in differences" :key="difference.field" class="comparison-row" :class="`comparison-row--${difference.change}`" role="row">
            <strong role="cell">{{ difference.field }}<small>{{ label(difference.change) }}</small></strong>
            <code role="cell">{{ displayValue(difference.base) }}</code>
            <code role="cell">{{ displayValue(difference.local) }}</code>
            <code role="cell">{{ displayValue(difference.cloud) }}</code>
          </div>
        </div>
      </section>

      <section class="card" aria-labelledby="resolution-title">
        <div class="section-heading">
          <div><span class="recovery-kicker">Recovery action</span><h2 id="resolution-title">Choose the accepted next version</h2></div>
          <span v-if="draftRestored" class="draft-badge" role="status">Recovered unfinished draft</span>
        </div>
        <div class="resolution-grid">
          <button class="resolution-option" type="button" :disabled="busy" @click="submitSimple('keepLocal')"><strong>Keep Local</strong><span>Accept the preserved local snapshot.</span></button>
          <button class="resolution-option" type="button" :disabled="busy" @click="submitSimple('useCloud')"><strong>Use Cloud</strong><span>Accept the current Cloud snapshot.</span></button>
          <button class="resolution-option" type="button" :disabled="busy" @click="submitSimple('saveCopy')"><strong>Save a copy</strong><span>Keep both candidates under separate IDs.</span></button>
        </div>

        <div v-if="richComparison" class="manual-merge">
          <label for="manual-merge-payload"><strong>Manual merge payload</strong><span>Valid JSON object; saved locally until Cloud accepts it.</span></label>
          <textarea id="manual-merge-payload" v-model="manualPayload" rows="10" spellcheck="false" @input="persistDraft('manualMerge')" />
          <div class="manual-actions">
            <button class="btn btn-primary" type="button" :disabled="busy" @click="submitManualMerge">Accept manual merge</button>
            <button class="btn btn-outline" type="button" :disabled="busy" @click="resetManualMerge">Reset to Local</button>
          </div>
        </div>
        <p v-else class="status-banner status-banner--warning">Field-level manual merge is available for questions, papers, and drafts. This entity can still keep Local, use Cloud, or save a copy.</p>
      </section>

      <section class="card" aria-labelledby="versions-title">
        <div class="section-heading"><div><span class="recovery-kicker">Version history</span><h2 id="versions-title">Compare and restore accepted versions</h2></div></div>
        <div v-if="versions.length" class="version-compare-controls">
          <label>Older version<select v-model.number="compareLeft"><option v-for="version in versions" :key="`left-${version.version}`" :value="version.version">Version {{ version.version }}</option></select></label>
          <label>Newer version<select v-model.number="compareRight"><option v-for="version in versions" :key="`right-${version.version}`" :value="version.version">Version {{ version.version }}</option></select></label>
        </div>
        <div v-if="versionDifferences.length" class="version-diff" aria-live="polite">
          <p v-for="difference in versionDifferences" :key="difference.field"><strong>{{ difference.field }}</strong><code>{{ displayValue(difference.local) }}</code><span aria-hidden="true">→</span><code>{{ displayValue(difference.cloud) }}</code></p>
        </div>
        <ol class="timeline version-timeline">
          <li v-for="version in versions" :key="version.version">
            <div><strong>Version {{ version.version }} · {{ label(version.mutationKind) }}</strong><span>{{ formatDate(version.createdAt) }} · {{ version.deviceId }}</span></div>
            <button class="btn btn-outline btn-sm" type="button" :disabled="busy || version.version === versions[0]?.version" @click="restore(version.version)">Restore as new version</button>
          </li>
        </ol>
      </section>

      <section class="card" aria-labelledby="history-title">
        <div class="section-heading"><div><span class="recovery-kicker">Audit trail</span><h2 id="history-title">Resolution history</h2></div></div>
        <p v-if="!resolutions.length" class="empty-copy">No resolution has been accepted yet.</p>
        <ol v-else class="timeline">
          <li v-for="resolution in resolutions" :key="resolution.resolutionId">
            <div><strong>{{ label(resolution.action) }} → version {{ resolution.acceptedVersion }}</strong><span>{{ formatDate(resolution.resolvedAt) }} · {{ resolution.actorDeviceId }}</span></div>
            <span v-if="resolution.undoesResolutionId" class="badge">Undo of {{ resolution.undoesResolutionId.slice(0, 8) }}</span>
          </li>
        </ol>
        <button v-if="undoCandidate" class="btn btn-outline" type="button" :disabled="busy" @click="undoLatest">Undo latest resolution</button>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { compareSyncPayloads, type SyncResolutionAction } from '~/types/syncConflict'

const props = defineProps<{ conflictId: string }>()
const { conflict, versions, resolutions, busy, error, notice, load, resolve, readDraft, saveDraft, clearDraft } = useSyncRecovery()
const manualPayload = ref('{}')
const draftRestored = ref(false)
const compareLeft = ref(0)
const compareRight = ref(0)
const richComparison = computed(() => Boolean(conflict.value && ['question', 'paper', 'draft'].includes(conflict.value.entityType)))
const differences = computed(() => conflict.value
  ? compareSyncPayloads(conflict.value.base?.payload ?? null, conflict.value.local.payload, conflict.value.cloud.payload)
  : [])
const divergentFields = computed(() => differences.value.filter(item => item.change === 'diverged').length)
const undoCandidate = computed(() => {
  const latest = resolutions.value.at(-1)
  return latest && latest.action !== 'undo' ? latest : null
})
const versionDifferences = computed(() => {
  const left = versions.value.find(version => version.version === compareLeft.value)
  const right = versions.value.find(version => version.version === compareRight.value)
  if (!left || !right) return []
  return compareSyncPayloads(null, left.payload, right.payload).filter(item => item.change !== 'sameChange')
})

onMounted(async () => {
  await load(props.conflictId)
  if (!conflict.value) return
  const draft = readDraft(props.conflictId)
  manualPayload.value = draft?.manualPayload ?? JSON.stringify(conflict.value.local.payload ?? {}, null, 2)
  draftRestored.value = Boolean(draft)
  compareRight.value = versions.value[0]?.version ?? 0
  compareLeft.value = versions.value[1]?.version ?? compareRight.value
})

function persistDraft (action: Exclude<SyncResolutionAction, 'undo'>) {
  if (!conflict.value) return
  saveDraft({ schemaVersion: 1, conflictId: conflict.value.conflictId, action, manualPayload: manualPayload.value, restoreVersion: null, updatedAt: new Date().toISOString() })
}

async function submitSimple (action: 'keepLocal' | 'useCloud' | 'saveCopy') {
  if (globalThis.confirm(`Accept “${label(action)}” as a new version?`)) await resolve(action)
}

async function submitManualMerge () {
  try {
    const payload = JSON.parse(manualPayload.value) as unknown
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Manual merge must be a JSON object.')
    await resolve('manualMerge', { payload: payload as Record<string, unknown> })
    draftRestored.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function resetManualMerge () {
  manualPayload.value = JSON.stringify(conflict.value?.local.payload ?? {}, null, 2)
  if (conflict.value) clearDraft(conflict.value.conflictId)
  draftRestored.value = false
}

async function restore (version: number) {
  if (!globalThis.confirm(`Restore version ${version} as a new accepted version?`)) return
  persistDraft('restoreVersion')
  await resolve('restoreVersion', { restoreVersion: version })
}

async function undoLatest () {
  if (!undoCandidate.value || !globalThis.confirm('Undo the latest resolution as a new version?')) return
  await resolve('undo', { undoesResolutionId: undoCandidate.value.resolutionId })
}

function displayValue (value: unknown) {
  if (value === undefined) return '—'
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
function formatDate (value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function label (value: string) { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase()) }
</script>

<style scoped>
.recovery-shell{display:grid;gap:20px;max-width:1180px;margin:0 auto}.recovery-hero,.section-heading,.conflict-summary{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.recovery-hero h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1;margin:.35rem 0 .8rem}.recovery-hero p,.empty-copy{color:var(--color-muted);max-width:720px}.recovery-kicker{color:var(--color-primary);font-size:.76rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.origin-badge,.draft-badge{border:1px solid var(--color-warning-border);border-radius:999px;background:var(--color-warning-bg);color:var(--color-warning);font-weight:750;padding:8px 12px;white-space:nowrap}.conflict-summary h2{font-size:1rem;word-break:break-all}.conflict-summary dl{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:12px 24px;margin:0}.conflict-summary dt{color:var(--color-muted);font-size:.75rem}.conflict-summary dd{font-weight:750;margin:3px 0 0;word-break:break-word}.comparison-table{display:grid;margin-top:18px;border:1px solid var(--color-border);border-radius:14px;overflow:hidden}.comparison-row{display:grid;grid-template-columns:minmax(120px,.65fr) repeat(3,minmax(160px,1fr));background:var(--color-surface-solid)}.comparison-row>*{padding:12px;border-bottom:1px solid var(--color-border);overflow-wrap:anywhere;white-space:pre-wrap}.comparison-row>*+*{border-left:1px solid var(--color-border)}.comparison-row:last-child>*{border-bottom:0}.comparison-row--head{background:rgba(118,87,255,.08);font-size:.78rem;font-weight:850}.comparison-row strong small{display:block;color:var(--color-muted);font-weight:600;margin-top:4px}.comparison-row code,.version-diff code{font:inherit;font-size:.82rem}.comparison-row--diverged{box-shadow:inset 4px 0 var(--color-warning)}.resolution-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.resolution-option{display:grid;gap:5px;text-align:left;padding:16px;border:1px solid var(--color-border);border-radius:14px;background:var(--color-surface-solid);color:var(--color-text)}.resolution-option:hover:not(:disabled){border-color:var(--color-primary);transform:translateY(-2px)}.resolution-option span,.manual-merge label span,.timeline span{color:var(--color-muted);font-size:.8rem}.manual-merge{display:grid;gap:10px;margin-top:20px;padding-top:20px;border-top:1px solid var(--color-border)}.manual-merge label{display:grid;gap:3px}.manual-merge textarea{width:100%;padding:13px;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface-solid);color:var(--color-text);font-family:ui-monospace,monospace}.manual-actions,.version-compare-controls{display:flex;gap:10px;flex-wrap:wrap}.version-compare-controls{margin:16px 0}.version-compare-controls label{display:grid;gap:5px;color:var(--color-muted);font-size:.8rem}.version-compare-controls select{min-width:180px;padding:9px;border:1px solid var(--color-border);border-radius:10px;background:var(--color-surface-solid);color:var(--color-text)}.version-diff{display:grid;gap:7px;padding:12px;border-radius:12px;background:rgba(118,87,255,.06)}.version-diff p{display:grid;grid-template-columns:130px 1fr auto 1fr;gap:10px;margin:0}.timeline{display:grid;gap:0;list-style:none;padding:0;margin:16px 0}.timeline li{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--color-border)}.timeline li>div{display:grid;gap:4px}.badge{align-self:flex-start;padding:5px 9px;border-radius:999px;background:rgba(118,87,255,.1);color:var(--color-primary);font-size:.75rem;font-weight:800}@media(max-width:800px){.recovery-hero,.section-heading,.conflict-summary{display:grid}.origin-badge{white-space:normal}.conflict-summary dl,.resolution-grid{grid-template-columns:1fr}.comparison-table{overflow-x:auto}.comparison-row{min-width:760px}.timeline li{align-items:flex-start;flex-direction:column}.version-diff p{grid-template-columns:1fr}.version-diff p span{display:none}}@media(prefers-reduced-motion:no-preference){.resolution-option{transition:transform .2s ease,border-color .2s ease}}
</style>
