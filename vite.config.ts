import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { APP_VERSION } from './src/version.ts'

// Build details for the version stamp. A cosmetic label must never fail a build,
// so the git lookup falls back to 'dev'.
const commit = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
})()
const now = new Date()
const buildTime = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
// Unique per build, so every deploy counts as a new build for update detection
// (even one that didn't bump APP_VERSION).
const buildId = `${commit}-${now.getTime()}`

// Writes dist/version.json. Open pages fetch it to notice that a newer build
// has been deployed (see src/useAppUpdate.ts).
function versionFile(): Plugin {
  return {
    name: 'll2pp-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, build: buildId, commit, buildTime }),
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  base: '/LL2PP/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  // No proxy needed - the Anthropic SDK calls the API directly from the browser
})
