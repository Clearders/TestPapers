# TestPapers API Spec (v1)

> 目标：基于当前 Nuxt 前端页面（题库、加题、组卷）总结可联调的 API 契约。
>
> 当前状态：`app/pages/*.vue` 仍使用本地 mock 数据，尚未发起真实 HTTP 请求；本文档定义的是后端落地时的目标接口。

## 1. 通用约定

- 协议：`HTTPS`
- Base URL：`/api/v1`
- 数据格式：`application/json; charset=utf-8`
- 时间格式：`ISO 8601`（UTC）
- 字段命名：`camelCase`
- 鉴权：`Authorization: Bearer <token>`（建议）

### 1.1 统一响应格式

成功：

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req-001"
  }
}
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "difficulty",
        "reason": "must be one of: easy, medium, hard"
      }
    ]
  },
  "meta": {
    "requestId": "req-001"
  }
}
```

### 1.2 分页与排序

- 分页参数：`page`（默认 1）、`pageSize`（默认 20，最大 100）
- 排序参数：`sortBy`、`sortOrder`（`asc | desc`）
- 默认排序：`createdAt desc`（同值按 `id desc`）

## 2. 资源模型

### 2.1 Question

```ts
interface Question {
  id: number
  type: 'choice' | 'blank' | 'essay'
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  options?: string[]
  answer: string
  hasLatex: boolean
  source?: string
  createdAt: string
  updatedAt: string
}
```

说明：

- `type` 与 `options` 来自 `app/pages/add-problem.vue` 的表单能力。
- 当 `type='choice'` 时，`options` 必填，`answer` 建议为选项字母（`A/B/C/D`）。
- 当 `type='blank' | 'essay'` 时，`options` 应为空。
- `hasLatex` 可由后端根据 `text/answer/options` 自动计算。

### 2.2 Paper

```ts
interface Paper {
  id: number
  title: string
  subject: string
  duration: number
  totalMarks: number
  questions: PaperQuestion[]
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

interface PaperQuestion {
  questionId: number
  orderNo: number
  marks?: number
}
```

## 3. Questions API

### 3.1 查询题目列表

- `GET /api/v1/questions`
- 对应页面：`app/pages/questions.vue`（列表、搜索、筛选）

Query 参数：

- `q`：匹配 `text/subject/tags`
- `subject`：学科精确过滤
- `difficulty`：`easy|medium|hard`
- `type`：`choice|blank|essay`
- `tags`：逗号分隔，如 `algebra,calculus`
- `hasLatex`：`true|false`
- `includeAnswer`：`true|false`（默认 `false`）
- `page`、`pageSize`、`sortBy`、`sortOrder`

### 3.2 获取题目详情

- `GET /api/v1/questions/{id}`
- Query：`includeAnswer=true|false`（默认 `false`）

### 3.3 新增题目

- `POST /api/v1/questions`
- 对应页面：`app/pages/add-problem.vue`（保存题目）

请求体示例：

```json
{
  "type": "choice",
  "subject": "Mathematics",
  "difficulty": "easy",
  "tags": ["algebra"],
  "text": "Solve for $x$: $2x + 5 = 13$",
  "options": ["x=3", "x=4", "x=5", "x=6"],
  "answer": "B",
  "source": "Chapter 3, Exercise 5"
}
```

返回：`201 Created`

### 3.4 更新题目

- `PATCH /api/v1/questions/{id}`
- 支持部分字段更新

### 3.5 删除题目

- `DELETE /api/v1/questions/{id}`
- 返回：`204 No Content`

## 4. Papers API

### 4.1 创建试卷

- `POST /api/v1/papers`
- 对应页面：`app/pages/papers.vue`

```json
{
  "title": "Mid-term Examination 2026",
  "subject": "Mathematics",
  "duration": 60,
  "totalMarks": 100,
  "questions": [
    { "questionId": 1, "orderNo": 1 },
    { "questionId": 4, "orderNo": 2 }
  ]
}
```

返回：`201 Created`

### 4.2 获取试卷详情

- `GET /api/v1/papers/{id}`
- Query：
  - `expand=questions`（返回题目详情）
  - `includeAnswer=true|false`（默认 `false`）

### 4.3 更新试卷元信息

- `PATCH /api/v1/papers/{id}`
- 用于更新：`title/subject/duration/totalMarks/status`

### 4.4 增删题与排序

- `POST /api/v1/papers/{id}/questions`
- `DELETE /api/v1/papers/{id}/questions/{questionId}`
- `PUT /api/v1/papers/{id}/questions/order`

批量排序请求体：

```json
{
  "orders": [
    { "questionId": 4, "orderNo": 1 },
    { "questionId": 1, "orderNo": 2 }
  ]
}
```

### 4.5 导出预览

- `POST /api/v1/papers/{id}/export-preview`
- 对应页面：`app/pages/papers.vue` 的 `Export Paper`

```json
{
  "format": "json",
  "includeAnswer": false
}
```

响应中建议返回：`paper`、`questions`、`renderHint`。

## 5. Meta API（推荐）

- `GET /api/v1/meta/subjects`：学科列表
- `GET /api/v1/meta/tags`：标签列表

用途：替换前端硬编码筛选项。

## 6. 错误码约定

- `400 BAD_REQUEST`：`INVALID_QUERY_PARAM`
- `401 UNAUTHORIZED`：`UNAUTHORIZED`
- `403 FORBIDDEN`：`FORBIDDEN`
- `404 NOT_FOUND`：`QUESTION_NOT_FOUND` / `PAPER_NOT_FOUND`
- `409 CONFLICT`：`QUESTION_ALREADY_IN_PAPER` / `PAPER_VERSION_CONFLICT`
- `422 UNPROCESSABLE_ENTITY`：`VALIDATION_ERROR`
- `429 TOO_MANY_REQUESTS`：`RATE_LIMITED`
- `500 INTERNAL_SERVER_ERROR`：`INTERNAL_ERROR`

## 7. 页面到 API 映射

- `app/pages/questions.vue`
  - 列表和筛选：`GET /api/v1/questions`
  - 查看答案：`includeAnswer=true`
- `app/pages/add-problem.vue`
  - 创建题目：`POST /api/v1/questions`
  - 涉及字段：`type/subject/difficulty/tags/text/options/answer/source`
- `app/pages/papers.vue`
  - 创建与更新试卷：`POST/PATCH /api/v1/papers`
  - 增删题：`POST/DELETE /api/v1/papers/{id}/questions`
  - 调整顺序：`PUT /api/v1/papers/{id}/questions/order`
  - 导出预览：`POST /api/v1/papers/{id}/export-preview`

## 8. 版本策略

- 当前版本：`v1`（路径版本）
- 非破坏性变更：新增字段，保持兼容
- 破坏性变更：发布 `v2`

---

如需下一步，可基于本规范直接生成 `openapi.yaml`（Swagger/Apifox 可导入）。
