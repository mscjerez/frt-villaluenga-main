import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Content-Security-Policy injected only in production builds (the dev server needs inline scripts for HMR).
// Prefer sending it as an HTTP header from the web server as well; see docs/SECURITY.md.
function csp(apiUrl: string): Plugin {
  const apiOrigin = apiUrl ? new URL(apiUrl).origin : ''
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} https://challenges.cloudflare.com`.trim(),
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
    plugins: [react(), tailwindcss(), csp(env.VITE_API_URL ?? '')],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173 },
  }
})
