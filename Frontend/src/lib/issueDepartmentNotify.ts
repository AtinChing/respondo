import type { Department, Issue } from '../types'

const PY_API_BASE =
  import.meta.env.VITE_VIDEO_API_URL?.replace(/\/$/, '') ?? '/api/py'

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Match Settings department name to routing label (e.g. analysis "Fire Department" vs configured "Fire"). */
export function findDepartmentForRouting(
  departments: Department[],
  routingLabel: string,
): Department | null {
  const r = normalizeLabel(routingLabel)
  if (!r) return null

  for (const d of departments) {
    const n = normalizeLabel(d.name)
    if (n && n === r) return d
  }
  for (const d of departments) {
    const n = normalizeLabel(d.name)
    if (n.length < 3) continue
    if (r.includes(n) || n.includes(r)) return d
  }
  return null
}

export function routingDepartmentForIssue(issue: Issue): string {
  const fromIssue = issue.department?.trim()
  if (fromIssue) return fromIssue
  return issue.security_manual_dock.contact_department?.trim() ?? ''
}

function normalizeE164(phone: string): string | null {
  const n = phone.replace(/\s+/g, '').trim()
  if (!n.startsWith('+')) return null
  if (n.length < 8) return null
  return n
}

function buildNotifyTask(issue: Issue, departmentName: string): string {
  const title = issue.title.trim() || 'Untitled incident'
  return [
    'You are placing an urgent operational notification call from the Respondo security system. ',
    'Greet the person briefly and professionally. Say that a new incident was logged on the Issue dashboard ',
    `and the current security-manual route names "${departmentName}" as the contact department. `,
    `Give the incident title: "${title}". Ask them to open the Issue dashboard in Respondo now and review the case. `,
    'If they cannot talk, offer to leave it at that and end politely. Keep the call concise.',
  ].join('')
}

export type DepartmentNotifyResult = {
  skippedReason?: string
  calledNumbers: string[]
  errors: string[]
}

export async function notifyDepartmentMembersForIssue(
  issue: Issue,
  departments: Department[],
): Promise<DepartmentNotifyResult> {
  const errors: string[] = []
  const calledNumbers: string[] = []

  const label = routingDepartmentForIssue(issue)
  if (!label) {
    return {
      skippedReason: 'No routing department on this issue; outbound call skipped.',
      calledNumbers,
      errors,
    }
  }

  const dept = findDepartmentForRouting(departments, label)
  if (!dept) {
    return {
      skippedReason: `No Settings department matches "${label}". Add a department with that name (or a close match) under Settings, then try the outbound calls page if needed.`,
      calledNumbers,
      errors,
    }
  }

  if (dept.members.length === 0) {
    return {
      skippedReason: `Department "${dept.name}" has no members with phone numbers configured.`,
      calledNumbers,
      errors,
    }
  }

  const task = buildNotifyTask(issue, dept.name)

  for (const member of dept.members) {
    const dest = normalizeE164(member.phone)
    if (!dest) {
      errors.push(`Invalid E.164 number for ${member.email || 'member'} (use +country…, no spaces required but + is required).`)
      continue
    }

    try {
      const res = await fetch(`${PY_API_BASE}/api/bland/outbound-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: dest, task }),
      })
      let data: Record<string, unknown> & { detail?: unknown }
      try {
        data = (await res.json()) as typeof data
      } catch {
        errors.push(`${dest}: bad response (${res.status})`)
        continue
      }
      if (!res.ok) {
        const detail =
          typeof data.detail === 'string'
            ? data.detail
            : JSON.stringify(data.detail ?? data)
        errors.push(`${dest}: ${detail}`)
        continue
      }
      calledNumbers.push(dest)
    } catch (e) {
      errors.push(
        `${dest}: ${e instanceof Error ? e.message : 'Network error'}`,
      )
    }
  }

  if (calledNumbers.length === 0 && errors.length > 0) {
    return { calledNumbers, errors }
  }

  return { calledNumbers, errors }
}
