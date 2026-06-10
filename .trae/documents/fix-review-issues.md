# 修复审查报告中的 8 个问题

## 摘要

修复全面审查中发现的 3 个关键问题和 5 个改进建议，涉及 5 个文件。

---

## 当前状态分析

审查覆盖了项目中所有 16 个 Vue 组件、5 个 composable、4 个类型文件、2 个中间件和 2 个插件。构建验证已通过（零错误），以下问题是质量加固而非功能缺陷。

---

## 修改清单

### 1. [add-problem.vue](file:///d:/TestPaper/TestPapers/app/pages/add-problem.vue) — setTimeout 未在卸载时清理

**问题**：`submitProblem()` 中 `setTimeout(() => { submitted.value = false }, 4000)` 没有在组件卸载时清理。若用户在 4 秒内导航离开，回调会在已卸载组件上修改状态。

**修改内容**：
- 新增 `import { onUnmounted }` 
- 新增 `const successTimer = ref<ReturnType<typeof setTimeout>>()`
- 将 `setTimeout` 返回值存入 `successTimer.value`
- 在 `onUnmounted` 中 `clearTimeout(successTimer.value)`
- 在 `resetForm()` 中同时清理 `successTimer`

**影响行**：`<script setup>` 约第 197-358 行

---

### 2. [useAuth.ts](file:///d:/TestPaper/TestPapers/app/composables/useAuth.ts) — `hasPermission` 隐晦空值处理

**问题**：`user.value?.permissions.includes(permission)` — 若 `permissions` 为 `undefined`，可选链短路返回 `undefined`，`Boolean(undefined)` = `false`。行为正确但隐晦。

**修改内容**：
- 将 `return Boolean(user.value?.permissions.includes(permission))` 改为 `return user.value?.permissions?.includes(permission) ?? false`

**影响行**：第 19 行

---

### 3. [useApi.ts](file:///d:/TestPaper/TestPapers/app/composables/useApi.ts) — `syncAuthSession` 不设置 `isAuthReady`

**问题**：`syncAuthSession()`（模块级函数，第 50-55 行）更新了 `user` 和 `expiresAt` 但未设置 `isAuthReady = true`。与 `useAuth.applySession()` 行为不一致。

**修改内容**：
- 在 `syncAuthSession()` 中添加 `isAuthReady` 状态设置：
  ```typescript
  const isAuthReady = useState<boolean>('auth-ready', () => false)
  // ...在设置 user 和 expiresAt 之后:
  isAuthReady.value = true
  ```

**影响行**：第 50-55 行

---

### 4. [useAuth.ts](file:///d:/TestPaper/TestPapers/app/composables/useAuth.ts) — `refreshTimer` 回调需增加认证状态守卫

**问题**：模块级 `refreshTimer` 的回调在定时器触发时无条件调用 `refreshSession()`。若用户在定时器触发前已登出，`refreshSession()` 仍然会尝试刷新（虽然底层会因 401 失败，但属于不必要的请求）。

**修改内容**：
- 在 `scheduleRefresh()` 的 `setTimeout` 回调中增加 `isAuthenticated` 守卫：
  ```typescript
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    if (isAuthenticated.value) void refreshSession()
  }, delay)
  ```
- 注：`refreshTimer` 作为模块级变量是设计意图——它是整个应用的单例定时器，不应随组件生命周期销毁。此处仅加固回调逻辑。

**影响行**：第 30-34 行（`scheduleRefresh` 函数体内）

---

### 5. [useRealtime.ts](file:///d:/TestPaper/TestPapers/app/composables/useRealtime.ts) — `handlers` Map 在断开时未清理

**问题**：模块级 `handlers` Map（第 10 行）存储事件监听器。`on()` 返回取消订阅函数，但若调用方忘记调用，监听器将永久驻留。断开连接后旧监听器仍保留，重连后会收到重复回调。

**修改内容**：
- 在 `disconnect()` 函数中清空 `handlers`：
  ```typescript
  handlers.clear()
  ```
- 注：插件 `auth-session.client.ts` 在每次应用启动时注册 3 个 `question.*` 事件监听器。`disconnect()` 由 `watch(auth.isAuthenticated, ...)` 在登出时触发，清空 handlers 可确保登出后不残留旧监听器。重新认证时插件会重新注册。

**影响行**：第 36-48 行（`disconnect` 函数内）

---

### 6. [useQuestionBank.ts](file:///d:/TestPaper/TestPapers/app/composables/useQuestionBank.ts) — `loadMyQuestions` 缺少并发防护

