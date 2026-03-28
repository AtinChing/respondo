import { useState } from 'react'
import { useDepartments } from '../hooks/useDepartments'

export function SettingsPage() {
  const {
    departments,
    addDepartment,
    removeDepartment,
    addMember,
    removeMember,
  } = useDepartments()

  const [deptName, setDeptName] = useState('')
  const [memberForms, setMemberForms] = useState<
    Record<string, { phone: string; email: string }>
  >({})

  const setMemberField = (
    departmentId: string,
    field: 'phone' | 'email',
    value: string,
  ) => {
    setMemberForms((prev) => ({
      ...prev,
      [departmentId]: {
        phone: prev[departmentId]?.phone ?? '',
        email: prev[departmentId]?.email ?? '',
        [field]: value,
      },
    }))
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Administrator settings</h1>
        <p className="page-lead">
          Departments and members are stored in your browser (localStorage)
          until the Notion backend is connected.
        </p>
      </div>

      <section className="settings-panel" aria-labelledby="dept-heading">
        <h2 id="dept-heading" className="settings-panel-title">
          Departments
        </h2>
        <form
          className="settings-inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            addDepartment(deptName)
            setDeptName('')
          }}
        >
          <label className="sr-only" htmlFor="new-dept">
            New department name
          </label>
          <input
            id="new-dept"
            className="input"
            placeholder="Department name"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            Add department
          </button>
        </form>

        <ul className="dept-list">
          {departments.map((dept) => (
            <li key={dept.id} className="dept-card">
              <div className="dept-card-head">
                <h3 className="dept-name">{dept.name}</h3>
                <button
                  type="button"
                  className="btn btn--ghost btn--danger"
                  onClick={() => removeDepartment(dept.id)}
                >
                  Remove department
                </button>
              </div>

              <div className="members-block">
                <h4 className="members-heading">Members</h4>
                {dept.members.length === 0 ? (
                  <p className="members-empty">No members yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Phone</th>
                          <th scope="col">Email</th>
                          <th scope="col">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dept.members.map((m) => (
                          <tr key={m.id}>
                            <td>{m.phone}</td>
                            <td>{m.email}</td>
                            <td className="data-table-actions">
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => removeMember(dept.id, m.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <form
                  className="member-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const f = memberForms[dept.id] ?? {
                      phone: '',
                      email: '',
                    }
                    addMember(dept.id, f)
                    setMemberForms((prev) => ({
                      ...prev,
                      [dept.id]: { phone: '', email: '' },
                    }))
                  }}
                >
                  <label className="sr-only" htmlFor={`phone-${dept.id}`}>
                    Phone for {dept.name}
                  </label>
                  <input
                    id={`phone-${dept.id}`}
                    className="input"
                    placeholder="Phone"
                    value={memberForms[dept.id]?.phone ?? ''}
                    onChange={(e) =>
                      setMemberField(dept.id, 'phone', e.target.value)
                    }
                  />
                  <label className="sr-only" htmlFor={`email-${dept.id}`}>
                    Email for {dept.name}
                  </label>
                  <input
                    id={`email-${dept.id}`}
                    className="input"
                    type="email"
                    placeholder="Email"
                    value={memberForms[dept.id]?.email ?? ''}
                    onChange={(e) =>
                      setMemberField(dept.id, 'email', e.target.value)
                    }
                  />
                  <button type="submit" className="btn btn--secondary">
                    Add member
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
