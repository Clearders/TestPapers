# TestPapers

一个用于创建和管理试卷的 Web 前端，基于 **Nuxt 4.3.0** 构建，使用 **KaTeX** 实现实时 LaTeX 渲染。

后端项目地址：<https://github.com/Clearders/TestPaper-backend>

## 项目结构

```
TestPapers/
├── app/
│   ├── app.vue                          # 应用根组件
│   ├── components/
│   │   ├── LatexRenderer.vue            # 通用 LaTeX 渲染组件
│   │   ├── QuestionWorkspace.vue        # 题库工作台（搜索、筛选、组卷核心）
│   │   └── questions/
│   │       ├── AddProblemPreview.vue     # 添加试题时的实时预览
│   │       ├── PaginationControls.vue    # 分页控件
│   │       ├── QuestionBankCard.vue      # 题库卡片展示
│   │       ├── QuestionBankToolbar.vue   # 题库搜索筛选工具栏
│   │       └── QuestionImageUploader.vue # 试题图片上传组件
│   ├── composables/
│   │   ├── useApi.ts                    # API 请求封装（Cookie 认证、自动刷新）
│   │   ├── useAuth.ts                   # 认证状态管理（登录/注册/登出/会话）
│   │   ├── useLatexParts.ts             # LaTeX 片段解析工具
│   │   ├── useQuestionBank.ts           # 题库 CRUD 操作封装
│   │   └── useRealtime.ts               # WebSocket 实时通信
│   ├── layouts/
│   │   └── default.vue                  # 默认布局（导航栏、用户信息）
│   ├── middleware/
│   │   ├── 00.locale-compat.global.ts   # 语言兼容中间件（全局）
│   │   └── auth.global.ts              # 认证守卫中间件（全局）
│   ├── pages/
│   │   ├── index.vue                    # 首页 — 功能概览与快捷入口
│   │   ├── login.vue                    # 登录页面
│   │   ├── register.vue                 # 注册页面
│   │   ├── questions.vue                # 题库工作台（搜索/筛选/组卷）
│   │   ├── add-problem.vue              # 添加试题（带实时 LaTeX 预览）
│   │   ├── latex.vue                    # LaTeX 公式预览沙盒
│   │   └── users.vue                    # 用户管理（仅管理员）
│   ├── plugins/
│   │   ├── auth-session.client.ts       # 客户端会话恢复插件
│   │   └── locale-compat.client.ts      # 客户端语言兼容插件
│   └── types/
│       ├── api.ts                       # API 响应类型定义
│       ├── auth.ts                      # 认证相关类型
│       ├── question.ts                  # 试题相关类型
│       └── route-meta.d.ts             # 路由元信息类型扩展
├── server/
│   └── middleware/
│       └── locale-compat.ts            # 服务端语言兼容中间件
├── shared/
│   └── legacy-locale.ts                # 旧版语言兼容工具
├── docs/
│   └── api-spec.md                     # API 接口文档
├── scripts/
│   └── run-nuxi.mjs                    # Nuxt CLI 运行脚本
├── nuxt.config.ts                      # Nuxt 配置文件
├── package.json                        # 项目依赖与脚本
├── tsconfig.json                       # TypeScript 配置
└── LICENSE                             # MIT 许可证
```

## 功能

- 📝 **首页** — 功能概览，含交互式实时 LaTeX 演示入口
- 🔍 **题库工作台** — 按学科、难度、题型、标签等进行搜索与筛选；行内与块级 LaTeX 渲染；可切换显示/隐藏答案；支持分页浏览
- 📄 **组卷** — 在工作台中从题库选题、调整顺序、设置试卷元数据，支持遗传算法自动组卷，支持导出预览
- ➕ **添加试题** — 支持选择题、判断题、填空题、简答题、解答题五种题型；带侧边实时 LaTeX 预览；支持上传配图
- 📊 **LaTeX 沙盒** — 独立的 LaTeX 公式实时预览页面，方便测试公式语法
- 👥 **用户管理** — 管理员可创建、编辑角色、启用/禁用、删除用户
- 🔐 **认证系统** — 支持登录/注册/登出；HttpOnly Cookie 会话管理；基于角色的权限控制
- 🔄 **实时更新** — WebSocket 连接，试题和试卷变更实时推送

## 技术栈

