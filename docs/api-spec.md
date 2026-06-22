# TestPapers API 接口文档

> **版本**: v9
> **后端**: FastAPI 0.136 / Python 3.14+
> **前端**: Nuxt 4.4 / TypeScript
> **最后更新**: 2026-06-22

本文档按当前后端实现更新，来源包括 `testpaper_backend/api/routes`、`testpaper_backend/schemas` 与限流、认证依赖代码。

## 1. 通用约定

| 项目 | 说明 |
| --- | --- |
| 基础路径 | `/api/v1`，根接口 `/` 除外 |
| 数据格式 | JSON；字段名使用 `camelCase` |
| 时间格式 | ISO 8601 datetime |
| 认证方式 | 浏览器优先使用 HttpOnly Cookie `testpapers_session`；兼容 `Authorization: Bearer <token>` |
| CSRF | Cookie 会话下的 `POST` / `PUT` / `PATCH` / `DELETE` 需要 `X-CSRF-Token`；登录和注册免 CSRF |
| 请求追踪 | 可传入 `X-Request-Id`；响应 `meta.requestId` 返回请求 ID |

成功响应统一包裹：

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "550e8400-e29b-41d4-a716-446655440000" }
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [{ "field": "difficulty", "reason": "Input should be 'easy', 'medium' or 'hard'" }]
  },
  "meta": { "requestId": "550e8400-e29b-41d4-a716-446655440000" }
}
```

`204 No Content` 无响应体。DOCX 下载接口返回二进制文件，不使用 envelope。

## 2. 权限、分页与限流

### 2.1 角色权限

| 角色 | 权限 |
| --- | --- |
| `admin` | `questions:read`, `questions:write`, `questions:delete`, `answers:read`, `papers:read`, `papers:write`, `users:manage` |
| `teacher` | `questions:read`, `questions:write`, `questions:delete`, `answers:read`, `papers:read`, `papers:write` |
| `viewer` | `questions:read`, `papers:read` |

`answers:read` 控制题目和试卷中的答案可见性。即使请求传 `includeAnswer=true`，无该权限时响应也不会包含答案。

### 2.2 分页参数

题目列表接口支持：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | integer | `1` | 最小 1 |
| `pageSize` | integer | `20` | 1 到 100 |
| `sortBy` | string | 后端默认 | 排序字段 |
| `sortOrder` | `asc` / `desc` | `desc` | 排序方向 |

分页数据结构：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### 2.3 限流

| 范围 | 默认限制 | 环境变量 |
| --- | --- | --- |
| 登录 / 注册 | 每 IP 5 次 / 60 秒 | `RATE_LIMIT_MAX_ATTEMPTS`, `RATE_LIMIT_WINDOW_SECONDS` |
| 写操作 | 每 IP 30 次 / 60 秒 | `RATE_LIMIT_WRITE_MAX_ATTEMPTS`, `RATE_LIMIT_WRITE_WINDOW_SECONDS` |

写操作限流覆盖创建、更新、删除、上传、任务派发等接口。

## 3. 认证与账号

### `POST /api/v1/auth/login`

登录。免 CSRF。

请求体：

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `username` | string | 是 | 最少 1 字符 |
| `password` | string | 是 | 最少 1 字符 |

成功返回 `AuthSession`，并设置 `testpapers_session` 与 `testpapers_csrf` Cookie。

### `POST /api/v1/auth/register`

注册并自动登录。免 CSRF。

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `username` | string | 是 | 3 到 64 字符；去空格后转小写 |
| `displayName` | string | 是 | 1 到 120 字符；去首尾空格 |
| `password` | string | 是 | 8 到 128 字符；必须包含字母和数字 |

公开注册账号默认角色为 `viewer`。

### 其他认证接口

| 方法 | 路径 | 权限 | 请求体 | 响应 |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/auth/me` | 登录 | 无 | `UserEntity` |
| `POST` | `/api/v1/auth/refresh` | 登录 | 无 | 新 `AuthSession`，轮换认证 Cookie |
| `POST` | `/api/v1/auth/logout` | 登录 | 无 | `204`，清除认证与 CSRF Cookie |
| `PATCH` | `/api/v1/auth/profile` | 登录 | `ProfileUpdate` | `UserEntity` |
| `PUT` | `/api/v1/auth/password` | 登录 | `PasswordChange` | `204` |
| `POST` | `/api/v1/auth/avatar` | 登录 | `ImageUploadPayload` | `ImageUploadResponse` |
| `DELETE` | `/api/v1/auth/account` | 登录 | 无 | `204`，软删除账号并清除会话 |

