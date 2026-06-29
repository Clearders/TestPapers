import type { ComputedRef, Ref } from 'vue'
import type { Permission } from '~/types/auth'
import type { ExportMode, LayoutDensity } from '~/types/generation'
import type { GeneratedPaperResponse, PaperEntityResponse, PaperState } from '~/domain/papers'
import {
  DOCX_CONTENT_TYPE,
  buildPaperMetadataPayload,
  buildPaperPayload,
  filenameFromDisposition,
  layoutDensityFromHeader,
  normalizePaperQuestion
} from '~/domain/papers'
import { apiErrorMessage, getStatusCode } from '~/utils/apiError'

export type ExportAccessPrompt = {
  kind: 'account' | 'admin'
  title: string
  message: string
} | null

export interface UsePaperExportParams {
  paper: PaperState
  exportMode: Ref<ExportMode>
  layoutDensity: Ref<LayoutDensity>
  includeAnswersInExport: Ref<boolean>
  canReadAnswers: ComputedRef<boolean>
  isAuthenticated: ComputedRef<boolean>
  savedPaperId: Ref<string | null>
  savedPaperSignature: Ref<string>
  currentPaperSignature: () => string
  hasPermission: (permission: Permission) => boolean
  apiFetch: <T>(path: string, options?: Record<string, unknown>) => Promise<{ data: T }>
  apiFetchRaw: (path: string, options?: Record<string, unknown>) => Promise<Response>
}

