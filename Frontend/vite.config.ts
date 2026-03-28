import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import {
  defineConfig,
  loadEnv,
  type Plugin,
  type PreviewServer,
  type ViteDevServer,
} from 'vite'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function attachChatApiMiddleware(server: ViteDevServer | PreviewServer, mode: string) {
  server.middlewares.use(
    async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const path = req.url?.split('?')[0] ?? ''
      if (path !== '/api/chat' || req.method !== 'POST') {
        next()
        return
      }

      const env = loadEnv(mode, process.cwd(), '')
      const apiKey = env.OPENAI_API_KEY
      if (!apiKey?.trim()) {
        res.statusCode = 503
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set in .env.local' }))
        return
      }

      let raw: string
      try {
        raw = await readBody(req)
      } catch {
        res.statusCode = 400
        res.end()
        return
      }

      let body: Record<string, unknown>
      try {
        body = JSON.parse(raw) as Record<string, unknown>
      } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
        return
      }

      const messages = (body.messages ?? []) as UIMessage[]
      const issueContext = body.issueContext as
        | {
            issueId?: string
            title?: string
            date?: string
            time?: string
            description?: string
            status?: string
            reason_flagged?: string
            security_manual_dock?: {
              section_trail?: string[]
              snippet?: string
              contact_department?: string
            }
          }
        | undefined
      const forwardedSystem = body.system

      const dock = issueContext?.security_manual_dock
      const dockLines =
        dock &&
        (dock.section_trail?.length ||
          dock.snippet ||
          dock.contact_department)
          ? [
              'Security manual (retrieved chunk):',
              `Contact department: ${dock.contact_department ?? '—'}`,
              `Section trail: ${(dock.section_trail ?? []).join(' → ') || '—'}`,
              `Snippet:\n${dock.snippet ?? '—'}`,
            ].join('\n')
          : ''

      const incidentBlock = issueContext
        ? [
            'Incident context:',
            `ID: ${issueContext.issueId ?? '—'}`,
            `Title: ${issueContext.title ?? '—'}`,
            `When: ${issueContext.date ?? '—'} ${issueContext.time ?? ''}`,
            `Status: ${issueContext.status ?? '—'}`,
            `Description: ${issueContext.description ?? '—'}`,
            `Reason flagged: ${issueContext.reason_flagged ?? '—'}`,
            dockLines,
          ]
            .filter(Boolean)
            .join('\n\n')
        : ''

      const baseSystem =
        'You are the Respondo operations assistant. Help staff triage and document security and facilities incidents. Be concise, actionable, and professional. Do not claim to have updated systems or tickets unless the user is only asking for suggested wording.'

      const system =
        typeof forwardedSystem === 'string' && forwardedSystem.trim().length > 0
          ? `${forwardedSystem}\n\n${incidentBlock}`.trim()
          : `${baseSystem}\n\n${incidentBlock}`.trim()

      const openaiProvider = createOpenAI({ apiKey })

      try {
        const modelMessages = await convertToModelMessages(messages)
        const result = streamText({
          model: openaiProvider('gpt-4o-mini'),
          system,
          messages: modelMessages,
        })
        const webResponse = result.toUIMessageStreamResponse()
        res.statusCode = webResponse.status
        webResponse.headers.forEach((value, key) => {
          res.setHeader(key, value)
        })
        const streamBody = webResponse.body
        if (!streamBody) {
          res.end()
          return
        }
        const reader = streamBody.getReader()
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) res.write(value)
          }
        } finally {
          reader.releaseLock()
        }
        res.end()
      } catch (err) {
        console.error('[api/chat]', err)
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Chat request failed' }))
        } else {
          res.end()
        }
      }
    },
  )
}

function chatApiPlugin(): Plugin {
  return {
    name: 'respondo-chat-api',
    configureServer(server) {
      attachChatApiMiddleware(server, server.config.mode)
    },
    configurePreviewServer(server) {
      attachChatApiMiddleware(server, server.config.mode)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), chatApiPlugin()],
  server: {
    proxy: {
      // FastAPI backend: run `uvicorn main:app --reload` from Backend/
      '/api/py': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/py/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api/py': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/py/, ''),
      },
    },
  },
})
