# TestPapers

A web frontend for creating and managing test papers, built with **Nuxt 4.3.0** and powered by **KaTeX** for real-time LaTeX rendering.

## Features

- 📝 **Home page** — Feature overview with an interactive live LaTeX demo
- 🔍 **Question Bank** — Browse, search, and filter questions by subject and difficulty; inline and block LaTeX rendering; toggle answers
- 📄 **Assemble Test Paper** — Two-panel builder: pick questions from the bank, reorder them, set paper metadata, and export a preview
- ➕ **Add Problem** — Form with a side-by-side live LaTeX preview as you type, plus a LaTeX quick-reference cheat sheet

## Tech Stack

| Tool | Version |
|------|---------|
| [Nuxt](https://nuxt.com) | 4.3.0 |
| [Vue](https://vuejs.org) | 3.x |
| [KaTeX](https://katex.org) | 0.16.x |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## LaTeX Support

Use standard LaTeX delimiters in question and answer text:

- **Inline**: `$...$` — e.g. `$x^2 + y^2 = r^2$`
- **Block**: `$$...$$` — e.g. `$$\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}$$`

KaTeX renders all expressions client-side in real time.

## License

[MIT](LICENSE)