export function usePaperExport (params: UsePaperExportParams) {
  const {
    paper,
    exportMode,
    layoutDensity,
    includeAnswersInExport,
    canReadAnswers,
    isAuthenticated,
    savedPaperId,
    savedPaperSignature,
    currentPaperSignature,
    hasPermission,
    apiFetch,
    apiFetchRaw
  } = params

  const exported = ref(false)
  const isDownloadingDocx = ref(false)
  const isSavingPaper = ref(false)
  const downloadError = ref('')
  const saveError = ref('')
  const saveSuccess = ref(false)
  const downloadedLayoutDensity = ref<LayoutDensity | null>(null)
  const exportAccessPrompt = ref<ExportAccessPrompt>(null)

  const canWritePapers = computed(() => hasPermission('papers:write'))
  const canDownloadDocx = computed(() => {
    if (!paper.questions.length || !paper.title.trim() || !paper.subject.trim() || isDownloadingDocx.value) return false
    return true
  })

  function showAccountPrompt () {
    exportAccessPrompt.value = {
      kind: 'account',
      title: 'Create an account to export papers',
      message: 'Paper export is available after you create an account. Existing users can log in instead.'
    }
  }

  function showAdminPrompt () {
    exportAccessPrompt.value = {
      kind: 'admin',
      title: 'Export permission required',
      message: 'Your account does not have permission to export exam papers. Contact the administrator for access.'
    }
  }

  function dismissExportAccessPrompt () {
    exportAccessPrompt.value = null
  }

  function hasExportPermission (requiresWrite: boolean) {
    if (!isAuthenticated.value) {
      showAccountPrompt()
      return false
    }
    if (!hasPermission('papers:read') || (requiresWrite && !hasPermission('papers:write'))) {
      showAdminPrompt()
      return false
    }
    return true
  }

  function hasReusableSavedPaper () {
    return savedPaperId.value !== null && savedPaperSignature.value === currentPaperSignature()
  }

  function rememberSavedPaper (paperId: string) {
    savedPaperId.value = paperId
    savedPaperSignature.value = currentPaperSignature()
  }

  function forgetSavedPaper () {
    savedPaperId.value = null
    savedPaperSignature.value = ''
  }

  function exportPaper () {
    if (!hasExportPermission(false)) return
    exported.value = true
  }

  function printPaper () {
    if (!import.meta.client) return
    if (!hasExportPermission(false)) return
    window.print()
  }

  async function ensureDownloadablePaper () {
    const signature = currentPaperSignature()
    if (savedPaperId.value !== null && savedPaperSignature.value === signature) {
      return savedPaperId.value
    }

    if (savedPaperId.value !== null) {
      try {
        await apiFetch<PaperEntityResponse>(`/papers/${savedPaperId.value}`, {
          method: 'PATCH',
          body: buildPaperMetadataPayload(paper)
        })
      } catch (error) {
        if (getStatusCode(error) !== 404) throw error
        forgetSavedPaper()
      }

      if (savedPaperId.value !== null) {
        await apiFetch(`/papers/${savedPaperId.value}/questions`, {
          method: 'PUT',
          body: buildPaperPayload(paper).questions
        })
        savedPaperSignature.value = signature
        return savedPaperId.value
      }
    }

    const response = await apiFetch<PaperEntityResponse>('/papers', {
      method: 'POST',
      body: buildPaperPayload(paper)
    })
    savedPaperId.value = response.data.publicId
    savedPaperSignature.value = signature
    return response.data.publicId
  }

  async function requestDocxDownload (paperPublicId: string) {
    return await apiFetchRaw(`/papers/${paperPublicId}/download`, {
      method: 'GET',
      query: {
        format: 'docx',
        questionOrder: exportMode.value,
        includeAnswer: String(includeAnswersInExport.value && canReadAnswers.value),
        layoutDensity: layoutDensity.value
      }
    })
  }

  async function downloadDocx () {
    if (isDownloadingDocx.value) return
    if (!hasExportPermission(!hasReusableSavedPaper())) return

    downloadError.value = ''
    isDownloadingDocx.value = true
    try {
      const paperId = await ensureDownloadablePaper()
      const response = await requestDocxDownload(paperId)
      if (!response.ok) {
        throw new Error(await response.text() || 'Failed to download DOCX.')
      }

      const contentType = response.headers.get('Content-Type')?.split(';', 1)[0]?.toLowerCase()
      if (contentType !== DOCX_CONTENT_TYPE) {
        const responseText = await response.text()
        let message = 'The download endpoint did not return a DOCX file.'
        try {
          const payload = JSON.parse(responseText)
          message = payload?.error?.message || payload?.detail?.message || message
        } catch {
          if (responseText.trim()) message = responseText
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      downloadedLayoutDensity.value = layoutDensityFromHeader(response.headers.get('X-Layout-Density'))
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filenameFromDisposition(response.headers.get('Content-Disposition'), paper.title)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
    } catch (error) {
      downloadError.value = apiErrorMessage(error, 'Failed to download DOCX.')
    } finally {
      isDownloadingDocx.value = false
    }
  }

  async function savePaper () {
    if (isSavingPaper.value) return
    if (!hasExportPermission(true)) return

    saveError.value = ''
    saveSuccess.value = false
    isSavingPaper.value = true
    try {
      await ensureDownloadablePaper()
      saveSuccess.value = true
    } catch (error) {
      saveError.value = apiErrorMessage(error, 'Failed to save paper.')
    } finally {
      isSavingPaper.value = false
    }
  }

  function resetExportState () {
    exported.value = false
    exportMode.value = 'paper'
    layoutDensity.value = 'auto'
    downloadedLayoutDensity.value = null
    forgetSavedPaper()
    downloadError.value = ''
    saveError.value = ''
    saveSuccess.value = false
  }

  function applyGenerationResult (response: { data: GeneratedPaperResponse }) {
    paper.title = response.data.paper.title
    paper.subject = response.data.paper.subject
    paper.duration = response.data.paper.duration
    paper.totalMarks = response.data.paper.totalMarks
    paper.questions.splice(0, paper.questions.length, ...response.data.paper.questions.map(normalizePaperQuestion))
    rememberSavedPaper(response.data.paper.publicId)
    exported.value = false
    downloadError.value = ''
    saveError.value = ''
    saveSuccess.value = false
  }

  return {
    exported,
    exportAccessPrompt,
    isDownloadingDocx,
    isSavingPaper,
    downloadError,
    saveError,
    saveSuccess,
    downloadedLayoutDensity,
    canWritePapers,
    canDownloadDocx,
    rememberSavedPaper,
    forgetSavedPaper,
    dismissExportAccessPrompt,
    exportPaper,
    printPaper,
    ensureDownloadablePaper,
    savePaper,
    downloadDocx,
    resetExportState,
    applyGenerationResult
  }
}
