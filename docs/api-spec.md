# TestPapers 前后端 API 接口文档

> **版本**: v6  
> **后端框架**: FastAPI (Python)  
> **前端框架**: Nuxt 4 (TypeScript)  
> **最后更新**: 2026-06-10

---

## 目录

- [1. 通用约定](#1-通用约定)
- [2. 认证与鉴权](#2-认证与鉴权)
- [3. 用户管理](#3-用户管理)
- [4. 试题管理](#4-试题管理)
- [5. 试卷管理](#5-试卷管理)
- [6. 元数据](#6-元数据)
- [7. 异步任务](#7-异步任务)
- [8. 健康检查](#8-健康检查)
- [9. 根路由](#9-根路由)
- [10. 数据模型](#10-数据模型)
- [11. 错误码](#11-错误码)
- [12. 前端页面与 API 对应关系](#12-前端页面与-api-对应关系)
- [13. 实现注意事项](#13-实现注意事项)

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
| 认证方式   | HttpOnly Cookie `testpapers_session`（兼容 `Authorization: Bearer <token>`）；非安全方法需附带 CSRF Token |

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
| `questions:delete`  | 删除试题          |   ✓   |    ✗    |   ✗   |
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
  "username": "teacher_zhang",
  "password": "secure_password"
}
```

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
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

- 登录成功后服务端会写入 HttpOnly `testpapers_session` Cookie，浏览器端 JavaScript 不再读取或保存令牌。
- `expiresAt`: 会话过期时间（签发后 **12 小时**）。
- `user.permissions`: 当前用户拥有的权限列表，按字母排序。

**错误响应**：

| HTTP 状态码 | 错误码               | 说明           |
| ----------- | -------------------- | -------------- |
| 401         | `INVALID_CREDENTIALS` | 用户名或密码错误 |
| 401         | `ACCOUNT_DISABLED`    | 账号已被禁用     |

### 2.3 注册

```http
POST /api/v1/auth/register
```

**请求体**：

| 字段          | 类型   | 必填 | 说明                                 |
| ------------- | ------ | :--: | ------------------------------------ |
| `username`    | string |  是  | 用户名，3–64 字符，自动转为小写        |
| `displayName` | string |  是  | 显示名称，1–120 字符                  |
| `password`    | string |  是  | 明文密码，6–128 字符                  |

请求示例：

```json
{
  "username": "teacher_zhang",
  "displayName": "张老师",
  "password": "secure_password"
}
```

**成功响应** (201)：注册成功后自动登录，返回 `AuthSession`，同时设置 HttpOnly `testpapers_session` Cookie。`data` 结构与登录响应相同。

**错误响应**：

| HTTP 状态码 | 错误码               | 说明         |
| ----------- | -------------------- | ------------ |
| 409         | `USER_ALREADY_EXISTS` | 用户名已存在 |

> 公开注册创建的账户角色为 `viewer`，默认为激活状态。

### 2.4 获取当前用户信息

```http
GET /api/v1/auth/me
```

**认证**：浏览器自动携带 HttpOnly `testpapers_session` Cookie；非浏览器客户端可兼容使用 `Authorization: Bearer <token>`。

**成功响应** (200)：返回 `data` 为当前 `User` 对象（结构与登录响应中的 `user` 字段相同）。

前端在页面加载时调用此接口恢复登录会话。

### 2.5 登出

```http
POST /api/v1/auth/logout
```

**认证**：浏览器自动携带 HttpOnly `testpapers_session` Cookie；接口会清理服务端会话并删除 Cookie。

**成功响应**：`204 No Content`（无响应体）

调用后会话立即失效，后续使用同一 Cookie 或兼容 Bearer token 的请求将返回 `401 INVALID_TOKEN`。

### 2.6 刷新会话

```http
POST /api/v1/auth/refresh
```

**认证**：浏览器自动携带 HttpOnly `testpapers_session` Cookie；非浏览器客户端可兼容使用 `Authorization: Bearer <token>`。

**成功响应** (200)：刷新服务端会话、轮换 Cookie，并返回 `AuthSession`。

### 2.7 实时 WebSocket

```http
WS /api/v1/ws
```

**认证**：连接握手时携带 HttpOnly `testpapers_session` Cookie，或兼容使用 Bearer token。

连接成功后服务端发送 `auth.connected` 事件。客户端发送 `{ "event": "ping" }` 时，服务端返回 `{ "event": "pong" }`。

### 2.8 CSRF 保护

对于修改数据的请求（POST、PATCH、PUT、DELETE），客户端必须提供有效的 CSRF Token：

- 登录/注册成功后，服务端在响应中设置 HttpOnly `testpapers_csrf` Cookie
- 客户端需从 Cookie 中读取 CSRF Token，并在后续非安全方法的请求头中附带 `X-CSRF-Token`
- 登出时服务端清除 CSRF Cookie
- GET/HEAD/OPTIONS 等安全方法不受 CSRF 保护

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

**成功响应** (200)：`data` 为分页结构，`items` 数组中每项为试题对象（除答案外详见 [8.1 试题模型](#81-试题-question)）。

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
| `scoreWeight`     | number        |  否  | 分值权重，默认 `1.0`，范围 (0, 100]。遗传算法组卷时用于分配分值         |

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
| `mimeType` | string |  否  | MIME 类型，默认 `image/png`，当前仅支持 `image/png` |

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

### 5.2 遗传算法自动组卷

```http
POST /api/v1/papers/generate
```

> **所需权限**：`papers:write`

通过遗传算法自动从题库中选取试题组成试卷。

**请求体**：

| 字段                    | 类型      | 必填 | 默认值  | 说明                                                         |
| ----------------------- | --------- | :--: | ------- | ------------------------------------------------------------ |
| `title`                 | string    |  是  | —       | 试卷标题                                                      |
| `subject`               | string    |  是  | —       | 学科，用于筛选候选试题                                         |
| `duration`              | integer   |  是  | —       | 考试时长（分钟），必须 > 0                                     |
| `totalMarks`            | integer   |  是  | —       | 试卷总分，必须 > 0；也是自动分配分值的目标总分                  |
| `difficultyCoefficient` | number    |  是  | —       | 难度系数，范围 0–1，后端保留两位小数。用于推导 easy/medium/hard 目标分布 |
| `questionType`          | string    |  是  | —       | 题型：`choice` / `true_false` / `blank` / `short_answer` / `essay` |
| `ownQuestionsOnly`      | boolean   |  否  | `false` | 是否仅从当前用户个人题库中选题                                  |
| `requiredTags`          | string[]  |  否  | `[]`    | 候选试题必须包含的标签（交集匹配），用于约束候选池              |
| `preferredTags`         | string[]  |  否  | `[]`    | 优选标签列表，包含越多优选标签的试题适应度评分越高              |

示例：

```json
{
  "title": "2026 年期中考试",
  "subject": "数学",
  "duration": 60,
  "totalMarks": 100,
  "difficultyCoefficient": 0.65,
  "questionType": "choice",
  "ownQuestionsOnly": false,
  "requiredTags": ["代数"],
  "preferredTags": ["基础"]
}
```

**成功响应** (201)：

```json
{
  "success": true,
  "data": {
    "paper": { },
    "diagnostics": {
      "fitness": 0.85,
      "candidateCount": 45,
      "questionCount": 10,
      "ownQuestionsOnly": false,
      "difficultyCoefficient": 0.65,
      "scoreWeightActual": 10.0,
      "marksActual": 100,
      "difficultyTargets": { "easy": 0.2, "medium": 0.5, "hard": 0.3 },
      "difficultyActual": { "easy": 0.18, "medium": 0.52, "hard": 0.30 },
      "typeTargets": { "choice": 1.0 },
      "typeActual": { "choice": 1.0 },
      "generationsRun": 50
    }
  }
}
```

`diagnostics` 字段说明：

| 字段                   | 说明                                                    |
| ---------------------- | ------------------------------------------------------- |
| `fitness`              | 适应度得分（越接近 1 越好）                              |
| `candidateCount`       | 候选池试题数量                                           |
| `questionCount`        | 实际选入试卷的试题数量                                    |
| `difficultyCoefficient`| 请求的难度系数（保留两位小数）                             |
| `scoreWeightActual`    | 实际总权重                                               |
| `marksActual`          | 实际总分值（应等于请求的 `totalMarks`）                    |
| `difficultyTargets`    | 各难度级别的目标分布比例                                  |
| `difficultyActual`     | 实际选中的难度分布比例                                     |
| `typeTargets`          | 目标题型分布                                              |
| `typeActual`           | 实际题型分布                                              |
| `generationsRun`       | 遗传算法迭代代数；候选数等于题目数时为 0                   |

**错误响应**：

| HTTP 状态码 | 错误码                   | 说明                          |
| ----------- | ------------------------ | ----------------------------- |
| 401         | `UNAUTHORIZED`           | 未认证                         |
| 403         | `FORBIDDEN`              | 缺少 `papers:write` 权限       |
| 422         | `VALIDATION_ERROR`       | 请求参数校验失败                |
| 422         | `INSUFFICIENT_QUESTIONS` | 按条件筛选后候选题数量不足       |

### 5.3 获取试卷详情

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

### 5.4 更新试卷元数据

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

### 5.5 向试卷添加试题

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

### 5.6 从试卷移除试题

```http
DELETE /api/v1/papers/{paper_id}/questions/{question_id}
```

> **所需权限**：`papers:write`

**错误响应**：若该试题不在试卷中，返回 `404`。

**成功响应** (200)：`data` 为更新后的试卷详情。

### 5.7 调整试题排序

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

### 5.8 导出预览

```http
POST /api/v1/papers/{paper_id}/export-preview
```

> **所需权限**：`papers:read`

**请求体**：

| 字段             | 类型    | 默认值    | 说明                                                              |
| ---------------- | ------- | --------- | ----------------------------------------------------------------- |
| `format`         | string  | `"json"`  | 导出格式（当前仅支持 `json`；异步导出 `/api/v1/tasks/export-paper/{id}` 支持 `json`/`csv`/`txt`） |
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

### 5.9 下载 DOCX 试卷

```http
GET /api/v1/papers/{paper_id}/download
```

> **所需权限**：`papers:read`

**查询参数**：

| 参数             | 类型    | 默认值     | 说明                                                    |
| ---------------- | ------- | ---------- | ------------------------------------------------------- |
| `format`         | string  | `"docx"`  | 导出格式（当前仅支持 `docx`）                             |
| `includeAnswer`  | boolean | `true`     | 是否包含答案（需 `answers:read` 权限，否则强制为 `false`） |
| `questionOrder`  | string  | `"paper"`   | 排序方式：`paper`（编排顺序）/ `categorized`（题型分组）   |

**成功响应** (200)：返回 `.docx` 文件的二进制内容，`Content-Type` 为 `application/vnd.openxmlformats-officedocument.wordprocessingml.document`，响应头包含 `Content-Disposition: attachment`。

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

## 7. 异步任务

> 异步任务通过 Celery 任务队列执行，结果存储在 Redis 中。客户端通过轮询任务状态获取结果。

### 7.1 Celery Worker 健康检查

```http
POST /api/v1/tasks/ping
```

> **所需权限**：`questions:read`

向 Celery 消息队列派发一个 `ping` 任务，返回任务 ID 供轮询。

**成功响应** (200)：

```json
{
  "success": true,
  "data": { "taskId": "a1b2c3d4-...", "status": "dispatched" }
}
```

客户端随后可通过 `GET /api/v1/tasks/{task_id}` 轮询任务结果。

### 7.2 查询任务状态与结果

```http
GET /api/v1/tasks/{task_id}
```

> **所需权限**：`questions:read`

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "taskId": "a1b2c3d4-...",
    "status": "SUCCESS",
    "result": { }
  }
}
```

`status` 可能值：`PENDING`、`STARTED`、`SUCCESS`、`FAILURE`、`RETRY`、`PROGRESS`、`REVOKED`。

- `SUCCESS` 时附加 `result` 字段
- `FAILURE` 时附加 `error` 字段（错误描述字符串）
- `PROGRESS` 时附加 `progress` 字段（进度信息）
- `REVOKED` 时附加 `message` 字段

### 7.3 异步导出试卷

```http
POST /api/v1/tasks/export-paper/{paper_id}
```

> **所需权限**：`papers:read`

**查询参数**：

| 参数              | 类型    | 默认值     | 说明                                                    |
| ----------------- | ------- | ---------- | ------------------------------------------------------- |
| `format`          | string  | `"json"`   | 导出格式：`json` / `csv` / `txt`                         |
| `include_answer`  | boolean | `true`     | 是否包含答案（需 `answers:read` 权限）                    |
| `question_order`  | string  | `"paper"`  | 排序方式：`paper`（编排顺序）/ `categorized`（题型分组）   |

**成功响应** (200)：返回 `taskId`、`paperId` 和 `status: "dispatched"`，客户端随后可通过 `GET /api/v1/tasks/{task_id}` 轮询结果。

### 7.4 验证全部试题

```http
POST /api/v1/tasks/validate-questions
```

> **所需权限**：`questions:read`

**成功响应** (200)：返回 `taskId` 和 `status: "dispatched"`，客户端随后可通过 `GET /api/v1/tasks/{task_id}` 轮询验证结果。任务完成后 `result` 中包含每道试题的验证状态和问题列表。

### 7.5 验证单个试题

```http
POST /api/v1/tasks/validate-question/{question_id}
```

> **所需权限**：`questions:read`

**成功响应** (200)：返回 `taskId`、`questionId` 和 `status: "dispatched"`，客户端随后可通过 `GET /api/v1/tasks/{task_id}` 轮询验证结果。

### 7.6 清理过期认证令牌

```http
POST /api/v1/tasks/cleanup-expired-sessions
```

> **所需权限**：`users:manage`

向 Celery 派发异步清理任务，清理所有已过期的 `auth_tokens` 记录。

**成功响应** (200)：返回 `taskId` 和 `status: "dispatched"`，客户端随后可通过 `GET /api/v1/tasks/{task_id}` 轮询结果。

### 7.7 试题统计信息

```http
GET /api/v1/tasks/stats/questions
```

> **所需权限**：`questions:read`

向 Celery 派发异步统计计算任务。**成功响应** (200)：返回 `taskId` 和 `status: "dispatched"`。

任务完成后，`result` 中包含以下统计信息：

```json
{
  "total": 150,
  "byType": { "choice": 60, "blank": 30, "short_answer": 30, "essay": 20, "true_false": 10 },
  "byDifficulty": { "easy": 45, "medium": 75, "hard": 30 },
  "bySubject": { "数学": 80, "物理": 50, "化学": 20 },
  "withLatex": 45,
  "topTags": [["代数", 30], ["几何", 25]],
  "computedAt": "2026-05-11T12:00:00Z"
}
```

---

## 8. 健康检查

> 用于运维监控，无需认证。

### 8.1 PostgreSQL 健康检查

```http
GET /api/v1/health/postgres
```

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "status": "connected",
    "postgresVersion": "PostgreSQL 16.2 ...",
    "latencyMs": 1.23
  }
}
```

**错误响应**：PostgreSQL 不可达时返回 `{"status": "disconnected", "error": "..."}`。

### 8.2 Redis 健康检查

```http
GET /api/v1/health/redis
```

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "status": "connected",
    "redisVersion": "7.0.15",
    "latencyMs": 1.23
  }
}
```

**错误响应**：Redis 不可达时返回 `{"status": "disconnected", "error": "..."}`。

---

## 9. 根路由

```http
GET /
```

> 无需认证。

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "service": "TestPaper Backend",
    "version": "1.0.0"
  }
}
```

---

## 10. 数据模型

### 10.1 试题 (Question)

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
  scoreWeight: number           // 分值权重（默认 1.0），遗传算法组卷时使用
  createdAt: string             // ISO 8601 UTC
  updatedAt: string             // ISO 8601 UTC
}
```

### 10.2 试卷 (Paper)

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

### 10.3 用户 (User)

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

### 10.4 认证会话 (AuthSession)

```typescript
interface AuthSession {
  expiresAt: string
  user: User
}
```

---

## 11. 错误码

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
| 413         | `PAYLOAD_TOO_LARGE`        | 图片上传超过 30MB 限制       |\n| 422         | `VALIDATION_ERROR`          | 请求参数校验失败             |
| 422         | `INSUFFICIENT_QUESTIONS`    | 自动组卷候选题数量不足       |
| 500         | `INTERNAL_ERROR`            | 服务器内部错误               |

---

## 12. 前端页面与 API 对应关系

| 前端页面 / 组件                              | 功能             | 调用的 API                                                                                                                                                            |
| -------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/login.vue`                            | 用户登录/登出     | `POST /api/v1/auth/login`<br>`POST /api/v1/auth/refresh`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/logout`                                                        |
| `pages/register.vue`                         | 用户注册/自动登录  | `POST /api/v1/auth/register`<br>`GET /api/v1/auth/me`                                                                                                                   |
| `pages/questions.vue`（工作台 Workspace）     | 试题浏览与搜索    | `GET /api/v1/questions`<br>`GET /api/v1/questions/mine`                                                                                                                |
| `pages/add-problem.vue`                      | 创建试题          | `POST /api/v1/questions`<br>`POST /api/v1/images/upload`                                                                                                               |
| `components/QuestionWorkspace.vue`           | 试题筛选、答案查看、试卷组装、自动组卷 | `GET /api/v1/questions`（含搜索/筛选参数）<br>`GET /api/v1/questions/mine`<br>`POST /api/v1/papers/generate`<br>可选：`POST/PATCH /api/v1/papers`                         |
| `pages/users.vue`                            | 用户管理          | `GET /api/v1/users`<br>`POST /api/v1/users`<br>`PATCH /api/v1/users/{id}`<br>`DELETE /api/v1/users/{id}`                                                                |
| `composables/useQuestionBank.ts`             | 试题 CRUD 封装    | `GET /api/v1/questions`<br>`POST /api/v1/questions`<br>`PATCH /api/v1/questions/{id}`<br>`DELETE /api/v1/questions/{id}`<br>`GET /api/v1/questions/mine`<br>`POST /api/v1/images/upload` |
| `composables/useAuth.ts`                     | 认证状态管理      | `POST /api/v1/auth/login`<br>`POST /api/v1/auth/refresh`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/logout`<br>`WS /api/v1/ws`                                      |

---

## 附录：接口速查表

| 方法     | 路径                                        | 所需权限             | 说明             |
| -------- | ------------------------------------------- | -------------------- | ---------------- |
| `POST`   | `/api/v1/auth/login`                        | 无                   | 登录             |
| `POST`   | `/api/v1/auth/register`                     | 无                   | 注册并登录（默认 viewer 角色） |
| `POST`   | `/api/v1/auth/refresh`                      | 登录即可             | 刷新会话 Cookie  |
| `GET`    | `/api/v1/auth/me`                           | 登录即可             | 获取当前用户     |
| `POST`   | `/api/v1/auth/logout`                       | 登录即可             | 登出             |
| `WS`     | `/api/v1/ws`                                | 登录即可             | 实时通信         |
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
| `POST`   | `/api/v1/papers/generate`                   | `papers:write`       | 遗传算法自动组卷 |
| `GET`    | `/api/v1/papers/{id}`                       | `papers:read`        | 试卷详情         |
| `PATCH`  | `/api/v1/papers/{id}`                       | `papers:write`       | 更新试卷         |
| `POST`   | `/api/v1/papers/{id}/questions`             | `papers:write`       | 向试卷添加试题   |
| `DELETE` | `/api/v1/papers/{id}/questions/{qid}`       | `papers:write`       | 从试卷移除试题   |
| `PUT`    | `/api/v1/papers/{id}/questions/order`       | `papers:write`       | 调整试题排序     |
| `POST`   | `/api/v1/papers/{id}/export-preview`        | `papers:read`        | 导出预览         |
| `GET`    | `/api/v1/papers/{id}/download`              | `papers:read`        | 下载 DOCX 试卷   |
| `POST`   | `/api/v1/tasks/ping`                        | `questions:read`     | Worker 健康检查 (异步派发) |
| `GET`    | `/api/v1/tasks/{task_id}`                   | `questions:read`     | 查询任务状态     |
| `POST`   | `/api/v1/tasks/export-paper/{id}`           | `papers:read`        | 异步导出试卷     |
| `POST`   | `/api/v1/tasks/validate-questions`          | `questions:read`     | 验证全部试题 (异步派发) |
| `POST`   | `/api/v1/tasks/validate-question/{id}`      | `questions:read`     | 验证单个试题 (异步派发) |
| `POST`   | `/api/v1/tasks/cleanup-expired-sessions`    | `users:manage`       | 清理过期会话 (异步派发) |
| `GET`    | `/api/v1/tasks/stats/questions`             | `questions:read`     | 试题统计信息 (异步派发) |
| `GET`    | `/api/v1/health/postgres`                   | 无                   | PostgreSQL 健康检查 |
| `GET`    | `/api/v1/health/redis`                      | 无                   | Redis 健康检查   |
| `GET`    | `/`                                         | 无                   | 服务信息         |

## 13. 实现注意事项

### 13.1 认证与会话

- 前端使用 HttpOnly Cookie（`testpapers_session`）进行认证，JavaScript 不直接读写令牌。
- Nuxt 服务端渲染（SSR）时通过 `useRequestHeaders(['cookie'])` 转发 Cookie 到后端。
- 客户端收到 `401 TOKEN_EXPIRED` 时，API 客户端自动调用 `POST /api/v1/auth/refresh` 刷新，成功则重放原始请求。
- 非浏览器客户端可使用 `Authorization: Bearer <token>` 作为兼容降级方案。

### 13.2 答案可见性

- `answers:read` 权限控制是否返回试题/试卷中的 `answer` 字段。
- `viewer` 角色无此权限，即使请求参数 `includeAnswer=true`，响应中也不包含答案。
- 前端工作台默认请求答案，但后端根据权限自动过滤。

### 13.3 WebSocket 实时通信

- 连接握手使用与 HTTP API 相同的 Cookie 认证。
- 连接成功后服务端发送 `auth.connected` 事件，包含当前用户信息和服务器时间戳。
- 试题和试卷的增删改操作会广播 WebSocket 事件给所有已连接客户端。广播事件包括：
  - `question.created` / `question.updated` / `question.deleted`
  - `paper.created` / `paper.updated`
  - `paper.questions.added` / `paper.question.removed` / `paper.questions.reordered`
- 前端通过 `useRealtime.ts` composable 管理 WebSocket 连接生命周期。

### 13.4 图片上传

- 图片通过 Base64 编码以 data URL 格式存储。
- 当前仅支持 PNG 格式，单文件最大 30MB。
- 返回的 `url` 为 data URL，可直接放入试题的 `images` 数组。

### 13.5 遗传算法组卷

- `PaperGenerateRequest` 继承 `PaperBase`（含 `title`、`subject`、`duration`、`totalMarks`）。
- 生成输入包含 `totalMarks`、`difficultyCoefficient`、`questionType`、`ownQuestionsOnly`、`requiredTags`、`preferredTags`。
  - `requiredTags`：候选试题必须包含的标签列表（交集匹配），用于约束候选池范围
  - `preferredTags`：优选标签列表，用于适应度评分（包含越多优选标签的试题得分越高）
- 后端按 `subject` 与 `questionType` 构建候选池，并根据 `difficultyCoefficient` 自动推导 `easy` / `medium` / `hard` 的目标分布。
- 题目数量根据 `totalMarks` 与候选题 `scoreWeight` 自动估算，并限制为不超过 `100`、`totalMarks` 和候选题数量。
- 分值分配会根据试题的 `scoreWeight` 字段进行加权计算，最终 `marksActual` 应等于请求的 `totalMarks`。

### 13.6 CSRF 保护

- 登录/注册成功后服务端设置 HttpOnly `testpapers_csrf` Cookie。
- 前端需从 Cookie 读取 CSRF Token，并在 POST/PATCH/PUT/DELETE 请求头中附带 `X-CSRF-Token`。
- 登出时服务端自动清除 CSRF Cookie。
- 注意：非浏览器的 CSRF Token 机制可通过 `POST /api/v1/auth/login` 的 `Set-Cookie` 响应头获取。

### 13.7 数据库迁移

- 数据库表由 Alembic 迁移管理，不会在应用启动时自动创建。
- 运行 `alembic upgrade head` 即可创建所有表并填充种子数据。
