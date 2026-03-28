import { useState } from 'react'
import { AppShell, type AppPage } from './components/AppShell'
import { CallPhonesPage } from './components/CallPhonesPage'
import { GetVidAnalysisPage } from './components/GetVidAnalysisPage'
import { IssueDashboard } from './components/IssueDashboard'
import { SettingsPage } from './components/SettingsPage'

function App() {
  const [page, setPage] = useState<AppPage>('issues')

  return (
    <AppShell active={page} onNavigate={setPage}>
      {page === 'issues' ? (
        <IssueDashboard />
      ) : page === 'vid-analysis' ? (
        <GetVidAnalysisPage />
      ) : page === 'phone-calls' ? (
        <CallPhonesPage />
      ) : (
        <SettingsPage />
      )}
    </AppShell>
  )
}

export default App
