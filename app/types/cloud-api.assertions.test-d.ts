import type {
  CloudApiEnvelope,
  CloudAuthSession,
  CloudPagination,
  CloudPaper,
  CloudQuestion,
  CloudQuestionCorrection,
  CloudQuestionPage,
  CloudQuestionRevision
} from './cloud-api'
import type { ApiEnvelope, ApiPagination, PaginatedData } from './api'
import type { AuthSession, PasswordChangePayload, RegisterPayload } from './auth'
import type { PaperCreatePayload, PaperEntityResponse } from '~/domain/papers'
import type { QuestionCorrection, QuestionEntity, QuestionFormInput, QuestionRevision } from './question'

type Assert<T extends true> = T
type Assignable<Source, Target> = [Source] extends [Target] ? true : false
type Schema<Name extends keyof import('~/generated/cloud-api').components['schemas']> =
  import('~/generated/cloud-api').components['schemas'][Name]

// Response contracts must be safe inputs for the Web consumer DTOs.
export type AuthEnvelopeResponseCompatible = Assert<Assignable<CloudApiEnvelope<CloudAuthSession>, ApiEnvelope<AuthSession>>>
export type AuthSessionResponseCompatible = Assert<Assignable<CloudAuthSession, AuthSession>>
export type PaginationResponseCompatible = Assert<Assignable<CloudPagination, ApiPagination>>
export type QuestionPageResponseCompatible = Assert<Assignable<CloudQuestionPage, PaginatedData<CloudQuestion>>>
export type QuestionCorrectionResponseCompatible = Assert<Assignable<CloudQuestionCorrection, QuestionCorrection>>
export type QuestionRevisionResponseCompatible = Assert<Assignable<CloudQuestionRevision, QuestionRevision>>
export type PaperResponseCompatible = Assert<Assignable<CloudPaper, PaperEntityResponse>>

// Existing request DTOs must remain valid contract inputs.
export type RegisterRequestCompatible = Assert<Assignable<RegisterPayload, Schema<'RegisterRequest'>>>
export type PasswordChangeRequestCompatible = Assert<Assignable<PasswordChangePayload, Schema<'PasswordChange'>>>
export type QuestionCreateRequestCompatible = Assert<Assignable<QuestionFormInput, Schema<'QuestionCreate'>>>
export type PaperCreateRequestCompatible = Assert<Assignable<PaperCreatePayload, Schema<'PaperCreate'>>>

// The normalized Web question entity is a strict, contract-valid projection.
export type QuestionEntityProjectionCompatible = Assert<Assignable<QuestionEntity, CloudQuestion>>