| 工具 | 版本 | 用途 |
|------|---------|------|
| [Nuxt](https://nuxt.com) | 4.3.0 | 全栈 Vue 框架（SSR + SPA） |
| [Vue](https://vuejs.org) | 3.5.x | 前端 UI 框架 |
| [KaTeX](https://katex.org) | 0.16.x | 数学公式实时渲染 |
| TypeScript | 5.x | 类型安全 |

## 权限系统

系统定义三种角色，每种角色拥有不同操作权限：

| 角色 | 查看试题 | 编辑试题 | 删除试题 | 查看答案 | 查看试卷 | 编辑试卷 | 管理用户 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **admin** (管理员) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **teacher** (教师) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **viewer** (观察者) | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |

默认后端账户：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 管理员 — 完全权限，可管理用户 |
| `teacher` | `teacher123` | 教师 — 可创建、编辑、删除题目和试卷 |
| `viewer` | `viewer123` | 观察者 — 只读权限，无法查看答案 |

## 页面说明

| 页面 | 路由 | 认证要求 | 权限要求 | 功能描述 |
|------|------|:---:|------|------|
| 首页 | `/` | 否 | — | 功能概览，快捷入口 |
| 登录 | `/login` | 否 | — | 用户登录 |
| 注册 | `/register` | 否 | — | 教师账户自助注册 |
| 题库工作台 | `/questions` | 是 | `questions:read` | 搜索、筛选、浏览题库，组卷操作 |
| 添加试题 | `/add-problem` | 是 | `questions:write` | 创建新试题，支持 LaTeX 预览和图片上传 |
| LaTeX 沙盒 | `/latex` | 否 | — | LaTeX 公式实时预览测试 |
| 用户管理 | `/users` | 是 | `users:manage` | 管理员进行用户 CRUD 操作 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器 (默认 http://localhost:3000)
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|------|------|
| `NUXT_PUBLIC_API_BASE` | `http://127.0.0.1:8010/api/v1` | 后端 API 基础路径 |
| `NUXT_PUBLIC_WS_BASE` | (空) | WebSocket 连接地址 |

在项目根目录创建 `.env` 文件进行配置：

```bash
NUXT_PUBLIC_API_BASE=http://127.0.0.1:8010/api/v1
```

## LaTeX 支持

在题目和答案文本中使用标准 LaTeX 分隔符：

- **行内公式**：`$...$` — 例如 `$x^2 + y^2 = r^2$`
- **块级公式**：`$$...$$` — 例如 `$$\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}$$`

KaTeX 在客户端实时渲染所有表达式。`hasLatex` 字段由后端自动检测并标记。

## 遗传算法自动组卷

工作台可通过 `POST /api/v1/papers/generate` 从题库中自动生成试卷。生成器会对学科、题目数量、难度分布、必选标签覆盖和题型组合进行优化，然后分配整数分值使总和等于要求的总分。

推荐的标准参数：

| 场景 | 种群规模 | 迭代代数 | 交叉率 | 变异率 | 精英保留数 | 锦标赛规模 |
|------|---:|---:|---:|---:|---:|---:|
| 快速预览 | 50 | 60 | 0.80 | 0.10 | 2 | 3 |
| 标准使用 | 80 | 120 | 0.85 | 0.08 | 4 | 3 |
| 高质量/严格约束 | 150 | 250 | 0.90 | 0.05 | 6 | 4 |
| 大题库 | 200 | 300 | 0.85 | 0.06 | 8 | 5 |

默认试卷平衡建议：

| 参数 | 推荐值 |
|------|------|
| 难度分布 | 30% 简单，50% 中等，20% 困难 |
| 题目数量 | 普通课堂测验 10–30 题 |
| 候选池规模 | 至少为请求题目数的 3 倍 |
| 必选标签 | 除非题库很大，控制在 1–3 个标签 |
| 随机种子 | 仅在需要可复现生成时设置 |

## 认证流程

1. 用户通过登录页面提交用户名和密码
2. 后端验证凭据后，设置 HttpOnly `testpapers_session` Cookie
3. 前端不再在 JavaScript 中保存令牌，所有请求自动携带 Cookie
4. 页面刷新时，前端调用 `GET /api/v1/auth/me` 恢复会话
5. 令牌即将过期时自动调用 `POST /api/v1/auth/refresh` 刷新
6. 登出时清除服务端会话和 Cookie

## API 文档

完整的 API 接口文档请参阅 [docs/api-spec.md](docs/api-spec.md)。

## 许可证

[MIT](LICENSE)
