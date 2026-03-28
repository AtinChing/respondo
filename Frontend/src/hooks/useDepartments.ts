import { useCallback, useEffect, useState } from 'react'
import type { Department, Member } from '../types'

const STORAGE_KEY = 'respondo-departments'

const defaultDepartments: Department[] = [
  {
    id: crypto.randomUUID(),
    name: 'Operations',
    members: [
      {
        id: crypto.randomUUID(),
        phone: '+1 555 0100',
        email: 'ops@example.com',
      },
    ],
  },
]

function load(): Department[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultDepartments
    const parsed = JSON.parse(raw) as Department[]
    if (!Array.isArray(parsed)) return defaultDepartments
    return parsed
  } catch {
    return defaultDepartments
  }
}

function persist(departments: Department[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(departments))
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>(() => load())

  useEffect(() => {
    persist(departments)
  }, [departments])

  const addDepartment = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setDepartments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, members: [] },
    ])
  }, [])

  const removeDepartment = useCallback((id: string) => {
    setDepartments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const addMember = useCallback((departmentId: string, member: Omit<Member, 'id'>) => {
    const phone = member.phone.trim()
    const email = member.email.trim()
    if (!phone || !email) return
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === departmentId
          ? {
              ...d,
              members: [
                ...d.members,
                { id: crypto.randomUUID(), phone, email },
              ],
            }
          : d,
      ),
    )
  }, [])

  const removeMember = useCallback((departmentId: string, memberId: string) => {
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === departmentId
          ? { ...d, members: d.members.filter((m) => m.id !== memberId) }
          : d,
      ),
    )
  }, [])

  return {
    departments,
    addDepartment,
    removeDepartment,
    addMember,
    removeMember,
  }
}
