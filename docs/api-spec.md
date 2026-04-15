# TestPapers API Spec (v1)

> 目标: 为当前 Nuxt 前端页面(题库、加题、组卷)定义可联调的前后端交互契约。

## 1. 基本约定

- 协议: `HTTPS`
- 基础路径: `/api/v1`
- 数据格式: `application/json; charset=utf-8`
- 时间格式: `ISO 8601`(UTC)，例如 `2026-04-15T08:30:00Z`
- 字段命名: `camelCase`
- 鉴权方式: `Authorization: Bearer <token>`

### 1.1 统一响应结构

成功:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "6f5bbd6f-12f4-4d5f-8ee0-5cb4c359bf71"
  }
}
```

失败:

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
    "requestId": "6f5bbd6f-12f4-4d5f-8ee0-5cb4c359bf71"
  }
}
```

### 1.2 分页约定

- 请求参数:
  - `page`(默认 `1`)
  - `pageSize`(默认 `20`，最大 `100`)
- 响应 `meta.pagination`:

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 138,
  "totalPages": 7
}
```

### 1.3 排序约定

- 参数: `sortBy` + `sortOrder`
- `sortOrder`: `asc | desc`
- 默认排序: `createdAt desc`，同值按 `id desc` 稳定排序

## 2. 资源模型

### 2.1 Question

```ts
interface Question {
  id: number
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  answer: string
  hasLatex: boolean
  source?: string
  createdAt: string
  updatedAt: string
}
```

字段校验建议:

- `subject`: 1-50 字符
- `difficulty`: 枚举 `easy | medium | hard`
- `tags`: 最多 10 个，每个 1-20 字符
- `text`: 1-5000 字符
- `answer`: 1-5000 字符
- `hasLatex`: 后端可自动计算(检测 `$...$`/`$$...$$`)，并覆盖客户端值

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

字段校验建议:

- `title`: 1-100 字符
- `subject`: 1-50 字符
- `duration`: 1-600(分钟)
- `totalMarks`: 1-1000
- `questions`: 草稿可 0 题，发布时至少 1 题
- `orderNo`: 从 1 开始连续

## 3. Questions API

### 3.1 查询题目列表

- 方法: `GET /api/v1/questions`
- 用途: `app/pages/questions.vue` 列表、筛选、搜索

查询参数:

- `q`: 搜索 `text`、`subject`、`tags`
- `subject`: 精确匹配
- `difficulty`: `easy|medium|hard`
- `tags`: 逗号分隔，例如 `algebra,calculus`
- `hasLatex`: `true|false`
- `includeAnswer`: `true|false`(默认 `false`)
- `page` `pageSize` `sortBy` `sortOrder`

示例:

`GET /api/v1/questions?q=integral&subject=Mathematics&difficulty=hard&page=1&pageSize=10&sortBy=updatedAt&sortOrder=desc`

响应示例:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 4,
        "subject": "Mathematics",
        "difficulty": "hard",
        "tags": ["calculus", "integration"],
        "text": "Compute $$\\int_0^\\infty e^{-x^2}\\,dx$$.",
        "hasLatex": true,
        "createdAt": "2026-04-10T10:00:00Z",
        "updatedAt": "2026-04-12T08:00:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1,
      "totalPages": 1
    },
    "requestId": "req-001"
  }
}
```

### 3.2 获取题目详情

- 方法: `GET /api/v1/questions/{id}`
- 用途: 详情查看、编辑回填
- 可选参数: `includeAnswer=true|false`(默认 `false`)

### 3.3 新增题目

- 方法: `POST /api/v1/questions`
- 用途: `app/pages/add-problem.vue` 保存题目

请求体:

```json
{
  "subject": "Mathematics",
  "difficulty": "easy",
  "tags": ["algebra"],
  "text": "Solve for $x$: $2x + 5 = 13$",
  "answer": "$x = 4$",
  "hasLatex": true,
  "source": "Chapter 3, Exercise 5"
}
```

成功响应: `201 Created`

### 3.4 更新题目

- 方法: `PATCH /api/v1/questions/{id}`
- 用途: 题目编辑
- 请求体: 支持部分字段更新

### 3.5 删除题目

- 方法: `DELETE /api/v1/questions/{id}`
- 用途: 题库维护
- 响应: `204 No Content`

## 4. Papers API

### 4.1 创建试卷

- 方法: `POST /api/v1/papers`
- 用途: `app/pages/papers.vue` 初始化试卷

请求体:

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

成功响应: `201 Created`

### 4.2 查询试卷列表

- 方法: `GET /api/v1/papers`
- 用途: 试卷管理(后续页可复用)

查询参数:

- `q`: `title` 模糊搜索
- `subject`
- `status`
- `page` `pageSize` `sortBy` `sortOrder`