`ProfileUpdate` 至少包含 `username` 或 `displayName`。`username` 为 3 到 64 字符，30 天内最多修改一次；`displayName` 为 1 到 120 字符。

`PasswordChange`：

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `currentPassword` | string | 是 | 最少 1 字符 |
| `newPassword` | string | 是 | 8 到 128 字符；必须包含字母和数字 |

`ImageUploadPayload`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `filename` | string | 是 | 原始文件名 |
| `data` | string | 是 | Base64 PNG 数据 |
| `mimeType` | string | 否 | 默认 `image/png`，当前仅支持 PNG |

## 4. 用户管理

所有接口需要 `users:manage`。

| 方法 | 路径 | 请求体 | 响应 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/users` | 无 | `UserEntity[]` |
| `POST` | `/api/v1/users` | `UserCreate` | `201 UserEntity` |
| `PATCH` | `/api/v1/users/{user_public_id}` | `UserUpdate` | `UserEntity` |
| `DELETE` | `/api/v1/users/{user_public_id}` | 无 | `204` |

`UserCreate` 字段：`username`、`displayName`、`password`、`role`、`isActive`。密码规则与注册一致。
`UserUpdate` 字段：`displayName`、`password`、`role`、`isActive`；字段传 `null` 会校验失败。不能删除当前登录用户自己。

## 5. 题目管理

### 5.1 列表与详情

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/questions` | `questions:read` | 分页题目列表 |
| `GET` | `/api/v1/questions/mine` | `questions:read` | 当前用户自己的题目，参数同列表但不接收 `ownerId` |
| `GET` | `/api/v1/questions/{question_public_id}` | `questions:read` | 题目详情 |

列表参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `q` | string | 无 | 全文搜索；无 `answers:read` 时不搜索答案 |
| `subjects` | string | 无 | 逗号分隔学科 |
| `difficulty` | `easy` / `medium` / `hard` | 无 | 难度 |
| `type` | `single_choice` / `multiple_choice` / `true_false` / `blank` / `short_answer` / `essay` | 无 | 题型 |
| `tags` | string | 无 | 逗号分隔标签 |
| `hasLatex` | boolean | 无 | 是否包含 LaTeX |
| `ownerId` | integer | 无 | 按出题人内部 ID 筛选，仅列表接口支持 |
| `includeAnswer` | boolean | `true` | 是否尝试返回答案，仍受 `answers:read` 限制 |
| `page` / `pageSize` / `sortBy` / `sortOrder` | mixed | 见分页 | 分页排序 |