**问题**：`loadQuestions` 有 `if (isLoading.value) return` 防护，但 `loadMyQuestions` 没有。快速连续调用会发起多个并发请求。

**修改内容**：
- 在 `loadMyQuestions` 函数开头添加：
  ```typescript
  if (isLoadingMine.value) return
  ```

**影响行**：第 69 行（`loadMyQuestions` 函数体开头）

---

### 7. [useQuestionBank.ts](file:///d:/TestPaper/TestPapers/app/composables/useQuestionBank.ts) — `addQuestion`/`updateQuestion`/`deleteQuestion` 无错误状态

**问题**：三个写操作直接 `throw` 异常，没有 composable 层面的 loading/error 状态。调用方（如 `add-problem.vue`）虽有 `try/catch`，但若未来有组件直接调用且未捕获，将导致未处理的 Promise rejection。

**修改内容**：
- 新增 `const saveError = useState<string>('question-bank-save-error', () => '')`
- 新增 `const isSaving = useState<boolean>('question-bank-saving', () => false)`
- 在 `addQuestion`、`updateQuestion`、`deleteQuestion` 中添加 `try/catch/finally`：
  - `try` 前：设置 `isSaving = true`，清空 `saveError`
  - `catch`：设置 `saveError = error.message`，重新 `throw`
  - `finally`：设置 `isSaving = false`
- 在返回值对象中暴露 `saveError` 和 `isSaving`

**影响行**：第 28-39 行（状态声明区）、第 95-125 行（三个函数体）、第 175-196 行（返回值对象）

---

### 8. [useQuestionBank.ts](file:///d:/TestPaper/TestPapers/app/composables/useQuestionBank.ts) — `loadQuestions` 和 `loadMyQuestions` 共享 error 状态

**问题**：两个加载函数共享同一个 `error` 状态（第 32 行），错误信息会互相覆盖。

**修改内容**：
- 将 `error` 重命名为 `loadError`（state key 从 `'question-bank-error'` 改为 `'question-bank-load-error'`）
- 新增 `const myLoadError = useState<string>('my-question-bank-load-error', () => '')`
- `loadQuestions` 的 catch 块使用 `loadError`
- `loadMyQuestions` 的 catch 块使用 `myLoadError`
- 返回值对象中暴露 `loadError` 和 `myLoadError`
- 更新 [QuestionWorkspace.vue](file:///d:/TestPaper/TestPapers/app/components/QuestionWorkspace.vue) 第 504 行的解构：`error: questionError` → `loadError: questionError`（添加额外导入如果需要 `myLoadError`）

**影响行**：
- `useQuestionBank.ts`：第 32 行（状态声明）、第 62/88 行（catch 块）、第 188 行（返回值）
- `QuestionWorkspace.vue`：第 504 行（解构重命名）

---

## 影响范围汇总

| 文件 | 改动类型 | 风险 |
|------|----------|------|
| `app/pages/add-problem.vue` | 新增 ref + onUnmounted | 低 |
| `app/composables/useAuth.ts` | 函数体微调（2 处） | 低 |
| `app/composables/useApi.ts` | 函数体内新增 3 行 | 低 |
| `app/composables/useRealtime.ts` | 函数体内新增 1 行 | 低（handler 在 auth-session 插件中会被重新注册） |
| `app/composables/useQuestionBank.ts` | 新增 2 个状态 + 并发防护 + try/catch + 拆分 error | 中（返回值接口有变化，需同步更新消费者） |
| `app/components/QuestionWorkspace.vue` | 解构变量重命名 | 低 |

## 假设与决策

1. **refreshTimer 保留模块级设计**：它是应用级单例，不随组件生命周期销毁。仅加固回调中的认证守卫。
2. **handlers.clear() 安全**：插件 `auth-session.client.ts` 在每次应用启动时注册事件监听器。登出时清空 handlers，重新认证时插件会重新注册。
3. **saveError 使用独立的 useState key**：不与其他 loading 状态共享，调用方可按需读取。
4. **返回值接口兼容**：原先的 `error` 改为 `loadError`，`QuestionWorkspace.vue` 需同步更新解构变量名。

## 验证步骤

1. 运行 `node scripts/run-nuxi.mjs build` 确保无编译错误
2. 检查 TypeScript 类型：新暴露的 `saveError`/`isSaving`/`myLoadError` 需在返回值对象中正确声明
3. 检查 `QuestionWorkspace.vue` 解构：变更 `error` → `loadError` 后模板中的 `questionError` 仍应正常工作
