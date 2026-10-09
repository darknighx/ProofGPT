import { useCallback, useEffect, useState } from 'react';
import { Sidebar, type Page } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { useSettings } from './contexts/SettingsContext';
import type { AnalysisRecord } from './types/analysis';
import { historyService } from './services/historyService';

export default function App() {
  const [page, setPage] = useState<Page | null>(null);
  const [homeVersion, setHomeVersion] = useState(0);
  const { settings, loading: settingsLoading, error: settingsError } = useSettings();
  const [historySelection, setHistorySelection] = useState<string | null>(null);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const refreshHistory = useCallback(async () => {
    setLoading(true);
    try { setRecords(await historyService.list()); setHistoryError(''); }
    catch (cause) { setHistoryError(cause instanceof Error ? cause.message : 'History could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);
  useEffect(() => { if (!settingsLoading && page === null) setPage(settings.startPage); }, [settingsLoading, settings.startPage, page]);
  useEffect(() => { if (page === 'detector') document.querySelector<HTMLTextAreaElement>('.analyzer textarea')?.focus({ preventScroll: true }); }, [page]);
  function navigate(next: Page) { setHistorySelection(null); setPage(next); }
  function openAnalysis(id: string) { setHistorySelection(id); setPage('history'); }
  return <div className="app-shell flex h-dvh flex-col overflow-hidden">
    <TitleBar />
    {settingsError && page !== 'settings' && <div className="settings-load-banner" role="alert">{settingsError}<button type="button" onClick={() => navigate('settings')}>Open Settings</button></div>}
    <div className="app-body flex min-h-0 flex-1">
      <Sidebar page={page ?? 'home'} onNavigate={navigate} />
      {page === null ? <main className="settings-bootstrap flex-1" role="status">Loading preferences...</main> : <div className="min-w-0 flex-1" style={{ display: page === 'home' || page === 'detector' ? 'flex' : 'none' }}><HomePage key={homeVersion} onSaved={() => void refreshHistory()} /></div>}
      {page === 'history' && <HistoryPage records={records} loading={loading} error={historyError} onRecords={setRecords} onRefresh={() => void refreshHistory()} onHome={() => navigate('home')} initialRecordId={historySelection} />}
      {page === 'reports' && <ReportsPage records={records} loading={loading} error={historyError} onRefresh={() => void refreshHistory()} onHome={() => navigate('home')} onOpen={openAnalysis} />}
      {page === 'settings' && <SettingsPage onRecords={(updated) => { setRecords(updated); setHistoryError(''); }} onReset={() => { setHomeVersion((value) => value + 1); setHistorySelection(null); }} onRefreshHistory={refreshHistory} />}
      {page === 'help' && <HelpPage />}
    </div>
  </div>;
}