### 5.2 创建、更新、删除

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/questions` | `questions:write` | 创建题目，返回 `201 QuestionEntity`，广播 `question.created` |
| `PATCH` | `/api/v1/questions/{question_public_id}` | `questions:write` | 部分更新，自动生成修订记录，广播 `question.updated` |
| `DELETE` | `/api/v1/questions/{question_public_id}` | `questions:delete` | 仅题目所有者或 admin 可删，返回 `204`，广播 `question.deleted` |

`QuestionCreate` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | `QuestionType` | 是 | 题型 |
| `subjects` | string[] | 是 | 至少 1 个非空学科，去重 |
| `difficulty` | `Difficulty` | 是 | 难度 |
| `tags` | string[] | 否 | 去空格、转小写、去重 |
| `text` | string | 是 | 题干，非空 |
| `options` | string[] | 选择/判断题必填 | 非选择类题型会被置空 |
| `answer` | string 或 string[] | 是 | 多选题必须为数组，其他题型必须为字符串 |
| `hasLatex` | boolean | 否 | 是否包含 LaTeX |
| `source` | string | 否 | 来源 |
| `essayBlankSpace` | object | 否 | 仅作文题有效；默认 `{ "lines": 6, "lineHeight": 28 }` |
| `images` | `QuestionImage[]` | 否 | 题图 |
| `scoreWeight` | number | 否 | 默认 1，范围 `(0, 100]` |
| `ownerId` | integer | 否 | 服务端按当前用户归属处理 |

`EssayBlankSpace.lines` 范围 1 到 20；`lineHeight` 范围 20 到 48。`QuestionImage` 包含 `url` 和可选 `caption`。

### 5.3 修订与纠错

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/questions/{question_public_id}/revisions` | `questions:read` | 修订记录 |
| `DELETE` | `/api/v1/questions/{question_public_id}/revisions/{revision_id}` | `questions:delete` | 所有者或 admin 删除修订 |
| `POST` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | 提交纠错 |
| `GET` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | 纠错列表 |
| `PATCH` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:write` | 所有者或 admin 更新纠错状态 |
| `DELETE` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:delete` | 所有者或 admin 删除纠错 |

纠错创建请求体：

```json
{
  "category": "wrong_answer",
  "message": "答案应为 B"
}
```

`category`: `wrong_answer` / `unclear` / `typo` / `other`。`status`: `open` / `accepted` / `rejected`。

## 6. 试卷管理

### 6.1 创建试卷

`POST /api/v1/papers`，需要 `papers:write`。成功返回 `201 PaperEntity`，广播 `paper.created`。

`PaperCreate`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 非空 |
| `subject` | string | 是 | 非空 |
| `duration` | integer | 是 | 大于 0，分钟 |
| `totalMarks` | integer | 是 | 大于 0 |
| `ownerId` | integer | 否 | 服务端按当前用户归属处理 |
| `questions` | `QuestionRef[]` | 否 | 默认空数组，不能重复 |

`QuestionRef`: `questionPublicId`、`orderNo`、可选 `marks`；`orderNo` 和 `marks` 都必须大于 0。

### 6.2 自动组卷

`POST /api/v1/papers/generate`，需要 `papers:write`。使用遗传算法自动组卷，成功返回 `201`：

```json
{
  "success": true,
  "data": {
    "paper": {},
    "diagnostics": {}
  },
  "meta": { "requestId": "..." }
}
```

`PaperGenerateRequest`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 非空 |
| `duration` | integer | 是 | 大于 0 |
| `totalMarks` | integer | 是 | 大于 0 |
| `difficultyCoefficient` | number | 是 | 0 到 1，后端保留 2 位 |
| `questionTypes` | `{ questionType, count }[]` | 是 | 至少 1 项；`count` 大于 0 |
| `ownQuestionsOnly` | boolean | 否 | 默认 `false`；为 `true` 时只从当前用户题库选题 |
| `requiredTags` | string[] | 否 | 去空格、转小写、去重 |
| `preferredTags` | string[] | 否 | 去空格、转小写、去重 |
| `subjects` | string[] | 是 | 至少 1 个非空学科 |
| `subject` | string | 否 | 后端会由 `subjects` 拼接覆盖 |

