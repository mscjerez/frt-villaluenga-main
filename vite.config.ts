import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Version and commit shown in the admin panel. CI provides GITHUB_SHA; locally it comes from git. */
function buildInfo() {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  let commit = process.env.GITHUB_SHA?.slice(0, 7) ?? ''
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      /* not a git checkout */
    }
  }
  return { version, commit, builtAt: new Date().toISOString() }
}

// Content-Security-Policy injected only in production builds (the dev server needs inline scripts for HMR).
// Prefer sending it as an HTTP header from the web server as well; see docs/SECURITY.md.
function csp(apiUrl: string): Plugin {
  // Only a cross-origin API needs its own connect-src entry; the default /api/v1 is covered by 'self'.
  const apiOrigin = /^https?:\/\//.test(apiUrl) ? new URL(apiUrl).origin : ''
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ['connect-src', "'self'", apiOrigin, 'https://challenges.cloudflare.com'].filter(Boolean).join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // GitHub Pages serves project sites under /<repo>/; the deploy workflow sets BASE_PATH.
    base: env.BASE_PATH || '/',
    define: { __BUILD_INFO__: JSON.stringify(buildInfo()) },
    plugins: [react(), tailwindcss(), csp(env.VITE_API_URL ?? '')],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      // With a local backend (VITE_API_MOCK=false), /api/v1 is forwarded to it so the browser stays same-origin
      // like in production (https://rinconscout.mscjerez.es/api/v1).
      proxy: env.API_PROXY_TARGET ? { '/api': { target: env.API_PROXY_TARGET, changeOrigin: true } } : undefined,
    },
  }
})
