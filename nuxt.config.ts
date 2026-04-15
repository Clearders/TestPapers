// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['katex/dist/katex.min.css'],

  app: {
    head: {
      title: 'TestPapers',
      meta: [
        { name: 'description', content: 'A website for creating test papers with real-time LaTeX support.' }
      ]
    }
  }
})
