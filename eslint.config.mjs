// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Route files such as index.vue and login.vue intentionally use single-word names.
    'vue/multi-word-component-names': 'off'
  }
})
