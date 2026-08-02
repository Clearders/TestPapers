import type { components } from '~/generated/cloud-api'

export type CloudApiSchemas = components['schemas']
export type CloudApiEnvelope<T> = Omit<CloudApiSchemas['Envelope_AuthSession_'], 'data'> & { data: T }
export type CloudAuthSession = CloudApiSchemas['AuthSession']
export type CloudPagination = CloudApiSchemas['PaginationInfo']
export type CloudQuestionPage = CloudApiSchemas['PaginatedResponse_QuestionEntity_']
export type CloudQuestion = CloudApiSchemas['QuestionEntity']
export type CloudQuestionCorrection = CloudApiSchemas['QuestionCorrectionEntity']
export type CloudQuestionRevision = CloudApiSchemas['QuestionRevisionEntity']
export type CloudPaper = CloudApiSchemas['PaperEntity']
