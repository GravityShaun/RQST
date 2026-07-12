// Standalone Nuxt eslint config (no @nuxt/eslint module) so `eslint .`
// works right after `pnpm install`, without a `nuxt prepare` codegen step.
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: { typescript: true },
}).append({
  ignores: ['src-tauri/**'],
})
