import type { ReactNode } from 'react'

export type AppPage = 'issues' | 'analysis' | 'phone-calls' | 'settings'

type AppShellProps = {
  active: AppPage
  onNavigate: (page: AppPage) => void
  children: ReactNode
}

const navItems: { id: AppPage; label: string; description: string }[] = [
  { id: 'issues', label: 'Issue dashboard', description: 'Incidents & review' },
  {
    id: 'analysis',
    label: 'Video analysis',
    description: 'Upload & classify footage',
  },
  {
    id: 'phone-calls',
    label: 'Outbound calls',
    description: 'List numbers & trigger dial',
  },
  {
    id: 'settings',
    label: 'Administrator settings',
    description: 'Departments & members',
  },
]

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <div className="shell-brand">
            <span className="shell-brand-mark" aria-hidden />
            <div>
              <span className="shell-brand-name">Respondo</span>
              <span className="shell-brand-sub">Operations console</span>
            </div>
          </div>
          <div className="shell-header-meta">
            <span className="shell-pill">Local preview</span>
          </div>
        </div>
      </header>

      <div className="shell-body">
        <nav className="shell-nav" aria-label="Primary">
          <p className="shell-nav-heading">Navigate</p>
          <ul className="shell-nav-list">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`shell-nav-link${active === item.id ? ' shell-nav-link--active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="shell-nav-link-label">{item.label}</span>
                  <span className="shell-nav-link-desc">{item.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="shell-main">{children}</main>
      </div>
    </div>
  )
}
