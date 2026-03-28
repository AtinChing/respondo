import { useState } from 'react'
import { AppShell, type AppPage } from './components/AppShell'
import { AssetsPage } from './components/AssetsPage'
import { CallPhonesPage } from './components/CallPhonesPage'
import { GetVidAnalysisPage } from './components/GetVidAnalysisPage'
import { IssueDashboard } from './components/IssueDashboard'
import { SettingsPage } from './components/SettingsPage'
import { IssueReportsProvider } from './context/IssueReportsContext'

function App() {
  const [page, setPage] = useState<AppPage>('issues')

  return (
    <IssueReportsProvider>
      <AppShell active={page} onNavigate={setPage}>
        {page === 'issues' ? (
          <IssueDashboard />
        ) : page === 'assets' ? (
          <AssetsPage />
        ) : page === 'vid-analysis' ? (
          <GetVidAnalysisPage />
        ) : page === 'phone-calls' ? (
          <CallPhonesPage />
        ) : (
          <SettingsPage />
        )}
      </AppShell>
    </IssueReportsProvider>
  )
}

export default App
