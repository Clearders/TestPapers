# TestPapers 前后端 API 接口文档

> **版本**: v3  
> **后端框架**: FastAPI (Python)  
> **前端框架**: Nuxt 3 (TypeScript)  
> **最后更新**: 2026-05-08

---

## 目录

- [1. 通用约定](#1-通用约定)
- [2. 认证与鉴权](#2-认证与鉴权)
- [3. 用户管理](#3-用户管理)
- [4. 试题管理](#4-试题管理)
- [5. 试卷管理](#5-试卷管理)
- [6. 元数据](#6-元数据)
- [7. 数据模型](#7-数据模型)
- [8. 错误码](#8-错误码)
- [9. 前端页面与 API 对应关系](#9-前端页面与-api-对应关系)

---

## 1. 通用约定

### 1.1 基础信息

| 项目       | 说明                            |
| ---------- | ------------------------------- |
| 协议       | `HTTP/HTTPS`                    |
| 基础路径   | `/api/v1`                       |
| 内容类型   | `application/json; charset=utf-8` |
| 时间格式   | ISO 8601 UTC（如 `2026-05-07T12:00:00Z`） |
| 字段命名   | `camelCase`（驼峰命名）         |
| 认证方式   | `Authorization: Bearer <token>` |

### 1.2 统一响应格式

所有接口返回统一的 JSON 信封（envelope）结构。

**成功响应**（`success: true`）：

```json
{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**失败响应**（`success: false`）：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      {
        "field": "difficulty",
        "reason": "必须是 easy、medium 或 hard 之一"
      }
    ]
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

字段说明：

| 字段              | 说明                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `success`         | 布尔值，`true` 表示成功，`false` 表示失败                              |
| `data`            | 成功时的业务数据，类型视接口而定                                       |
| `error.code`      | 错误码，标识错误类型                                                  |
| `error.message`   | 人类可读的错误描述                                                    |
| `error.details`   | 可选，字段级别的校验错误列表，每项包含 `field`（字段路径）和 `reason`（原因） |
| `meta.requestId`  | 请求追踪 ID。客户端可通过请求头 `X-Request-Id` 传入，否则后端自动生成 UUID v4 |

### 1.3 分页与排序

分页接口统一使用以下查询参数：

| 参数        | 类型    | 默认值       | 说明                                        |
| ----------- | ------- | ------------ | ------------------------------------------- |
| `page`      | integer | `1`          | 页码，从 1 开始                              |
| `pageSize`  | integer | `20`         | 每页条数，有效范围 1–100                     |
| `sortBy`    | string  | `createdAt`  | 排序字段（支持 `id`、`subject`、`difficulty`、`type`、`createdAt`、`updatedAt`） |
| `sortOrder` | string  | `desc`       | 排序方向：`asc`（升序）或 `desc`（降序）      |

分页响应体结构：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

> 排序规则：先按 `sortBy` 字段排序，相同值再按 `id desc` 作为二级排序。

---

## 2. 认证与鉴权

### 2.1 权限模型

系统定义了三种角色，每种角色拥有一组操作权限：

| 权限标识            | 说明             | admin | teacher | viewer |
| ------------------- | ---------------- | :---: | :-----: | :----: |
| `questions:read`    | 查看试题列表/详情 |   ✓   |    ✓    |   ✓   |
| `questions:write`   | 创建/编辑试题     |   ✓   |    ✓    |   ✗   |
| `questions:delete`  | 删除试题          |   ✓   |    ✓    |   ✗   |
| `answers:read`      | 查看答案          |   ✓   |    ✓    |   ✗   |
| `papers:read`       | 查看试卷          |   ✓   |    ✓    |   ✓   |
| `papers:write`      | 创建/编辑试卷     |   ✓   |    ✓    |   ✗   |
| `users:manage`      | 管理用户（CRUD）  |   ✓   |    ✗    |   ✗   |

> **重要**：`answers:read` 控制是否返回试题/试卷中的 `answer` 字段。即使请求参数中 `includeAnswer=true`，无此权限的用户响应中也不会包含答案。

### 2.2 登录

```http
POST /api/v1/auth/login
```

**请求体**：

| 字段       | 类型   | 必填 | 说明                     |
| ---------- | ------ | :--: | ------------------------ |
| `username` | string |  是  | 用户名（大小写不敏感）     |
| `password` | string |  是  | 明文密码                  |

请求示例：

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "token": "aBcDeF...（96 字符 URL-safe 随机串）",
    "tokenType": "bearer",
    "expiresAt": "2026-05-08T00:00:00Z",
    "user": {
      "id": 1,
      "username": "admin",
      "displayName": "管理员",
      "role": "admin",
      "permissions": [
        "answers:read",
        "papers:read",
        "papers:write",
        "questions:delete",
        "questions:read",
        "questions:write",
        "users:manage"
      ],
      "isActive": true,
      "createdAt": "2026-05-07T00:00:00Z",
      "updatedAt": "2026-05-07T00:00:00Z"
    }
  },
  "meta": { "requestId": "..." }
}
```

- `token`: 认证令牌，后续请求放入 `Authorization` 头。
- `expiresAt`: 令牌过期时间（签发后 **12 小时**）。
- `user.permissions`: 当前用户拥有的权限列表，按字母排序。

**错误响应**：

| HTTP 状态码 | 错误码               | 说明           |
| ----------- | -------------------- | -------------- |
| 401         | `INVALID_CREDENTIALS` | 用户名或密码错误 |
| 401         | `ACCOUNT_DISABLED`    | 账号已被禁用     |

**预置演示账号**（数据库初始化后可用）：

| 用户名    | 密码         | 角色    |
| --------- | ------------ | ------- |
| `admin`   | `admin123`   | 管理员  |
| `teacher` | `teacher123` | 教师    |
| `viewer`  | `viewer123`  | 观察者  |

### 2.3 获取当前用户信息

```http
GET /api/v1/auth/me
```

**请求头**：`Authorization: Bearer <token>` **（必填）**

**成功响应** (200)：返回 `data` 为当前 `User` 对象（结构与登录响应中的 `user` 字段相同）。

前端在页面加载时调用此接口恢复登录会话。

### 2.4 登出

```http
POST /api/v1/auth/logout
```

**请求头**：`Authorization: Bearer <token>` **（必填）**

**成功响应**：`204 No Content`（无响应体）

调用后令牌立即失效，后续使用同一令牌的请求将返回 `401 INVALID_TOKEN`。

---

## 3. 用户管理

> **所需权限**：`users:manage`（仅 admin 角色）

### 3.1 获取用户列表

```http
GET /api/v1/users
```

**成功响应** (200)：`data` 为 `User[]` 数组，按 `id` 升序排列。

### 3.2 创建用户

```http
POST /api/v1/users
```

**请求体**：

| 字段          | 类型    | 必填 | 默认值    | 说明                                 |
| ------------- | ------- | :--: | --------- | ------------------------------------ |
| `username`    | string  |  是  | —         | 用户名，3–64 字符，自动转为小写        |
| `displayName` | string  |  是  | —         | 显示名称，1–120 字符                  |
| `password`    | string  |  是  | —         | 明文密码，6–128 字符                  |
| `role`        | string  |  否  | `viewer`  | 角色：`admin` / `teacher` / `viewer`  |
| `isActive`    | boolean |  否  | `true`    | 是否启用账号                           |

**成功响应**：`201 Created`，`data` 为新创建的 `User` 对象。

**错误响应**：

| HTTP 状态码 | 错误码               | 说明         |
| ----------- | -------------------- | ------------ |
| 409         | `USER_ALREADY_EXISTS` | 用户名已存在 |

### 3.3 更新用户

```http
PATCH /api/v1/users/{user_id}
```

**请求体**（全部字段可选，支持部分更新）：

```json
{
  "displayName": "张三丰",
  "password": "newpassword456",
  "role": "admin",
  "isActive": false
}
```

**成功响应** (200)：`data` 为更新后的 `User` 对象。

### 3.4 删除用户

```http
DELETE /api/v1/users/{user_id}
```

**成功响应**：`204 No Content`

> **限制**：不能删除当前登录用户自己，否则返回 `422 VALIDATION_ERROR`。

---

## 4. 试题管理

### 4.1 试题列表（搜索与筛选）

```http
GET /api/v1/questions
```

> **所需权限**：`questions:read`

**查询参数**：

| 参数            | 类型    | 默认值 | 说明                                                              |
| --------------- | ------- | ------ | ----------------------------------------------------------------- |
| `q`             | string  | —      | 全文搜索关键词，在 `text`、`subject`、`answer`、`tags`、`options` 中进行大小写不敏感的包含匹配 |
| `subject`       | string  | —      | 按学科精确筛选                                                     |
| `difficulty`    | string  | —      | 按难度筛选：`easy` / `medium` / `hard`                              |
| `type`          | string  | —      | 按题型筛选：`choice` / `true_false` / `blank` / `short_answer` / `essay` |
| `tags`          | string  | —      | 按标签筛选，逗号分隔（**交集匹配**：试题必须包含指定的全部标签）      |
| `hasLatex`      | boolean | —      | 按是否含 LaTeX 公式筛选（`true` 或 `false`）                         |
| `ownerId`       | integer | —      | 按出题人 ID 筛选（查看某位教师的个人题库）                           |
| `includeAnswer` | boolean | `true` | 是否在响应中包含 `answer` 字段（需配合 `answers:read` 权限才生效）    |
| `page`          | integer | `1`    | 页码                                                               |
| `pageSize`      | integer | `20`   | 每页条数（最大 100）                                                |
| `sortBy`        | string  | —      | 排序字段                                                            |
| `sortOrder`     | string  | `desc` | 排序方向                                                            |

**示例**：

```
GET /api/v1/questions?q=微积分&subject=数学&difficulty=hard&page=1&pageSize=20
```

**成功响应** (200)：`data` 为分页结构，`items` 数组中每项为试题对象（除答案外详见 [7.1 试题模型](#71-试题-question)）。

### 4.2 获取试题详情

```http
GET /api/v1/questions/{question_id}
```

> **所需权限**：`questions:read`

**查询参数**：

| 参数            | 类型    | 默认值 | 说明                                  |
| --------------- | ------- | ------ | ------------------------------------- |
| `includeAnswer` | boolean | `true` | 是否返回答案（需有 `answers:read` 权限） |

**成功响应** (200)：`data` 为单个试题对象。

**错误响应**：

| HTTP 状态码 | 错误码               | 说明       |
| ----------- | -------------------- | ---------- |
| 404         | `QUESTION_NOT_FOUND` | 试题不存在 |

### 4.3 创建试题

```http
POST /api/v1/questions
```

> **所需权限**：`questions:write`

**请求体**：

| 字段              | 类型          | 必填 | 说明                                                              |
| ----------------- | ------------- | :--: | ----------------------------------------------------------------- |
| `type`            | string        |  是  | 题型：`choice`（选择题）/ `true_false`（判断题）/ `blank`（填空题）/ `short_answer`（简答题）/ `essay`（解答题） |
| `subject`         | string        |  是  | 学科                                                               |
| `difficulty`      | string        |  是  | 难度：`easy` / `medium` / `hard`                                    |
| `tags`            | string[]      |  否  | 标签字符串数组，默认为空数组 `[]`                                    |
| `text`            | string        |  是  | 题面文本，支持 LaTeX 内联公式 `$...$` 和块级公式 `$$...$$`          |
| `options`         | string[]      | 条件 | 选项列表。**仅当 `type=choice` 或 `type=true_false` 时必填**，其他题型不可传此字段 |
| `answer`          | string        |  是  | 答案文本                                                            |
| `source`          | string        |  否  | 题目来源/出处                                                       |
| `essayBlankSpace` | object        | 条件 | 答题区域配置。**仅当 `type=essay` 时有效**，不传则默认 `{"lines":6,"lineHeight":28}` |
| `images`          | object[]      |  否  | 图片列表，每项包含 `url`（必填）和 `caption`（选填），默认为空数组 `[]` |
| `ownerId`         | integer       |  否  | 题目所属用户 ID。不传时后端自动赋值为当前登录用户 ID                   |

`essayBlankSpace` 子字段：

| 字段         | 类型    | 限制      | 说明               |
| ------------ | ------- | --------- | ------------------ |
| `lines`      | integer | 1–20      | 预留答题行数        |
| `lineHeight` | integer | 20–48     | 每行像素高度        |

创建选择题示例：

```json
{
  "type": "choice",
  "subject": "数学",
  "difficulty": "medium",
  "tags": ["代数"],
  "text": "方程 $x^2 - 4 = 0$ 的解是？",
  "options": ["$x=2$", "$x=-2$", "$x=\\pm 2$", "$x=4$"],
  "answer": "$x=\\pm 2$",
  "source": "课本第5章"
}
```

创建解答题示例：

```json
{
  "type": "essay",
  "subject": "物理",
  "difficulty": "medium",
  "tags": ["力学", "牛顿定律"],
  "text": "请解释 $F = ma$ 如何描述力、质量与加速度之间的关系。",
  "answer": "力等于质量乘以加速度。当物体质量不变时，加速度与合外力成正比。",
  "source": "第二章复习题",
  "essayBlankSpace": { "lines": 6, "lineHeight": 28 }
}
```

**成功响应**：`201 Created`，`data` 为创建的试题对象（`hasLatex` 由后端自动计算）。

**题型校验规则**：

| 规则                                                        | HTTP 状态码 |
| ----------------------------------------------------------- | ----------- |
| `type=choice` 或 `type=true_false` 时必须提供非空 `options`  | 422         |
| `type=blank`、`short_answer` 或 `essay` 时不能提供 `options`  | 422         |

### 4.4 更新试题

```http
PATCH /api/v1/questions/{question_id}
```

> **所需权限**：`questions:write`

支持部分更新，只需传入需要变更的字段。

**请求体示例**：

```json
{
  "difficulty": "hard",
  "tags": ["力学", "进阶"]
}
```

**成功响应** (200)：`data` 为更新后的完整试题对象。

### 4.5 删除试题

```http
DELETE /api/v1/questions/{question_id}
```

> **所需权限**：`questions:delete`

**成功响应**：`204 No Content`

### 4.6 获取我的试题（个人题库）

```http
GET /api/v1/questions/mine
```

> **所需权限**：`questions:read`

返回当前登录用户（教师）自己创建的试题列表。查询参数与 `GET /api/v1/questions` 相同（不含 `ownerId`，因为会自动过滤为当前用户）。

### 4.7 上传试题图片

```http
POST /api/v1/images/upload
```

> **所需权限**：`questions:write`

**请求体**：

| 字段       | 类型   | 必填 | 说明                                      |
| ---------- | ------ | :--: | ----------------------------------------- |
| `filename` | string |  是  | 原始文件名                                |
| `data`     | string |  是  | Base64 编码的图片数据                      |
| `mimeType` | string |  否  | MIME 类型，默认 `image/png`，支持 `image/png`、`image/jpeg`、`image/gif`、`image/webp`、`image/svg+xml` |

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "url": "data:image/png;base64,...",
    "filename": "abc123.png",
    "mimeType": "image/png"
  }
}
```

返回的 `url` 为 data URL，可直接用于试题的 `images` 数组中。

---

## 5. 试卷管理

### 5.1 创建试卷

```http
POST /api/v1/papers
```

> **所需权限**：`papers:write`

**请求体**：

| 字段         | 类型           | 必填 | 说明                   |
| ------------ | -------------- | :--: | ---------------------- |
| `title`      | string         |  是  | 试卷标题                |
| `subject`    | string         |  是  | 学科                    |
| `duration`   | integer        |  是  | 考试时长（分钟），必须 > 0 |
| `totalMarks` | integer        |  是  | 试卷总分，必须 > 0       |
| `questions`  | QuestionRef[]  |  否  | 试题引用列表，默认为空   |

`QuestionRef` 对象：

| 字段          | 类型    | 必填 | 说明                   |
| ------------- | ------- | :--: | ---------------------- |
| `questionId`  | integer |  是  | 试题 ID，必须已存在      |
| `orderNo`     | integer |  是  | 排序号（> 0），同一试卷内不可重复 |
| `marks`       | integer |  否  | 该题分值（> 0）          |

示例：

```json
{
  "title": "2026 年期中考试",
  "subject": "数学",
  "duration": 60,
  "totalMarks": 100,
  "questions": [
    { "questionId": 1, "orderNo": 1, "marks": 10 },
    { "questionId": 4, "orderNo": 2, "marks": 15 }
  ]
}
```

**校验规则**：

- `questions` 中 `questionId` 不可重复
- `questions` 中 `orderNo` 不可重复
- 每个 `questionId` 对应的试题必须已存在

**成功响应**：`201 Created`，`data` 为创建的试卷对象（含展开的试题详情）。

### 5.2 获取试卷详情

```http
GET /api/v1/papers/{paper_id}
```

> **所需权限**：`papers:read`

**查询参数**：

| 参数            | 类型    | 默认值 | 说明                                                      |
| --------------- | ------- | ------ | --------------------------------------------------------- |
| `expand`        | string  | —      | 传 `questions` 时展开试题详情，否则 `questions` 仅返回 `QuestionRef` 引用 |
| `includeAnswer` | boolean | `true` | 是否返回答案（需有 `answers:read` 权限）                    |

**示例**：

```
GET /api/v1/papers/1?expand=questions&includeAnswer=true
```

**成功响应** (200)（`expand=questions` 时，`questions` 数组中的每项为展开的试题对象，额外包含 `orderNo` 和 `marks` 字段）。

### 5.3 更新试卷元数据

```http
PATCH /api/v1/papers/{paper_id}
```

> **所需权限**：`papers:write`

**请求体**（全部可选）：

| 字段         | 类型    | 说明                                    |
| ------------ | ------- | --------------------------------------- |
| `title`      | string  | 试卷标题                                 |
| `subject`    | string  | 学科                                    |
| `duration`   | integer | 考试时长（分钟）                          |
| `totalMarks` | integer | 试卷总分                                 |
| `status`     | string  | 状态：`draft`（草稿）/ `published`（已发布） |

**成功响应** (200)：`data` 为更新后的试卷对象。

### 5.4 向试卷添加试题

```http
POST /api/v1/papers/{paper_id}/questions
```

> **所需权限**：`papers:write`

**请求体**：`QuestionRef[]` 数组。

```json
[
  { "questionId": 5, "orderNo": 3, "marks": 20 }
]
```

**校验**：不允许添加已在试卷中的试题（`questionId` 或 `orderNo` 重复均返回 `409` 或 `422`）。

**成功响应** (200)：`data` 为更新后的试卷详情（含展开试题）。

### 5.5 从试卷移除试题

```http
DELETE /api/v1/papers/{paper_id}/questions/{question_id}
```

> **所需权限**：`papers:write`

**错误响应**：若该试题不在试卷中，返回 `404`。

**成功响应** (200)：`data` 为更新后的试卷详情。

### 5.6 调整试题排序

```http
PUT /api/v1/papers/{paper_id}/questions/order
```

> **所需权限**：`papers:write`

**请求体**：

```json
{
  "orders": [
    { "questionId": 4, "orderNo": 1 },
    { "questionId": 1, "orderNo": 2 },
    { "questionId": 5, "orderNo": 3 }
  ]
}
```

- `orders` 必须包含试卷中的 **每一道** 试题，遗漏或多余均报错。
- `questionId` 和 `orderNo` 均不可重复。

**成功响应** (200)：`data` 为重排后的试卷详情。

### 5.7 导出预览

```http
POST /api/v1/papers/{paper_id}/export-preview
```

> **所需权限**：`papers:read`

**请求体**：

| 字段             | 类型    | 默认值    | 说明                                                              |
| ---------------- | ------- | --------- | ----------------------------------------------------------------- |
| `format`         | string  | `"json"`  | 导出格式（当前仅支持 `json`）                                        |
| `includeAnswer`  | boolean | `true`    | 是否包含答案（需 `answers:read` 权限）                               |
| `questionOrder`  | string  | `"paper"` | 试题排序方式：`paper`（按编排顺序）/ `categorized`（按题型分组：选择→填空→解答） |

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "paper": {
      "id": 1,
      "title": "2026 年期中考试",
      "subject": "数学",
      "duration": 60,
      "totalMarks": 100,
      "status": "draft"
    },
    "questions": [
      {
        "id": 1,
        "type": "choice",
        "text": "2+2 等于多少？",
        "options": ["1", "2", "4", "8"],
        "orderNo": 1,
        "marks": 10
      }
    ],
    "renderHint": {
      "format": "json",
      "questionOrder": "paper",
      "includeAnswer": false
    }
  },
  "meta": { "requestId": "..." }
}
```

---

## 6. 元数据

> **所需权限**：`questions:read`

### 6.1 获取学科列表

```http
GET /api/v1/meta/subjects
```

**成功响应** (200)：`data` 为 `string[]`，包含当前题库中所有不重复的学科，按字母排序。

```json
{
  "success": true,
  "data": ["化学", "数学", "物理", "英语"],
  "meta": { "requestId": "..." }
}
```

### 6.2 获取标签列表

```http
GET /api/v1/meta/tags
```

**成功响应** (200)：`data` 为 `string[]`，包含当前题库中所有不重复的标签，按字母排序。

```json
{
  "success": true,
  "data": ["代数", "几何", "力学", "微积分", "牛顿定律"],
  "meta": { "requestId": "..." }
}
```

---

## 7. 数据模型

### 7.1 试题 (Question)

```typescript
interface Question {
  id: number
  type: 'choice' | 'true_false' | 'blank' | 'short_answer' | 'essay'
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  options?: string[]            // 仅 choice / true_false 类型存在
  answer: string                // 无 answers:read 权限时不返回
  hasLatex: boolean             // 后端自动计算
  source?: string
  essayBlankSpace?: {           // 仅 essay 类型存在
    lines: number               // 1–20
    lineHeight: number          // 20–48
  }
  images: {                     // 试题配图，默认为空数组
    url: string                 // 图片 data URL
    caption?: string            // 图片说明（可选）
  }[]
  ownerId?: number | null       // 出题人用户 ID，null 表示系统内置题目
  createdAt: string             // ISO 8601 UTC
  updatedAt: string             // ISO 8601 UTC
}
```

### 7.2 试卷 (Paper)

```typescript
interface Paper {
  id: number
  title: string
  subject: string
  duration: number              // 分钟
  totalMarks: number
  status: 'draft' | 'published'
  questions: PaperQuestion[]    // expand=questions 时展开为 Question 详情
  createdAt: string
  updatedAt: string
}

interface PaperQuestion {
  questionId: number
  orderNo: number
  marks?: number
}
```

### 7.3 用户 (User)

```typescript
interface User {
  id: number
  username: string
  displayName: string
  role: 'admin' | 'teacher' | 'viewer'
  permissions: Permission[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type Permission =
  | 'questions:read'
  | 'questions:write'
  | 'questions:delete'
  | 'answers:read'
  | 'papers:read'
  | 'papers:write'
  | 'users:manage'
```

### 7.4 认证会话 (AuthSession)

```typescript
interface AuthSession {
  token: string
  tokenType: 'bearer'
  expiresAt: string
  user: User
}
```

---

## 8. 错误码

| HTTP 状态码 | 错误码                      | 说明                         |
| ----------- | --------------------------- | ---------------------------- |
| 400         | `INVALID_QUERY_PARAM`       | 查询参数无效                 |
| 401         | `UNAUTHORIZED`              | 未提供认证令牌               |
| 401         | `INVALID_TOKEN`             | 令牌无效                     |
| 401         | `TOKEN_EXPIRED`             | 令牌已过期（过期令牌会被自动清理） |
| 401         | `INVALID_CREDENTIALS`       | 用户名或密码错误             |
| 401         | `ACCOUNT_DISABLED`          | 账号已被禁用                 |
| 403         | `FORBIDDEN`                 | 权限不足                     |
| 404         | `QUESTION_NOT_FOUND`        | 试题不存在                   |
| 404         | `PAPER_NOT_FOUND`           | 试卷不存在                   |
| 404         | `USER_NOT_FOUND`            | 用户不存在                   |
| 409         | `QUESTION_ALREADY_IN_PAPER` | 试题已在试卷中               |
| 409         | `USER_ALREADY_EXISTS`       | 用户名已存在                 |
| 422         | `VALIDATION_ERROR`          | 请求参数校验失败             |
| 500         | `INTERNAL_ERROR`            | 服务器内部错误               |

---

## 9. 前端页面与 API 对应关系

| 前端页面 / 组件                              | 功能             | 调用的 API                                                                                                                                                            |
| -------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/login.vue`                            | 用户登录/登出     | `POST /api/v1/auth/login`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/logout`                                                                                      |
| `pages/questions.vue`（工作台 Workspace）     | 试题浏览与搜索    | `GET /api/v1/questions`<br>`GET /api/v1/questions/mine`                                                                                                                |
| `pages/add-problem.vue`                      | 创建试题          | `POST /api/v1/questions`<br>`POST /api/v1/images/upload`                                                                                                               |
| `components/QuestionWorkspace.vue`           | 试题筛选、答案查看、试卷组装 | `GET /api/v1/questions`（含搜索/筛选参数）<br>`GET /api/v1/questions/mine`<br>可选：`POST/PATCH /api/v1/papers`                                                         |
| `pages/users.vue`                            | 用户管理          | `GET /api/v1/users`<br>`POST /api/v1/users`<br>`PATCH /api/v1/users/{id}`<br>`DELETE /api/v1/users/{id}`                                                                |
| `composables/useQuestionBank.ts`             | 试题 CRUD 封装    | `GET /api/v1/questions`<br>`POST /api/v1/questions`<br>`PATCH /api/v1/questions/{id}`<br>`DELETE /api/v1/questions/{id}`<br>`GET /api/v1/questions/mine`<br>`POST /api/v1/images/upload` |
| `composables/useAuth.ts`                     | 认证状态管理      | `POST /api/v1/auth/login`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/logout`                                                                                      |

---

## 附录：接口速查表

| 方法     | 路径                                        | 所需权限             | 说明             |
| -------- | ------------------------------------------- | -------------------- | ---------------- |
| `POST`   | `/api/v1/auth/login`                        | 无                   | 登录             |
| `GET`    | `/api/v1/auth/me`                           | 登录即可             | 获取当前用户     |
| `POST`   | `/api/v1/auth/logout`                       | 登录即可             | 登出             |
| `GET`    | `/api/v1/users`                             | `users:manage`       | 用户列表         |
| `POST`   | `/api/v1/users`                             | `users:manage`       | 创建用户         |
| `PATCH`  | `/api/v1/users/{id}`                        | `users:manage`       | 更新用户         |
| `DELETE` | `/api/v1/users/{id}`                        | `users:manage`       | 删除用户         |
| `GET`    | `/api/v1/meta/subjects`                     | `questions:read`     | 学科列表         |
| `GET`    | `/api/v1/meta/tags`                         | `questions:read`     | 标签列表         |
| `POST`   | `/api/v1/images/upload`                     | `questions:write`    | 上传试题图片     |
| `GET`    | `/api/v1/questions`                         | `questions:read`     | 试题列表(分页)   |
| `GET`    | `/api/v1/questions/mine`                    | `questions:read`     | 我的试题(分页)   |
| `GET`    | `/api/v1/questions/{id}`                    | `questions:read`     | 试题详情         |
| `POST`   | `/api/v1/questions`                         | `questions:write`    | 创建试题         |
| `PATCH`  | `/api/v1/questions/{id}`                    | `questions:write`    | 更新试题         |
| `DELETE` | `/api/v1/questions/{id}`                    | `questions:delete`   | 删除试题         |
| `POST`   | `/api/v1/papers`                            | `papers:write`       | 创建试卷         |
| `GET`    | `/api/v1/papers/{id}`                       | `papers:read`        | 试卷详情         |
| `PATCH`  | `/api/v1/papers/{id}`                       | `papers:write`       | 更新试卷         |
| `POST`   | `/api/v1/papers/{id}/questions`             | `papers:write`       | 向试卷添加试题   |
| `DELETE` | `/api/v1/papers/{id}/questions/{qid}`       | `papers:write`       | 从试卷移除试题   |
| `PUT`    | `/api/v1/papers/{id}/questions/order`       | `papers:write`       | 调整试题排序     |
| `POST`   | `/api/v1/papers/{id}/export-preview`        | `papers:read`        | 导出预览         |

## 10. Notes for implementation

- The current frontend expects full question content including `answer`.
- If the backend later restricts answer visibility, the workspace client must distinguish authoring mode from exam delivery mode.
- If paper persistence is introduced, the frontend should move builder state out of component-local reactive state and into an API-backed store.
