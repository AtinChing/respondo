import { useState } from 'react'
import { AppShell, type AppPage } from './components/AppShell'
import { IssueDashboard } from './components/IssueDashboard'
import { SettingsPage } from './components/SettingsPage'

function App() {
  const [page, setPage] = useState<AppPage>('issues')

  return (
    <AppShell active={page} onNavigate={setPage}>
      {page === 'issues' ? <IssueDashboard /> : <SettingsPage />}
    </AppShell>
  )
}

export default App
