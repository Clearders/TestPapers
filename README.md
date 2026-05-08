# TestPapers

一个用于创建和管理试卷的 Web 前端，基于 **Nuxt 4.3.0** 构建，使用 **KaTeX** 实现实时 LaTeX 渲染。

## 功能

- 📝 **首页** — 功能概览，包含交互式实时 LaTeX 演示
- 🔍 **题库** — 按学科和难度浏览、搜索、筛选题目；行内与块级 LaTeX 渲染；可切换显示/隐藏答案
- 📄 **组卷** — 双面板构建器：从题库中选题、调整顺序、设置试卷元数据，并导出预览
- ➕ **添加题目** — 带侧边实时 LaTeX 预览的表单，输入时即时渲染，附带 LaTeX 速查表

## 技术栈

| 工具 | 版本 |
|------|---------|
| [Nuxt](https://nuxt.com) | 4.3.0 |
| [Vue](https://vuejs.org) | 3.x |
| [KaTeX](https://katex.org) | 0.16.x |

## 权限系统

前端包含登录、教师账户自助注册、基于角色的导航、受保护的操作权限，以及管理员用户管理页面。

默认后端账户：

- `admin` / `admin123`：完全权限，可管理用户。
- `teacher` / `teacher123`：可创建、编辑、删除题目和试卷。
- `viewer` / `viewer123`：只读权限，无法查看答案。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器 (http://localhost:3000)
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

## LaTeX 支持

在题目和答案文本中使用标准 LaTeX 分隔符：

- **行内公式**：`$...$` — 例如 `$x^2 + y^2 = r^2$`
- **块级公式**：`$$...$$` — 例如 `$$\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}$$`

KaTeX 在客户端实时渲染所有表达式。

## 许可证

[MIT](LICENSE)