### 6.3 详情、更新与题目操作

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/papers/{paper_public_id}` | `papers:read` | 试卷详情；`expand=questions` 可展开题目，`includeAnswer` 受 `answers:read` 限制 |
| `PATCH` | `/api/v1/papers/{paper_public_id}` | `papers:write` | 所有者或 admin 更新元数据，广播 `paper.updated` |
| `POST` | `/api/v1/papers/{paper_public_id}/questions` | `papers:write` | 所有者或 admin 添加题目，请求体为 `QuestionRef[]` |
| `DELETE` | `/api/v1/papers/{paper_public_id}/questions/{question_public_id}` | `papers:write` | 所有者或 admin 移除题目 |
| `PUT` | `/api/v1/papers/{paper_public_id}/questions/order` | `papers:write` | 所有者或 admin 调整题序 |

试卷更新字段：`title`、`subject`、`duration`、`totalMarks`、`status`。`status` 为 `draft` / `published`；字段传 `null` 会校验失败。

顺序更新请求体：

```json
{
  "orders": [
    { "questionPublicId": "550e8400-e29b-41d4-a716-446655440000", "orderNo": 1 }
  ]
}
```

### 6.4 导出

`POST /api/v1/papers/{paper_public_id}/export-preview`，需要 `papers:read`。返回预览数据，不生成文件。

请求体：

| 字段 | 类型 | 默认值 |
| --- | --- | --- |
| `includeAnswer` | boolean | `true` |
| `questionOrder` | `paper` / `categorized` | `paper` |
| `layoutDensity` | `auto` / `normal` / `compact` / `dense` | `auto` |

`GET /api/v1/papers/{paper_public_id}/download`，需要 `papers:read`。下载 DOCX。

查询参数：

| 参数 | 类型 | 默认值 |
| --- | --- | --- |
| `format` | `docx` | `docx` |
| `questionOrder` | `paper` / `categorized` | `paper` |
| `includeAnswer` | boolean | `true` |
| `layoutDensity` | `auto` / `normal` / `compact` / `dense` | `auto` |

响应头包含 `Content-Disposition`、`X-Export-Format`、`X-Layout-Density`。

## 7. 元数据与图片

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/meta/subjects` | `questions:read` | 学科列表 |
| `GET` | `/api/v1/meta/tags` | `questions:read` | 标签列表 |
| `POST` | `/api/v1/images/upload` | `questions:write` | 上传题目 PNG 图片，返回 `ImageUploadResponse` |

题图上传请求体与头像上传一致。当前仅支持 PNG。头像大小限制为 500KB；题图大小限制由图片服务实现控制。

## 8. 异步任务

异步任务由 Celery 派发。任务创建接口返回：

```json
{
  "taskId": "task-id",
  "status": "dispatched"
}
```

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/tasks/ping` | `questions:read` | Worker 连通性检查 |
| `GET` | `/api/v1/tasks/{task_id}` | `questions:read` | 查询任务状态；只能查询自己可访问的任务 |
| `POST` | `/api/v1/tasks/export-paper/{paper_public_id}` | `papers:read` | 异步导出试卷 |
| `POST` | `/api/v1/tasks/validate-questions` | `questions:read` | 验证全部题目 |
| `POST` | `/api/v1/tasks/validate-question/{question_public_id}` | `questions:read` | 验证单个题目 |
| `POST` | `/api/v1/tasks/cleanup-expired-sessions` | `users:manage` | 清理过期会话 |
| `POST` | `/api/v1/tasks/stats/questions` | `questions:read` | 计算题目统计 |

`export-paper` 查询参数：`question_order=paper|categorized`、`include_answer=true|false`、`format=json|csv|txt`。

任务状态响应包含 `taskId`、`status`，并按状态附加 `result`、`error`、`progress` 或 `message`。

## 9. WebSocket

`WS /api/v1/ws`。认证优先级：

1. `Authorization: Bearer <token>`
2. Cookie `testpapers_session`

连接成功后服务端发送 `auth.connected`。客户端发送 `{ "event": "ping" }` 时服务端返回 `{ "event": "pong" }`。同一 IP 最多 10 个并发 WebSocket 连接。

主要广播事件：`question.created`、`question.updated`、`question.deleted`、`paper.created`、`paper.updated`、`paper.questions.added`、`paper.question.removed`、`paper.questions.reordered`。

## 10. 健康检查与根接口

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/` | 无 | 返回 `{ "service": "TestPaper Backend", "version": "1.0.0" }` |
| `GET` | `/api/v1/health/postgres` | 无 | PostgreSQL 健康检查 |
| `GET` | `/api/v1/health/redis` | 无 | Redis 健康检查 |

