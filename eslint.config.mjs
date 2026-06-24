// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // 项目中存在 index.vue、login.vue 等单单词页面组件名，属合理场景
    'vue/multi-word-component-names': 'off'
  }
})
