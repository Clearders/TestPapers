# TestPapers 前后端 API 接口文档

> **版本**: v8
> **后端框架**: FastAPI 0.136 (Python 3.14+)
> **前端框架**: Nuxt 4.4 (TypeScript)
> **最后更新**: 2026-06-14

---

## 目录

- [1. 通用约定](#1-通用约定)
- [2. 认证与鉴权](#2-认证与鉴权)
- [3. 用户管理](#3-用户管理)
- [4. 试题管理](#4-试题管理)
- [5. 试卷管理](#5-试卷管理)
- [6. 元数据](#6-元数据)
- [7. 图片上传](#7-图片上传)
- [8. 异步任务](#8-异步任务)
- [9. 健康检查](#9-健康检查)
- [10. 根路由](#10-根路由)
- [11. 数据模型](#11-数据模型)
- [12. 错误码](#12-错误码)
- [13. 前端页面与 API 对应关系](#13-前端页面与-api-对应关系)
- [14. 实现注意事项](#14-实现注意事项)
- [附录: 接口速查表](#附录接口速查表)

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
| `sortBy`    | string  | `createdAt`  | 排序字段（支持 `id`、`subjects`、`difficulty`、`type`、`createdAt`、`updatedAt`） |
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

### 1.4 资源标识符 (publicId)

大部分资源（试题、试卷、用户）除内部自增 `id` 外，还拥有一个 UUID 格式的公开标识符 `publicId`。API 路径中的资源参数均使用 `publicId`，避免暴露内部业务规模。

---

## 2. 认证与鉴权

### 2.1 权限模型

系统定义了三种角色，每种角色拥有一组操作权限：

| 权限标识            | 说明             | admin | teacher | viewer |
| ------------------- | ---------------- | :---: | :-----: | :----: |
| `questions:read`    | 查看试题列表/详情 |   ✓   |    ✓    |   ✓   |
| `questions:write`   | 创建/编辑试题     |   ✓   |    ✓    |   ✗   |
| `questions:delete`  | 删除试题          |   ✓   | ✓（自己的） |   ✗   |
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
      "publicId": "550e8400-e29b-41d4-a716-446655440000",
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
      "avatarUrl": null,
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
| `password`    | string |  是  | 明文密码，8–128 字符                  |

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

**成功响应** (200)：返回 `data` 为当前 `UserEntity` 对象（结构与登录响应中的 `user` 字段相同）。

### 2.5 刷新会话

```http
POST /api/v1/auth/refresh
```

**认证**：浏览器自动携带 HttpOnly `testpapers_session` Cookie；非浏览器客户端可兼容使用 `Authorization: Bearer <token>`。

**成功响应** (200)：刷新服务端会话、轮换 Cookie，并返回 `AuthSession`。

### 2.6 登出

```http
POST /api/v1/auth/logout
```

**认证**：浏览器自动携带 HttpOnly `testpapers_session` Cookie；接口会清理服务端会话并删除 Cookie。

**成功响应**：`204 No Content`（无响应体）

调用后会话立即失效，后续使用同一 Cookie 或兼容 Bearer token 的请求将返回 `401 INVALID_TOKEN`。

### 2.7 更新个人资料

```http
PATCH /api/v1/auth/profile
```

> **所需权限**：登录即可

**请求体**（至少填写一项）：

| 字段          | 类型   | 必填 | 说明                                    |
| ------------- | ------ | :--: | --------------------------------------- |
| `username`    | string |  否  | 新用户名，3–64 字符；每 30 天最多改一次 |
| `displayName` | string |  否  | 新显示名称，1–120 字符                  |

**成功响应** (200)：`data` 为更新后的 `UserEntity` 对象。

**错误响应**：

| HTTP 状态码 | 错误码                   | 说明                     |
| ----------- | ------------------------ | ------------------------ |
| 400         | `USERNAME_CHANGE_TOO_SOON` | 用户名 30 天内已修改过 |
| 409         | `USER_ALREADY_EXISTS`    | 新用户名已被占用         |

### 2.8 修改密码

```http
PUT /api/v1/auth/password
```

> **所需权限**：登录即可

**请求体**：

| 字段              | 类型   | 必填 | 说明                  |
| ----------------- | ------ | :--: | --------------------- |
| `currentPassword` | string |  是  | 当前密码              |
| `newPassword`     | string |  是  | 新密码，8–128 字符     |

**成功响应**：`204 No Content`

**错误响应**：

| HTTP 状态码 | 错误码            | 说明             |
| ----------- | ----------------- | ---------------- |
| 401         | `INVALID_PASSWORD` | 当前密码不正确 |

### 2.9 上传头像

```http
POST /api/v1/auth/avatar
```

> **所需权限**：登录即可

**请求体**：

| 字段       | 类型   | 必填 | 说明                           |
| ---------- | ------ | :--: | ------------------------------ |
| `filename` | string |  是  | 原始文件名                      |
| `data`     | string |  是  | Base64 编码的 PNG 图片数据       |
| `mimeType` | string |  是  | MIME 类型，当前仅支持 `image/png` |

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "url": "/api/v1/avatars/550e8400-e29b-41d4-a716-446655440000.png",
    "filename": "550e8400-e29b-41d4-a716-446655440000.png",
    "mimeType": "image/png"
  },
  "meta": { "requestId": "..." }
}
```

> 头像最大 500KB，仅支持 PNG 格式。上传后自动替换旧头像。

### 2.10 删除账户

```http
DELETE /api/v1/auth/account
```

> **所需权限**：登录即可

**成功响应**：`204 No Content`

调用后账户被软删除（`isActive=false`），所有会话令牌被清除。

### 2.11 实时 WebSocket

```http
WS /api/v1/ws
```

**认证**：连接握手以以下优先级进行认证：
1. `Authorization: Bearer <token>` 请求头
2. HttpOnly `testpapers_session` Cookie

连接成功后服务端发送 `auth.connected` 事件。客户端发送 `{ "event": "ping" }` 时，服务端返回 `{ "event": "pong" }`。

**限制**：同一 IP 最多 10 个并发 WebSocket 连接。

### 2.12 CSRF 保护

对于修改数据的请求（POST、PATCH、PUT、DELETE），客户端必须提供有效的 CSRF Token：

- 登录/注册成功后，服务端在响应中设置 `testpapers_csrf` Cookie（非 HttpOnly，可供 JS 读取）
- 客户端需从 Cookie 中读取 CSRF Token，并在后续非安全方法的请求头中附带 `X-CSRF-Token`
- `/auth/login` 和 `/auth/register` 免于 CSRF 检查
- 使用显式 `Authorization: Bearer <token>` 认证的非浏览器请求免于 Cookie CSRF 检查
- 登出时服务端清除 CSRF Cookie
- GET/HEAD/OPTIONS 等安全方法不受 CSRF 保护

---

## 3. 用户管理

> **所需权限**：`users:manage`（仅 admin 角色）

### 3.1 获取用户列表

```http
GET /api/v1/users
```

**成功响应** (200)：`data` 为 `UserEntity[]` 数组，按 `id` 升序排列。

### 3.2 创建用户

```http
POST /api/v1/users
```

**请求体**：

| 字段          | 类型    | 必填 | 默认值    | 说明                                 |
| ------------- | ------- | :--: | --------- | ------------------------------------ |
| `username`    | string  |  是  | —         | 用户名，3–64 字符，自动转为小写        |
| `displayName` | string  |  是  | —         | 显示名称，1–120 字符                  |
| `password`    | string  |  是  | —         | 明文密码，8–128 字符                  |
| `role`        | string  |  否  | `viewer`  | 角色：`admin` / `teacher` / `viewer`  |
| `isActive`    | boolean |  否  | `true`    | 是否启用账号                           |

**成功响应**：`201 Created`，`data` 为新创建的 `UserEntity` 对象。

**错误响应**：

| HTTP 状态码 | 错误码               | 说明         |
| ----------- | -------------------- | ------------ |
| 409         | `USER_ALREADY_EXISTS` | 用户名已存在 |

### 3.3 更新用户

```http
PATCH /api/v1/users/{user_public_id}
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

**成功响应** (200)：`data` 为更新后的 `UserEntity` 对象。

### 3.4 删除用户

```http
DELETE /api/v1/users/{user_public_id}
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
| `q`             | string  | —      | 全文搜索关键词，在 `text`、`subjects`、`answer`、`tags`、`options`、`source` 中进行大小写不敏感的包含匹配 |
| `subjects`      | string  | —      | 按学科筛选，逗号分隔多个值                                          |
| `difficulty`    | string  | —      | 按难度筛选：`easy` / `medium` / `hard`                              |
| `type`          | string  | —      | 按题型筛选：`single_choice` / `multiple_choice` / `true_false` / `blank` / `short_answer` / `essay` |
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
GET /api/v1/questions?q=微积分&subjects=数学&difficulty=hard&page=1&pageSize=20
```

**成功响应** (200)：`data` 为分页结构，`items` 数组中每项为试题对象（详见 [11.1 试题模型](#111-试题-questionentity)）。

### 4.2 获取我的试题（个人题库）

```http
GET /api/v1/questions/mine
```

> **所需权限**：`questions:read`

返回当前登录用户自己创建的试题列表。查询参数与 `GET /api/v1/questions` 相同（不含 `ownerId`，因为会自动过滤为当前用户）。

### 4.3 获取试题详情

```http
GET /api/v1/questions/{question_public_id}
```

> **所需权限**：`questions:read`

**查询参数**：

| 参数            | 类型    | 默认值 | 说明                                  |
| --------------- | ------- | ------ | ------------------------------------- |
| `includeAnswer` | boolean | `true` | 是否返回答案（需有 `answers:read` 权限） |

**成功响应** (200)：`data` 为单个 `QuestionEntity` 对象。

**错误响应**：

| HTTP 状态码 | 错误码               | 说明       |
| ----------- | -------------------- | ---------- |
| 404         | `QUESTION_NOT_FOUND` | 试题不存在 |

### 4.4 创建试题

```http
POST /api/v1/questions
```

> **所需权限**：`questions:write`

**请求体**：

| 字段              | 类型          | 必填 | 说明                                                              |
| ----------------- | ------------- | :--: | ----------------------------------------------------------------- |
| `type`            | string        |  是  | 题型：`single_choice` / `multiple_choice` / `true_false` / `blank` / `short_answer` / `essay` |
| `subjects`        | string[]      |  是  | 学科数组（至少一个），如 `["数学", "物理"]`                         |
| `difficulty`      | string        |  是  | 难度：`easy` / `medium` / `hard`                                    |
| `tags`            | string[]      |  否  | 标签字符串数组，默认为空数组 `[]`                                    |
| `text`            | string        |  是  | 题面文本，支持 LaTeX 内联公式 `$...$` 和块级公式 `$$...$$`          |
| `options`         | string[]      | 条件 | 选项列表。**仅当 `type` 为 `single_choice` / `multiple_choice` / `true_false` 时必填**，其他题型不可传此字段 |
| `answer`          | string \| string[] | 是 | 答案：`multiple_choice` 时为字符串数组，其余题型为字符串 |
| `source`          | string        |  否  | 题目来源/出处                                                       |
| `essayBlankSpace` | object        | 条件 | 答题区域配置。**仅当 `type=essay` 时有效**，不传则默认 `{"lines":6,"lineHeight":28}` |
| `images`          | object[]      |  否  | 图片列表，每项包含 `url`（必填）和 `caption`（选填），默认为空数组 `[]` |
| `ownerId`         | integer       |  否  | 题目所属用户 ID。不传时后端自动赋值为当前登录用户 ID                   |
| `scoreWeight`     | number        |  否  | 分值权重，默认 `1.0`，范围 (0, 100]。遗传算法组卷时用于分配分值         |
| `hasLatex`        | boolean       |  否  | 是否含 LaTeX 公式，不传时后端自动检测                                |

`essayBlankSpace` 子字段：

| 字段         | 类型    | 限制      | 说明               |
| ------------ | ------- | --------- | ------------------ |
| `lines`      | integer | 1–20      | 预留答题行数        |
| `lineHeight` | integer | 20–48     | 每行像素高度        |

创建单选题示例：

```json
{
  "type": "single_choice",
  "subjects": ["数学"],
  "difficulty": "medium",
  "tags": ["代数"],
  "text": "方程 $x^2 - 4 = 0$ 的解是？",
  "options": ["$x=2$", "$x=-2$", "$x=\\pm 2$", "$x=4$"],
  "answer": "$x=\\pm 2$",
  "source": "课本第5章"
}
```

创建多选题示例：

```json
{
  "type": "multiple_choice",
  "subjects": ["物理"],
  "difficulty": "easy",
  "tags": ["力学"],
  "text": "以下哪些是矢量？",
  "options": ["速度", "质量", "加速度", "温度"],
  "answer": ["速度", "加速度"],
  "source": "第一章复习"
}
```

创建解答题示例：

```json
{
  "type": "essay",
  "subjects": ["物理"],
  "difficulty": "medium",
  "tags": ["力学", "牛顿定律"],
  "text": "请解释 $F = ma$ 如何描述力、质量与加速度之间的关系。",
  "answer": "力等于质量乘以加速度。当物体质量不变时，加速度与合外力成正比。",
  "source": "第二章复习题",
  "essayBlankSpace": { "lines": 6, "lineHeight": 28 }
}
```

**成功响应**：`201 Created`，`data` 为创建的 `QuestionEntity` 对象。

**校验规则**：

| 规则                                                        | HTTP 状态码 |
| ----------------------------------------------------------- | ----------- |
| `type` 为选择题/判断题时必须提供非空 `options`  | 422         |
| `type` 为填空题/简答题/解答题时不能提供 `options`  | 422         |
| `multiple_choice` 的 `answer` 必须是字符串数组且至少一个元素 | 422         |

### 4.5 更新试题

```http
PATCH /api/v1/questions/{question_public_id}
```

> **所需权限**：`questions:write`（只能修改自己拥有的试题或 admin 可修改所有）

支持部分更新，只需传入需要变更的字段。每次成功更新会生成一条修订历史记录。

**请求体示例**：

```json
{
  "difficulty": "hard",
  "tags": ["力学", "进阶"]
}
```

**成功响应** (200)：`data` 为更新后的完整 `QuestionEntity` 对象。

### 4.6 删除试题

```http
DELETE /api/v1/questions/{question_public_id}
```

> **所需权限**：`questions:delete`（只能删除自己拥有的试题或 admin 可删除所有）

**成功响应**：`204 No Content`

### 4.7 获取试题修订历史

```http
GET /api/v1/questions/{question_public_id}/revisions
```

> **所需权限**：`questions:read`

**成功响应** (200)：`data` 为 `QuestionRevisionEntity[]` 数组，按创建时间降序排列。

每项修订记录包含：

| 字段           | 类型    | 说明                            |
| -------------- | ------- | ------------------------------- |
| `id`           | integer | 修订记录 ID                      |
| `questionId`   | integer | 关联的试题 ID                    |
| `userId`       | integer | 操作者用户 ID（可能为 null）     |
| `patch`        | object  | 本次变更的字段快照               |
| `changeSummary`| string  | 人类可读的变更摘要               |
| `createdAt`    | string  | 修订创建时间                     |

### 4.8 删除修订记录

```http
DELETE /api/v1/questions/{question_public_id}/revisions/{revision_id}
```

> **所需权限**：`questions:delete`

**成功响应**：`204 No Content`

### 4.9 提交试题纠错

```http
POST /api/v1/questions/{question_public_id}/corrections
```

> **所需权限**：`questions:read`

**请求体**：

| 字段       | 类型   | 必填 | 说明                                                   |
| ---------- | ------ | :--: | ------------------------------------------------------ |
| `category` | string |  是  | 纠错分类：`wrong_answer` / `unclear` / `typo` / `other` |
| `message`  | string |  是  | 纠错说明文字，1–1000 字符                                |

**成功响应**：`201 Created`，`data` 为 `QuestionCorrectionEntity` 对象（初始状态为 `open`）。

### 4.10 获取试题纠错列表

```http
GET /api/v1/questions/{question_public_id}/corrections
```

> **所需权限**：`questions:read`

**成功响应** (200)：`data` 为 `QuestionCorrectionEntity[]` 数组，按创建时间降序排列。

每项纠错记录包含：

| 字段         | 类型    | 说明                                        |
| ------------ | ------- | ------------------------------------------- |
| `id`         | integer | 纠错记录 ID                                  |
| `questionId` | integer | 关联的试题 ID                                |
| `userId`     | integer | 提交者用户 ID（可能为 null）                 |
| `category`   | string  | 纠错分类                                    |
| `message`    | string  | 纠错说明文字                                 |
| `status`     | string  | 处理状态：`open` / `accepted` / `rejected`    |
| `createdAt`  | string  | 提交时间                                     |
| `updatedAt`  | string  | 最后更新时间                                  |

### 4.11 更新纠错状态

```http
PATCH /api/v1/questions/{question_public_id}/corrections/{correction_id}
```

> **所需权限**：`questions:write`（仅试题所有者或 admin 可操作）

**请求体**：

| 字段     | 类型   | 必填 | 说明                                     |
| -------- | ------ | :--: | ---------------------------------------- |
| `status` | string |  是  | 新状态：`accepted`（接受）/ `rejected`（拒绝） |

**成功响应** (200)：`data` 为更新后的 `QuestionCorrectionEntity` 对象。

### 4.12 删除纠错记录

```http
DELETE /api/v1/questions/{question_public_id}/corrections/{correction_id}
```

> **所需权限**：`questions:delete`

**成功响应**：`204 No Content`

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

| 字段               | 类型    | 必填 | 说明                   |
| ------------------ | ------- | :--: | ---------------------- |
| `questionPublicId` | string  |  是  | 试题 publicId，必须已存在 |
| `orderNo`          | integer |  是  | 排序号（> 0），同一试卷内不可重复 |
| `marks`            | integer |  否  | 该题分值（> 0）          |

示例：

```json
{
  "title": "2026 年期中考试",
  "subject": "数学",
  "duration": 60,
  "totalMarks": 100,
  "questions": [
    { "questionPublicId": "550e8400-...", "orderNo": 1, "marks": 10 },
    { "questionPublicId": "660e8400-...", "orderNo": 2, "marks": 15 }
  ]
}
```

**校验规则**：

- `questions` 中 `questionPublicId` 不可重复
- `questions` 中 `orderNo` 不可重复
- 每个 `questionPublicId` 对应的试题必须已存在

**成功响应**：`201 Created`，`data` 为创建的 `PaperEntity` 对象（含展开的试题详情）。

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
| `duration`              | integer   |  是  | —       | 考试时长（分钟），必须 > 0                                     |
| `totalMarks`            | integer   |  是  | —       | 试卷总分，必须 > 0；也是自动分配分值的目标总分                  |
| `difficultyCoefficient` | number    |  是  | —       | 难度系数，范围 0–1，后端保留两位小数。用于推导 easy/medium/hard 目标分布 |
| `questionTypes`         | object[]  |  是  | —       | 题型目标数组，每项含 `questionType`（题型）和 `count`（数量）      |
| `subjects`              | string[]  |  是  | —       | 学科数组（至少一个），用于筛选候选试题                           |
| `ownQuestionsOnly`      | boolean   |  否  | `false` | 是否仅从当前用户个人题库中选题                                  |
| `requiredTags`          | string[]  |  否  | `[]`    | 候选试题必须包含的标签（交集匹配），用于约束候选池              |
| `preferredTags`         | string[]  |  否  | `[]`    | 优选标签列表，包含越多优选标签的试题适应度评分越高              |

`questionType` 成员：

| 字段           | 类型    | 必填 | 说明                      |
| -------------- | ------- | :--: | ------------------------- |
| `questionType` | string  |  是  | 题型（同试题类型枚举）     |
| `count`        | integer |  是  | 该题型需要选取的题目数量   |

示例：

```json
{
  "title": "2026 年期中考试",
  "duration": 60,
  "totalMarks": 100,
  "difficultyCoefficient": 0.65,
  "questionTypes": [
    { "questionType": "single_choice", "count": 5 },
    { "questionType": "blank", "count": 3 },
    { "questionType": "essay", "count": 2 }
  ],
  "subjects": ["数学"],
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
    "paper": {
      "id": 1,
      "publicId": "770e8400-...",
      "title": "2026 年期中考试",
      "subject": "数学",
      "duration": 60,
      "totalMarks": 100,
      "status": "draft",
      "questions": [],
      "createdAt": "2026-06-12T10:00:00Z",
      "updatedAt": "2026-06-12T10:00:00Z"
    },
    "diagnostics": {
      "fitness": 0.85,
      "candidateCount": 45,
      "questionCount": 10,
      "ownQuestionsOnly": false,
      "difficultyCoefficient": 0.65,
      "scoreWeightActual": 10.0,
      "marksActual": 100,
      "difficultyTargets": { "easy": 2, "medium": 5, "hard": 3 },
      "difficultyActual": { "easy": 2, "medium": 5, "hard": 3 },
      "typeTargets": { "single_choice": 5, "blank": 3, "essay": 2 },
      "typeActual": { "single_choice": 5, "blank": 3, "essay": 2 },
      "generationsRun": 50,
      "requiredTags": ["代数"],
      "preferredTags": ["基础"]
    }
  },
  "meta": { "requestId": "..." }
}
```

`diagnostics` 字段说明：

| 字段                   | 说明                                                    |
| ---------------------- | ------------------------------------------------------- |
| `fitness`              | 适应度得分（越接近 1000 越好）                            |
| `candidateCount`       | 候选池试题数量                                           |
| `questionCount`        | 实际选入试卷的试题数量                                    |
| `difficultyCoefficient`| 请求的难度系数（保留两位小数）                             |
| `scoreWeightActual`    | 实际总权重                                               |
| `marksActual`          | 实际总分值（应等于请求的 `totalMarks`）                    |
| `difficultyTargets`    | 各难度级别的目标数量                                      |
| `difficultyActual`     | 实际选中的难度分布                                         |
| `typeTargets`          | 目标题型分布                                              |
| `typeActual`           | 实际题型分布                                              |
| `generationsRun`       | 遗传算法迭代代数；候选数等于所需题目数时为 0              |

**错误响应**：

| HTTP 状态码 | 错误码                   | 说明                          |
| ----------- | ------------------------ | ----------------------------- |
| 401         | `UNAUTHORIZED`           | 未认证                         |
| 403         | `FORBIDDEN`              | 缺少 `papers:write` 权限       |
| 422         | `VALIDATION_ERROR`       | 请求参数校验失败                |
| 422         | `INSUFFICIENT_QUESTIONS` | 按条件筛选后候选题数量不足       |

### 5.3 获取试卷详情

```http
GET /api/v1/papers/{paper_public_id}
```

> **所需权限**：`papers:read`

**查询参数**：

| 参数            | 类型    | 默认值 | 说明                                                      |
| --------------- | ------- | ------ | --------------------------------------------------------- |
| `expand`        | string  | —      | 传 `questions` 时展开试题详情，否则 `questions` 仅返回 `QuestionRef` 引用 |
| `includeAnswer` | boolean | `true` | 是否返回答案（需有 `answers:read` 权限）                    |

**示例**：

```
GET /api/v1/papers/770e8400-...?expand=questions&includeAnswer=true
```

**成功响应** (200)（`expand=questions` 时，`questions` 数组中的每项为展开的试题对象，额外包含 `orderNo` 和 `marks` 字段）。

### 5.4 更新试卷元数据

```http
PATCH /api/v1/papers/{paper_public_id}
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

**成功响应** (200)：`data` 为更新后的 `PaperEntity` 对象。

### 5.5 向试卷添加试题

```http
POST /api/v1/papers/{paper_public_id}/questions
```

> **所需权限**：`papers:write`

**请求体**：`QuestionRef[]` 数组。

```json
[
  { "questionPublicId": "880e8400-...", "orderNo": 3, "marks": 20 }
]
```

**校验**：不允许添加已在试卷中的试题（`questionPublicId` 或 `orderNo` 重复均返回 `409` 或 `422`）。

**成功响应** (200)：`data` 为更新后的试卷详情（含展开试题）。

### 5.6 从试卷移除试题

```http
DELETE /api/v1/papers/{paper_public_id}/questions/{question_public_id}
```

> **所需权限**：`papers:write`

**错误响应**：若该试题不在试卷中，返回 `404`。

**成功响应** (200)：`data` 为更新后的试卷详情。

### 5.7 调整试题排序

```http
PUT /api/v1/papers/{paper_public_id}/questions/order
```

> **所需权限**：`papers:write`

**请求体**：

```json
{
  "orders": [
    { "questionPublicId": "880e8400-...", "orderNo": 1 },
    { "questionPublicId": "770e8400-...", "orderNo": 2 },
    { "questionPublicId": "660e8400-...", "orderNo": 3 }
  ]
}
```

- `orders` 必须包含试卷中的 **每一道** 试题，遗漏或多余均报错。
- `questionPublicId` 和 `orderNo` 均不可重复。

**成功响应** (200)：`data` 为重排后的试卷详情。

### 5.8 导出预览

```http
POST /api/v1/papers/{paper_public_id}/export-preview
```

> **所需权限**：`papers:read`

**请求体**：

| 字段             | 类型    | 默认值    | 说明                                                              |
| ---------------- | ------- | --------- | ----------------------------------------------------------------- |
| `includeAnswer`  | boolean | `true`    | 是否包含答案（需 `answers:read` 权限）                               |
| `questionOrder`  | string  | `"paper"` | 试题排序方式：`paper`（按编排顺序）/ `categorized`（按题型分组） |
| `layoutDensity`  | string  | `"auto"`  | DOCX layout density: `auto`, `normal`, `compact`, or `dense`. |

**成功响应** (200)：

```json
{
  "success": true,
  "data": {
    "paper": {
      "id": 1,
      "publicId": "770e8400-...",
      "title": "2026 年期中考试",
      "subject": "数学",
      "duration": 60,
      "totalMarks": 100,
      "status": "draft",
      "createdAt": "2026-06-12T10:00:00Z",
      "updatedAt": "2026-06-12T10:00:00Z"
    },
    "questions": [
      {
        "id": 1,
        "publicId": "550e8400-...",
        "type": "single_choice",
        "subjects": ["数学"],
        "text": "2+2 等于多少？",
        "options": ["1", "2", "4", "8"],
        "orderNo": 1,
        "marks": 10
      }
    ],
    "renderHint": {
      "questionOrder": "paper",
      "includeAnswer": false,
      "layoutDensity": "auto"
    }
  },
  "meta": { "requestId": "..." }
}
```

### 5.9 下载 DOCX 试卷

```http
GET /api/v1/papers/{paper_public_id}/download
```

> **所需权限**：`papers:read`

**查询参数**：

| 参数             | 类型    | 默认值     | 说明                                                    |
| ---------------- | ------- | ---------- | ------------------------------------------------------- |
| `format`         | string  | `"docx"`  | 导出格式（当前仅支持 `docx`）                             |
| `includeAnswer`  | boolean | `true`     | 是否包含答案（需 `answers:read` 权限，否则强制为 `false`） |
| `questionOrder`  | string  | `"paper"`  | 排序方式：`paper`（编排顺序）/ `categorized`（题型分组）   |
| `layoutDensity`  | string  | `"auto"`   | DOCX layout density: `auto`, `normal`, `compact`, or `dense`. |

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

---

## 7. 图片上传

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
    "url": "/api/v1/images/files/abc123def456.png",
    "filename": "abc123def456.png",
    "mimeType": "image/png"
  }
}
```

> 最大 30MB，仅支持 PNG。返回的 `url` 为后端静态资源路径。

---

## 8. 异步任务

> 异步任务通过 Celery 任务队列执行，结果存储在 Redis 中。客户端通过轮询任务状态获取结果。

### 8.1 Celery Worker 健康检查

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

### 8.2 查询任务状态与结果

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

### 8.3 异步导出试卷

```http
POST /api/v1/tasks/export-paper/{paper_public_id}
```

> **所需权限**：`papers:read`

**查询参数**：

| 参数              | 类型    | 默认值     | 说明                                                    |
| ----------------- | ------- | ---------- | ------------------------------------------------------- |
| `format`          | string  | `"json"`   | 导出格式：`json` / `csv` / `txt`                         |
| `include_answer`  | boolean | `true`     | 是否包含答案（需 `answers:read` 权限）                    |
| `question_order`  | string  | `"paper"`  | 排序方式：`paper`（编排顺序）/ `categorized`（题型分组）   |

**成功响应** (200)：返回 `taskId`、`paperId`（即传入的 `paper_public_id`）和 `status: "dispatched"`。

### 8.4 验证全部试题

```http
POST /api/v1/tasks/validate-questions
```

> **所需权限**：`questions:read`

**成功响应** (200)：返回 `taskId` 和 `status: "dispatched"`。

### 8.5 验证单个试题

```http
POST /api/v1/tasks/validate-question/{question_public_id}
```

> **所需权限**：`questions:read`

**成功响应** (200)：返回 `taskId`、`questionId`（即传入的 `question_public_id`）和 `status: "dispatched"`。

### 8.6 清理过期认证令牌

```http
POST /api/v1/tasks/cleanup-expired-sessions
```

> **所需权限**：`users:manage`

向 Celery 派发异步清理任务，清理所有已过期的 `auth_tokens` 记录。

### 8.7 试题统计信息

```http
POST /api/v1/tasks/stats/questions
```

> **所需权限**：`questions:read`

向 Celery 派发异步统计计算任务。任务完成后 `result` 中包含：

```json
{
  "total": 150,
  "byType": { "single_choice": 60, "blank": 30, "essay": 20, "true_false": 10 },
  "byDifficulty": { "easy": 45, "medium": 75, "hard": 30 },
  "bySubject": { "数学": 80, "物理": 50, "化学": 20 },
  "withLatex": 45,
  "topTags": [["代数", 30], ["几何", 25]],
  "computedAt": "2026-05-11T12:00:00Z"
}
```

---

## 9. 健康检查

> 用于运维监控，无需认证。

### 9.1 PostgreSQL 健康检查

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

### 9.2 Redis 健康检查

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

---

## 10. 根路由

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

## 11. 数据模型

### 11.1 试题 (QuestionEntity)

```typescript
interface QuestionEntity {
  id: number
  publicId: string
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'blank' | 'short_answer' | 'essay'
  subjects: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  options?: string[]            // 仅 single_choice / multiple_choice / true_false 类型存在
  answer: string | string[]     // multiple_choice 为 string[], 其余为 string；无 answers:read 权限时不返回
  hasLatex: boolean
  source?: string
  essayBlankSpace?: {           // 仅 essay 类型存在
    lines: number               // 1–20
    lineHeight: number          // 20–48
  }
  images: {                     // 试题配图
    url: string
    caption?: string
  }[]
  scoreWeight: number           // 分值权重（默认 1.0），范围 (0, 100]
  ownerId?: number | null       // 出题人用户 ID，null 表示无归属
  createdAt: string             // ISO 8601 UTC
  updatedAt: string             // ISO 8601 UTC
}
```

### 11.2 试卷 (PaperEntity)

```typescript
interface PaperEntity {
  id: number
  publicId: string
  title: string
  subject: string
  duration: number              // 分钟
  totalMarks: number
  status: 'draft' | 'published'
  questions: QuestionRef[]      // expand=questions 时每项展开为 QuestionEntity
  createdAt: string
  updatedAt: string
}

interface QuestionRef {
  questionPublicId: string
  orderNo: number
  marks?: number | null
}
```

### 11.3 用户 (UserEntity)

```typescript
interface UserEntity {
  id: number
  publicId: string
  username: string
  displayName: string
  role: 'admin' | 'teacher' | 'viewer'
  permissions: Permission[]
  isActive: boolean
  avatarUrl?: string | null
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

### 11.4 认证会话 (AuthSession)

```typescript
interface AuthSession {
  expiresAt: string
  user: UserEntity
}
```

### 11.5 试题修订 (QuestionRevisionEntity)

```typescript
interface QuestionRevisionEntity {
  id: number
  questionId: number
  userId: number | null
  patch: Record<string, unknown>
  changeSummary: string
  createdAt: string
}
```

### 11.6 试题纠错 (QuestionCorrectionEntity)

```typescript
interface QuestionCorrectionEntity {
  id: number
  questionId: number
  userId: number | null
  category: 'wrong_answer' | 'unclear' | 'typo' | 'other'
  message: string
  status: 'open' | 'accepted' | 'rejected'
  createdAt: string
  updatedAt: string
}
```

---

## 12. 错误码

| HTTP 状态码 | 错误码                      | 说明                         |
| ----------- | --------------------------- | ---------------------------- |
| 400         | `USERNAME_CHANGE_TOO_SOON`  | 用户名 30 天内已修改过         |
| 401         | `UNAUTHORIZED`              | 未提供认证令牌               |
| 401         | `INVALID_TOKEN`             | 令牌无效                     |
| 401         | `TOKEN_EXPIRED`             | 令牌已过期（过期令牌会被自动清理） |
| 401         | `INVALID_CREDENTIALS`       | 用户名或密码错误             |
| 401         | `INVALID_PASSWORD`          | 修改密码时当前密码不正确      |
| 401         | `ACCOUNT_DISABLED`          | 账号已被禁用                 |
| 403         | `FORBIDDEN`                 | 权限不足                     |
| 403         | `CSRF_MISSING`              | CSRF Token 缺失               |
| 403         | `CSRF_MISMATCH`             | CSRF Token 不匹配              |
| 404         | `QUESTION_NOT_FOUND`        | 试题不存在                   |
| 404         | `PAPER_NOT_FOUND`           | 试卷不存在                   |
| 404         | `USER_NOT_FOUND`            | 用户不存在                   |
| 404         | `CORRECTION_NOT_FOUND`      | 纠错记录不存在                |
| 404         | `REVISION_NOT_FOUND`        | 修订记录不存在                |
| 409         | `QUESTION_ALREADY_IN_PAPER` | 试题已在试卷中               |
| 409         | `USER_ALREADY_EXISTS`       | 用户名已存在                 |
| 413         | `PAYLOAD_TOO_LARGE`         | 图片上传超过大小限制           |
| 422         | `VALIDATION_ERROR`          | 请求参数校验失败             |
| 422         | `INSUFFICIENT_QUESTIONS`    | 自动组卷候选题数量不足       |
| 500         | `INTERNAL_ERROR`            | 服务器内部错误               |

---

## 13. 前端页面与 API 对应关系

| 前端页面 / 组件                      | 功能               | 调用的 API                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/login.vue`                    | 用户登录            | `POST /api/v1/auth/login`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/refresh`                                                                                                                                                                                                |
| `pages/register.vue`                 | 用户注册            | `POST /api/v1/auth/register`                                                                                                                                                                                                                                                     |
| `pages/account.vue`                  | 个人账户管理         | `GET /api/v1/auth/me`<br>`PATCH /api/v1/auth/profile`<br>`PUT /api/v1/auth/password`<br>`POST /api/v1/auth/avatar`<br>`DELETE /api/v1/auth/account`                                                                                                                              |
| `pages/questions.vue`                | 试题浏览与搜索       | `GET /api/v1/questions`<br>`GET /api/v1/questions/mine`                                                                                                                                                                                                                          |
| `pages/add-problem.vue`              | 创建试题            | `POST /api/v1/questions`<br>`POST /api/v1/images/upload`                                                                                                                                                                                                                         |
| `pages/latex.vue`                    | LaTeX 编辑器        | —（纯前端功能）                                                                                                                                                                                                                                                                  |
| `components/QuestionWorkspace.vue`   | 工作台（筛选/组卷）  | `GET /api/v1/questions`<br>`GET /api/v1/questions/mine`<br>`POST /api/v1/papers`<br>`POST /api/v1/papers/generate`<br>`GET /api/v1/papers/{id}/download`                                                                                                                          |
| `components/questions/AddProblemPreview.vue` | 试题预览   | —（纯展示）                                                                                                                                                                                                                                                                      |
| `components/questions/EditQuestionModal.vue` | 编辑试题   | `PATCH /api/v1/questions/{publicId}`                                                                                                                                                                                                                                              |
| `components/questions/QuestionRevisionHistory.vue` | 修订历史 | `GET /api/v1/questions/{publicId}/revisions`<br>`DELETE /api/v1/questions/{publicId}/revisions/{id}`                                                                                                                                                                             |
| `components/questions/QuestionCorrectionModal.vue` | 提交纠错 | `POST /api/v1/questions/{publicId}/corrections`<br>`GET /api/v1/questions/{publicId}/corrections`<br>`PATCH /api/v1/questions/{publicId}/corrections/{id}`<br>`DELETE /api/v1/questions/{publicId}/corrections/{id}`                                                              |
| `pages/users.vue`                    | 用户管理（admin）   | `GET /api/v1/users`<br>`POST /api/v1/users`<br>`PATCH /api/v1/users/{publicId}`<br>`DELETE /api/v1/users/{publicId}`                                                                                                                                                              |
| `composables/useAuth.ts`             | 认证状态管理         | `POST /api/v1/auth/login`<br>`POST /api/v1/auth/refresh`<br>`GET /api/v1/auth/me`<br>`POST /api/v1/auth/logout`<br>`PATCH /api/v1/auth/profile`<br>`PUT /api/v1/auth/password`<br>`POST /api/v1/auth/avatar`<br>`DELETE /api/v1/auth/account` |
| `composables/useQuestionBank.ts`     | 试题 CRUD + 元数据  | `GET /api/v1/questions`<br>`POST /api/v1/questions`<br>`PATCH /api/v1/questions/{publicId}`<br>`DELETE /api/v1/questions/{publicId}`<br>`GET /api/v1/questions/mine`<br>`POST /api/v1/images/upload`<br>`GET /api/v1/meta/subjects`<br>`GET /api/v1/meta/tags` |
| `composables/useRealtime.ts`         | WebSocket 实时通信  | `WS /api/v1/ws`                                                                                                                                                                                                                                                                  |

---

## 14. 实现注意事项

### 14.1 认证与会话

- 前端使用 HttpOnly Cookie（`testpapers_session`）进行认证，JavaScript 不直接读写令牌。
- Nuxt SSR 时通过 `useRequestHeaders(['cookie'])` 转发 Cookie 到后端。
- 客户端收到 `401` 时，API 客户端自动调用 `POST /api/v1/auth/refresh` 刷新，成功则重放原始请求。
- 前端在 `useApi.ts` 中实现了自动 Token 刷新和退避重试机制。
- 非浏览器客户端可使用 `Authorization: Bearer <token>` 作为兼容降级方案。

### 14.2 答案可见性

- `answers:read` 权限控制是否返回试题/试卷中的 `answer` 字段。
- `viewer` 角色无此权限，即使请求参数 `includeAnswer=true`，响应中也不包含答案。
- 后端根据权限自动过滤，前端无需额外处理。

### 14.3 WebSocket 实时通信

- 认证优先级：`Authorization: Bearer` → Cookie `testpapers_session`。令牌不允许出现在 URL 查询参数中。
- 连接成功后服务端发送 `auth.connected` 事件。
- 广播事件：`question.created` / `question.updated` / `question.deleted` / `paper.created` / `paper.updated` / `paper.questions.added` / `paper.question.removed` / `paper.questions.reordered`。
- 前端通过 `useRealtime.ts` composable 管理 WebSocket 连接生命周期，含心跳和指数退避重连。

### 14.4 图片上传

- 图片通过 Base64 编码提交。
- 当前仅支持 PNG 格式，试题图片最大 30MB，头像最大 500KB。
- 试题图片通过 `/api/v1/images/upload` 上传，头像通过 `/api/v1/auth/avatar` 上传。
- 上传后返回 URL 为后端静态资源路径，前端拼接完整 URL 后使用。

### 14.5 遗传算法组卷

- `POST /api/v1/papers/generate` 支持多题型、多学科。
- `subjects` 是学科数组，后端根据所有选定学科构建候选池。
- `questionTypes` 是题型目标数组，每项指定题型和所需数量。
- 后端根据 `difficultyCoefficient` 自动推导各难度级别的目标分布。
- 分值分配根据试题的 `scoreWeight` 字段进行加权计算。
- 响应中的 `diagnostics` 包含完整的生成过程数据供调试。

### 14.6 试题修订与纠错

- 每次通过 `PATCH /api/v1/questions/{publicId}` 更新试题时，自动生成一条修订记录。
- 任何有 `questions:read` 权限的用户都可以提交纠错。
- 仅试题所有者或 admin 可以更新纠错状态（accept/reject）。
- 修订和纠错记录均可单独删除（需 `questions:delete` 权限）。

### 14.7 CSRF 保护

- 登录/注册成功后服务端设置 `testpapers_csrf` Cookie。
- 前端从 Cookie 读取 CSRF Token，在非安全方法请求头中附带 `X-CSRF-Token`。
- `/auth/login` 和 `/auth/register` 免于 CSRF 检查。
- 使用显式 `Authorization: Bearer <token>` 的请求免于 Cookie CSRF 检查。
- 登出时服务端自动清除 CSRF Cookie。

### 14.8 数据库迁移

- 数据库表由 Alembic 迁移管理，不会在应用启动时自动创建。
- 运行 `alembic upgrade head` 即可创建所有表并填充种子数据。
- 当前迁移版本共 12 个，涵盖初始建表到最新功能（分题、多学科、修订/纠错、用户资料）。

---

## 附录：接口速查表

| 方法     | 路径                                                    | 所需权限             | 说明                    |
| -------- | ------------------------------------------------------- | -------------------- | ----------------------- |
| `POST`   | `/api/v1/auth/login`                                    | 无                   | 登录                    |
| `POST`   | `/api/v1/auth/register`                                 | 无                   | 注册并登录              |
| `POST`   | `/api/v1/auth/refresh`                                  | 登录即可             | 刷新会话                |
| `GET`    | `/api/v1/auth/me`                                       | 登录即可             | 获取当前用户            |
| `POST`   | `/api/v1/auth/logout`                                   | 登录即可             | 登出                    |
| `PATCH`  | `/api/v1/auth/profile`                                  | 登录即可             | 更新个人资料            |
| `PUT`    | `/api/v1/auth/password`                                 | 登录即可             | 修改密码                |
| `POST`   | `/api/v1/auth/avatar`                                   | 登录即可             | 上传头像                |
| `DELETE` | `/api/v1/auth/account`                                  | 登录即可             | 删除账户（软删除）      |
| `WS`     | `/api/v1/ws`                                            | 登录即可             | 实时通信 WebSocket      |
| `GET`    | `/api/v1/users`                                         | `users:manage`       | 用户列表                |
| `POST`   | `/api/v1/users`                                         | `users:manage`       | 创建用户                |
| `PATCH`  | `/api/v1/users/{publicId}`                              | `users:manage`       | 更新用户                |
| `DELETE` | `/api/v1/users/{publicId}`                              | `users:manage`       | 删除用户                |
| `GET`    | `/api/v1/meta/subjects`                                 | `questions:read`     | 学科列表                |
| `GET`    | `/api/v1/meta/tags`                                     | `questions:read`     | 标签列表                |
| `POST`   | `/api/v1/images/upload`                                 | `questions:write`    | 上传试题图片            |
| `GET`    | `/api/v1/questions`                                     | `questions:read`     | 试题列表（分页）        |
| `GET`    | `/api/v1/questions/mine`                                | `questions:read`     | 我的试题（分页）        |
| `GET`    | `/api/v1/questions/{publicId}`                          | `questions:read`     | 试题详情                |
| `POST`   | `/api/v1/questions`                                     | `questions:write`    | 创建试题                |
| `PATCH`  | `/api/v1/questions/{publicId}`                          | `questions:write`    | 更新试题（自动修订）    |
| `DELETE` | `/api/v1/questions/{publicId}`                          | `questions:delete`   | 删除试题                |
| `GET`    | `/api/v1/questions/{publicId}/revisions`                | `questions:read`     | 试题修订历史            |
| `DELETE` | `/api/v1/questions/{publicId}/revisions/{revisionId}`   | `questions:delete`   | 删除修订记录            |
| `POST`   | `/api/v1/questions/{publicId}/corrections`              | `questions:read`     | 提交试题纠错            |
| `GET`    | `/api/v1/questions/{publicId}/corrections`              | `questions:read`     | 试题纠错列表            |
| `PATCH`  | `/api/v1/questions/{publicId}/corrections/{correctionId}` | `questions:write`  | 更新纠错状态            |
| `DELETE` | `/api/v1/questions/{publicId}/corrections/{correctionId}` | `questions:delete` | 删除纠错记录            |
| `POST`   | `/api/v1/papers`                                        | `papers:write`       | 创建试卷                |
| `POST`   | `/api/v1/papers/generate`                               | `papers:write`       | 遗传算法自动组卷        |
| `GET`    | `/api/v1/papers/{publicId}`                             | `papers:read`        | 试卷详情                |
| `PATCH`  | `/api/v1/papers/{publicId}`                             | `papers:write`       | 更新试卷                |
| `POST`   | `/api/v1/papers/{publicId}/questions`                   | `papers:write`       | 向试卷添加试题          |
| `DELETE` | `/api/v1/papers/{publicId}/questions/{questionPublicId}`| `papers:write`       | 从试卷移除试题          |
| `PUT`    | `/api/v1/papers/{publicId}/questions/order`              | `papers:write`       | 调整试题排序            |
| `POST`   | `/api/v1/papers/{publicId}/export-preview`              | `papers:read`        | 导出预览                |
| `GET`    | `/api/v1/papers/{publicId}/download`                    | `papers:read`        | 下载 DOCX 试卷          |
| `POST`   | `/api/v1/tasks/ping`                                    | `questions:read`     | Worker 健康检查         |
| `GET`    | `/api/v1/tasks/{task_id}`                               | `questions:read`     | 查询任务状态            |
| `POST`   | `/api/v1/tasks/export-paper/{paper_public_id}`          | `papers:read`        | 异步导出试卷            |
| `POST`   | `/api/v1/tasks/validate-questions`                      | `questions:read`     | 验证全部试题            |
| `POST`   | `/api/v1/tasks/validate-question/{question_public_id}`  | `questions:read`     | 验证单个试题            |
| `POST`   | `/api/v1/tasks/cleanup-expired-sessions`                | `users:manage`       | 清理过期会话            |
| `POST`   | `/api/v1/tasks/stats/questions`                         | `questions:read`     | 试题统计信息            |
| `GET`    | `/api/v1/health/postgres`                               | 无                   | PostgreSQL 健康检查     |
| `GET`    | `/api/v1/health/redis`                                  | 无                   | Redis 健康检查          |
| `GET`    | `/`                                                     | 无                   | 服务信息                |