健康检查成功时返回 `status=connected` 和 `latencyMs`。开发环境会额外返回版本、内存、连接数等诊断字段；生产环境隐藏底层细节。失败时返回 HTTP `503`，`data.status=disconnected`。

## 11. 数据模型速查

```typescript
type Permission =
  | 'questions:read'
  | 'questions:write'
  | 'questions:delete'
  | 'answers:read'
  | 'papers:read'
  | 'papers:write'
  | 'users:manage'

interface UserEntity {
  id: number
  publicId: string
  username: string
  displayName: string
  role: 'admin' | 'teacher' | 'viewer'
  permissions: Permission[]
  isActive: boolean
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

interface QuestionEntity {
  id: number
  publicId: string
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'blank' | 'short_answer' | 'essay'
  subjects: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  options: string[] | null
  answer?: string | string[]
  hasLatex: boolean | null
  source: string | null
  essayBlankSpace: { lines: number; lineHeight: number } | null
  images: { url: string; caption?: string | null }[]
  scoreWeight: number
  ownerId: number | null
  createdAt: string
  updatedAt: string
}

interface QuestionRef {
  questionPublicId: string
  orderNo: number
  marks?: number | null
}

interface PaperEntity {
  id: number
  publicId: string
  title: string
  subject: string
  duration: number
  totalMarks: number
  ownerId: number | null
  questions: QuestionRef[]
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

interface AuthSession {
  expiresAt: string
  user: UserEntity
}

interface ImageUploadResponse {
  url: string
  filename: string
  mimeType: string
}
```

## 12. 错误码