### 4.3 获取试卷详情

- 方法: `GET /api/v1/papers/{id}`
- 用途: 组卷回显
- 可选参数:
  - `expand=questions` 返回完整题目信息
  - `includeAnswer=true|false` 默认 `false`

### 4.4 更新试卷元数据

- 方法: `PATCH /api/v1/papers/{id}`
- 用途: 更新 `title/subject/duration/totalMarks/status`

### 4.5 增加题目到试卷

- 方法: `POST /api/v1/papers/{id}/questions`
- 用途: 点击 `+ Add`

请求体:

```json
{
  "questionId": 6,
  "orderNo": 3
}
```

### 4.6 从试卷移除题目

- 方法: `DELETE /api/v1/papers/{id}/questions/{questionId}`
- 用途: 点击 `Remove`
- 响应: `204 No Content`

### 4.7 批量重排试卷题目

- 方法: `PUT /api/v1/papers/{id}/questions/order`
- 用途: 上移/下移后一次性提交顺序

请求体:

```json
{
  "orders": [
    { "questionId": 4, "orderNo": 1 },
    { "questionId": 1, "orderNo": 2 },
    { "questionId": 6, "orderNo": 3 }
  ]
}
```

### 4.8 导出预览

- 方法: `POST /api/v1/papers/{id}/export-preview`
- 用途: 点击 `Export Paper`，返回预览内容

请求体:

```json
{
  "format": "json",
  "includeAnswer": false
}
```

响应示例:

```json
{
  "success": true,
  "data": {
    "paper": {
      "id": 23,
      "title": "Mid-term Examination 2026",
      "subject": "Mathematics",
      "duration": 60,
      "totalMarks": 100
    },
    "questions": [
      {
        "orderNo": 1,
        "text": "Solve for $x$: $2x + 5 = 13$"
      }
    ],
    "renderHint": "frontend-latex"
  },
  "meta": {
    "requestId": "req-002"
  }
}
```

> 可扩展: `format=pdf|docx`，异步返回 `jobId`。

## 5. 元数据接口(推荐)

### 5.1 学科列表

- `GET /api/v1/meta/subjects`

### 5.2 标签列表

- `GET /api/v1/meta/tags`

用途: 前端筛选下拉和自动补全，减少硬编码。

## 6. 错误码规范

HTTP 状态码 + 业务错误码双层表达:

- `400 BAD_REQUEST`: `INVALID_QUERY_PARAM`
- `401 UNAUTHORIZED`: `UNAUTHORIZED`
- `403 FORBIDDEN`: `FORBIDDEN`
- `404 NOT_FOUND`: `QUESTION_NOT_FOUND` / `PAPER_NOT_FOUND`
- `409 CONFLICT`: `QUESTION_ALREADY_IN_PAPER` / `PAPER_VERSION_CONFLICT`
- `422 UNPROCESSABLE_ENTITY`: `VALIDATION_ERROR`
- `429 TOO_MANY_REQUESTS`: `RATE_LIMITED`
- `500 INTERNAL_SERVER_ERROR`: `INTERNAL_ERROR`

字段校验失败建议落在 `error.details[]`。

## 7. 安全与权限建议

- 鉴权: JWT(Access Token)或服务端 Session
- 角色建议:
  - `teacher`: 题目读写、组卷
  - `admin`: 全量管理(含删除)
  - `student`(可选): 仅查看已发布试卷，不可见答案
- 答案字段保护:
  - 默认不返回 `answer`
  - 只有 `includeAnswer=true` 且具备权限才返回
- 审计日志: 记录 `POST/PATCH/DELETE` 的操作者、时间、变更摘要

## 8. 版本策略

- 路径版本: `/api/v1`
- 非破坏性变更: 仅新增字段，保持向后兼容
- 破坏性变更: 发布 `v2`(字段重命名、语义改变)
- 废弃流程建议:
  - 响应头增加 `Deprecation`、`Sunset`
  - 至少保留 3 个月迁移期

## 9. 与当前前端页面映射

- `app/pages/questions.vue`
  - 列表: `GET /questions`
  - 搜索筛选: `q + subject + difficulty + tags`
  - 展示答案: `includeAnswer=true`
- `app/pages/add-problem.vue`
  - 保存: `POST /questions`
  - 表单字段与接口字段 1:1 映射
- `app/pages/papers.vue`
  - 保存试卷: `POST/PATCH /papers/{id}`
  - 增删题: `POST/DELETE /papers/{id}/questions`
  - 重排: `PUT /papers/{id}/questions/order`
  - 导出预览: `POST /papers/{id}/export-preview`

---

如需，我可以在此基础上再生成一份可直接导入 Swagger UI / Apifox 的 `openapi.yaml`。
