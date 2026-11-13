/**
 * server/devApi.ts
 * Dev-only Vite plugin: serves api/summon.ts, api/run.ts and api/narrate.ts
 * under `npm run dev`, so a séance works locally without `vercel dev`.
 * Reads .env into process.env on the dev server only (never the client bundle).
 * Not used by `vite build`; production runs the real Vercel Functions.
 */
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

const ROUTE = /^\/api\/(summon|run|narrate)(?:\?.*)?$/

export function devApi(): Plugin {
  return {
    name: 'seance-dev-api',
    apply: 'serve',

    configResolved(config) {
      // Vitest also loads vite.config in serve mode: keep real .env values and
      // the dev log out of the test process
      if (process.env['VITEST']) return
      Object.assign(process.env, loadEnv(config.mode, config.root, ''))
      // dev-only: record Groq's failed_generation on json_validate_failed (server/llm/devLog.ts)
      process.env['SEANCE_DEV_LOG'] ??= '1'
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = ROUTE.exec(req.url ?? '')
        if (!match) return next()

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const raw = Buffer.concat(chunks).toString('utf8')
        let body: unknown
        try { body = raw ? JSON.parse(raw) : undefined } catch { body = undefined }

        // Minimal VercelRequest / VercelResponse shape the handlers use
        const vreq = Object.assign(req, { body, query: {} })
        const vres = Object.assign(res, {
          status(code: number) { res.statusCode = code; return vres },
          json(data: unknown) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
            return vres
          },
        })

        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`)
          await mod.default(vreq, vres)
        } catch (err) {
          server.ssrFixStacktrace(err as Error)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: (err as Error).message }))
          }
        }
      })
    },
  }
}
