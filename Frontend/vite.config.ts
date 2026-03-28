import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
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

type SecurityManualDockPayload = {
  section_trail?: string[]
  snippet?: string
  contact_department?: string
}

/** Payload from the client: full Issue JSON (id) plus legacy issueId if ever sent. */
type IssueContextPayload = {
  id?: string
  issueId?: string
  title?: string
  date?: string
  time?: string
  description?: string
  status?: string
  reason_flagged?: string
  security_manual_dock?: SecurityManualDockPayload
}

const ISSUE_CONTEXT_KNOWN_KEYS = new Set([
  'id',
  'issueId',
  'title',
  'date',
  'time',
  'description',
  'status',
  'reason_flagged',
  'security_manual_dock',
])

function formatExtraIssueFields(ctx: Record<string, unknown>): string | null {
  const extras = Object.entries(ctx).filter(([k]) => !ISSUE_CONTEXT_KNOWN_KEYS.has(k))
  if (extras.length === 0) return null
  const lines = extras.map(([k, v]) => {
    if (v === undefined) return `${k}: (undefined)`
    if (v === null) return `${k}: null`
    if (typeof v === 'object') return `${k}:\n${JSON.stringify(v, null, 2)}`
    return `${k}: ${String(v)}`
  })
  return ['## Additional fields on this incident record', ...lines].join('\n')
}

const STATUS_LABEL: Record<string, string> = {
  unresolved: 'Unresolved',
  resolved: 'Resolved',
  incorrectly_classified: 'Incorrectly classified',
}

function formatSecurityManualSection(dock: SecurityManualDockPayload | undefined): string {
  const trail = (dock?.section_trail ?? []).filter((s) => typeof s === 'string' && s.trim())
  const snippet = typeof dock?.snippet === 'string' ? dock.snippet.trim() : ''
  const dept =
    typeof dock?.contact_department === 'string' ? dock.contact_department.trim() : ''

  const hasChunk = trail.length > 0 || snippet.length > 0 || dept.length > 0

  const lines: string[] = ['## Security manual (vector-retrieved chunk)']
  if (!hasChunk) {
    lines.push(
      'No security manual excerpt is on file for this issue. Staff may need to run retrieval against the manual index.',
    )
    return lines.join('\n')
  }

  lines.push(`Contact / routing department: ${dept || '—'}`)
  lines.push('Section trail (coarse → fine):')
  if (trail.length === 0) {
    lines.push('  (none)')
  } else {
    for (let i = 0; i < trail.length; i++) lines.push(`  ${i + 1}. ${trail[i]}`)
  }
  lines.push('Snippet (verbatim from retrieval):')
  lines.push(snippet || '—')
  return lines.join('\n')
}

/** Full incident context for the model system message. */
function buildIncidentSystemBlock(
  ctx: IssueContextPayload & Record<string, unknown>,
  serverNowIso: string,
): string {
  const id = ctx.id ?? ctx.issueId ?? '—'
  const title = ctx.title?.trim() || '—'
  const date = ctx.date?.trim() || '—'
  const time = ctx.time?.trim() || '—'
  const statusRaw = ctx.status?.trim() || '—'
  const statusLabel = STATUS_LABEL[statusRaw] ?? statusRaw
  const description = ctx.description?.trim() || '—'
  const reasonFlagged = ctx.reason_flagged?.trim() || '—'

  const extraBlock = formatExtraIssueFields(ctx)

  const parts = [
    '## Staff chat session',
    `Time when this request was handled (ISO 8601, UTC): ${serverNowIso}`,
    '',
    '## Incident record (use as ground truth)',
    'Answer questions using the incident below. If a detail is not present, say you do not have it; do not invent ticket IDs, URLs, or system state.',
    '',
    `Incident ID: ${id}`,
    `Title: ${title}`,
    `Classification status (workflow): ${statusLabel} (${statusRaw})`,
    '',
    '## When the incident was recorded',
    `Date (as stored): ${date}`,
    `Time (as stored): ${time}`,
    '',
    '## Video / footage description (staff and model summary)',
    description,
    '',
    '## Why the automated agent flagged this',
    reasonFlagged,
    '',
    formatSecurityManualSection(ctx.security_manual_dock),
  ]

  if (extraBlock) {
    parts.push('', extraBlock)
  }

  return parts.join('\n')
}

/** Split incident markdown into multiple context strings for the report agent API. */
function issueContextToSegments(block: string): string[] {
  const t = block.trim()
  if (!t) return []
  const chunks = t
    .split(/(?=^## )/m)
    .map((s) => s.trim())
    .filter(Boolean)
  return chunks.length > 0 ? chunks : [t]
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
        | (IssueContextPayload & Record<string, unknown>)
        | undefined
      const forwardedSystem = body.system

      const serverNowIso = new Date().toISOString()
      const incidentBlock = issueContext
        ? buildIncidentSystemBlock(issueContext, serverNowIso)
        : ''

      const baseSystem =
        'You are the Respondo operations assistant. Help staff triage and document security and facilities incidents. Be concise, actionable, and professional. Do not claim to have updated systems or tickets unless the user is only asking for suggested wording.'

      const toolHint = incidentBlock
        ? [
            '',
            '## Tools',
            'You have `generateIssueReport`: it runs the **Report generation agent** (Railtracks + FastAPI) on the full incident context and returns Markdown.',
            'When the user asks for an issue report, incident report, formal write-up, or shareable summary document, you MUST call `generateIssueReport` (no arguments).',
            'After the tool succeeds, confirm briefly and tell them the full Markdown is available on the **Assets** page in this app.',
          ].join('\n')
        : ''

      const system =
        typeof forwardedSystem === 'string' && forwardedSystem.trim().length > 0
          ? `${forwardedSystem}\n\n${incidentBlock}${toolHint}`.trim()
          : incidentBlock
            ? `${baseSystem}\n\n${incidentBlock}${toolHint}`.trim()
            : baseSystem

      const openaiProvider = createOpenAI({ apiKey })

      const pyBase = (env.RESPONDO_PY_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

      const tools =
        incidentBlock.trim().length > 0
          ? {
              generateIssueReport: tool({
                description:
                  'Run the Report generation agent: produces a formal Markdown incident report from all known context for this issue. Use when the user wants an issue report or shareable write-up.',
                title: 'Report generation agent',
                inputSchema: z.object({}),
                execute: async () => {
                  const segments = issueContextToSegments(incidentBlock)
                  const res = await fetch(`${pyBase}/api/generate-issue-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ issue_context_segments: segments }),
                  })
                  const rawText = await res.text()
                  if (!res.ok) {
                    throw new Error(rawText || `Report API HTTP ${res.status}`)
                  }
                  let data: { report_id?: string; report_markdown?: string }
                  try {
                    data = JSON.parse(rawText) as { report_id?: string; report_markdown?: string }
                  } catch {
                    throw new Error('Report API returned non-JSON')
                  }
                  const reportId = data.report_id
                  const reportMarkdown = data.report_markdown
                  if (!reportId || reportMarkdown === undefined) {
                    throw new Error('Report API response missing report_id or report_markdown')
                  }
                  const issueId = String(issueContext?.id ?? issueContext?.issueId ?? '')
                  return {
                    reportId,
                    reportMarkdown,
                    issueId,
                    agentName: 'Report generation agent',
                  }
                },
              }),
            }
          : undefined

      try {
        const modelMessages = await convertToModelMessages(messages)
        const result = streamText({
          model: openaiProvider('gpt-4o-mini'),
          system,
          messages: modelMessages,
          tools,
          stopWhen: tools ? stepCountIs(12) : stepCountIs(1),
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