| HTTP | 错误码 | 说明 |
| --- | --- | --- |
| 400 | `USERNAME_CHANGE_TOO_SOON` | 用户名 30 天内已修改 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 401 | `INVALID_TOKEN` | Token 无效 |
| 401 | `TOKEN_EXPIRED` | Token 已过期 |
| 401 | `INVALID_CREDENTIALS` | 用户名或密码错误 |
| 401 | `INVALID_PASSWORD` | 当前密码错误 |
| 401 | `ACCOUNT_DISABLED` | 账号被禁用 |
| 403 | `FORBIDDEN` | 权限不足 |
| 403 | `CSRF_MISSING` | 缺少 CSRF Token |
| 403 | `CSRF_MISMATCH` | CSRF Token 不匹配 |
| 404 | `QUESTION_NOT_FOUND` | 题目不存在 |
| 404 | `PAPER_NOT_FOUND` | 试卷不存在 |
| 404 | `USER_NOT_FOUND` | 用户不存在 |
| 404 | `CORRECTION_NOT_FOUND` | 纠错记录不存在 |
| 404 | `REVISION_NOT_FOUND` | 修订记录不存在 |
| 409 | `QUESTION_ALREADY_IN_PAPER` | 题目已在试卷中 |
| 409 | `USER_ALREADY_EXISTS` | 用户名已存在 |
| 413 | `PAYLOAD_TOO_LARGE` | 上传内容超出限制 |
| 422 | `VALIDATION_ERROR` | 请求参数校验失败 |
| 422 | `INSUFFICIENT_QUESTIONS` | 自动组卷候选题数量不足 |
| 429 | `RATE_LIMIT_EXCEEDED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务端内部错误 |
| 503 | health check failure | 依赖服务不可用 |

## 13. 接口速查

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/` | 无 | 服务信息 |
| `POST` | `/api/v1/auth/login` | 无 | 登录 |
| `POST` | `/api/v1/auth/register` | 无 | 注册并登录 |
| `GET` | `/api/v1/auth/me` | 登录 | 当前用户 |
| `POST` | `/api/v1/auth/refresh` | 登录 | 刷新会话 |
| `POST` | `/api/v1/auth/logout` | 登录 | 注销 |
| `PATCH` | `/api/v1/auth/profile` | 登录 | 更新个人资料 |
| `PUT` | `/api/v1/auth/password` | 登录 | 修改密码 |
| `POST` | `/api/v1/auth/avatar` | 登录 | 上传头像 |
| `DELETE` | `/api/v1/auth/account` | 登录 | 删除账号 |
| `WS` | `/api/v1/ws` | 登录 | 实时通信 |
| `GET` | `/api/v1/users` | `users:manage` | 用户列表 |
| `POST` | `/api/v1/users` | `users:manage` | 创建用户 |
| `PATCH` | `/api/v1/users/{user_public_id}` | `users:manage` | 更新用户 |
| `DELETE` | `/api/v1/users/{user_public_id}` | `users:manage` | 删除用户 |
| `GET` | `/api/v1/meta/subjects` | `questions:read` | 学科列表 |
| `GET` | `/api/v1/meta/tags` | `questions:read` | 标签列表 |
| `POST` | `/api/v1/images/upload` | `questions:write` | 上传题图 |
| `GET` | `/api/v1/questions` | `questions:read` | 题目列表 |
| `GET` | `/api/v1/questions/mine` | `questions:read` | 我的题目 |
| `GET` | `/api/v1/questions/{question_public_id}` | `questions:read` | 题目详情 |
| `POST` | `/api/v1/questions` | `questions:write` | 创建题目 |
| `PATCH` | `/api/v1/questions/{question_public_id}` | `questions:write` | 更新题目 |
| `DELETE` | `/api/v1/questions/{question_public_id}` | `questions:delete` | 删除题目 |
| `GET` | `/api/v1/questions/{question_public_id}/revisions` | `questions:read` | 修订列表 |
| `DELETE` | `/api/v1/questions/{question_public_id}/revisions/{revision_id}` | `questions:delete` | 删除修订 |
| `POST` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | 提交纠错 |
| `GET` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | 纠错列表 |
| `PATCH` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:write` | 更新纠错状态 |
| `DELETE` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:delete` | 删除纠错 |
| `POST` | `/api/v1/papers` | `papers:write` | 创建试卷 |
| `POST` | `/api/v1/papers/generate` | `papers:write` | 自动组卷 |
| `GET` | `/api/v1/papers/{paper_public_id}` | `papers:read` | 试卷详情 |
| `PATCH` | `/api/v1/papers/{paper_public_id}` | `papers:write` | 更新试卷 |
| `POST` | `/api/v1/papers/{paper_public_id}/questions` | `papers:write` | 添加题目 |
| `DELETE` | `/api/v1/papers/{paper_public_id}/questions/{question_public_id}` | `papers:write` | 移除题目 |
| `PUT` | `/api/v1/papers/{paper_public_id}/questions/order` | `papers:write` | 调整题序 |
| `POST` | `/api/v1/papers/{paper_public_id}/export-preview` | `papers:read` | 导出预览 |
| `GET` | `/api/v1/papers/{paper_public_id}/download` | `papers:read` | 下载 DOCX |
| `POST` | `/api/v1/tasks/ping` | `questions:read` | Worker 检查 |
| `GET` | `/api/v1/tasks/{task_id}` | `questions:read` | 任务状态 |
| `POST` | `/api/v1/tasks/export-paper/{paper_public_id}` | `papers:read` | 异步导出 |
| `POST` | `/api/v1/tasks/validate-questions` | `questions:read` | 验证全部题目 |
| `POST` | `/api/v1/tasks/validate-question/{question_public_id}` | `questions:read` | 验证单题 |
| `POST` | `/api/v1/tasks/cleanup-expired-sessions` | `users:manage` | 清理会话 |
| `POST` | `/api/v1/tasks/stats/questions` | `questions:read` | 题目统计 |
| `GET` | `/api/v1/health/postgres` | 无 | PostgreSQL 健康检查 |
| `GET` | `/api/v1/health/redis` | 无 | Redis 健康检查 |
