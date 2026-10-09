import { useState } from 'react';
import { Settings, SlidersHorizontal, ShieldCheck, FileText, UserRound, Moon, Globe, House, Trash2, RotateCcw, Database, LockKeyhole, Check } from 'lucide-react';
import { SettingsSection, SettingRow, SettingsSelect, Toggle } from '../components/SettingsSection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSettings } from '../contexts/SettingsContext';
import { historyService } from '../services/historyService';
import type { AppSettings } from '../types/settings';
import type { AnalysisRecord } from '../types/analysis';
import { DetectionModelSection } from '../components/DetectionModelSection';

type Confirmation = 'clear' | 'defaults' | 'reset';
const dialogs = {
  clear: { title: 'Clear analysis history?', message: 'Permanently delete all saved analyses from this device. Reports will become empty. Your preferences and downloaded model are kept.', action: 'Clear History' },
  defaults: { title: 'Restore default settings?', message: 'Restore all ProofGPT preferences to their defaults. Your analysis History and downloaded model are kept.', action: 'Restore Defaults' },
  reset: { title: 'Reset ProofGPT data?', message: 'Permanently delete all analysis History and clear the current text/results. Restore default settings. The downloaded model and previously exported files are kept. This cannot be undone.', action: 'Reset ProofGPT Data' },
};
export function SettingsPage({ onRecords, onReset, onRefreshHistory }: { onRecords: (records: AnalysisRecord[]) => void; onReset: () => void; onRefreshHistory: () => Promise<void> }) {
  const { settings, version, loading, saving, error, reload, update, restoreDefaults, resetData } = useSettings();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [notice, setNotice] = useState('');
  const disabled = loading || saving || busy || !!error;
  function change(patch: Partial<AppSettings>) { setNotice(''); void update(patch).catch(() => {}); }
  function confirm(action: Confirmation) { setDialogError(''); setNotice(''); setConfirmation(action); }
  async function performAction() {
    if (!confirmation || busy) return;
    setBusy(true); setDialogError('');
    try {
      if (confirmation === 'clear') { onRecords(await historyService.clear()); setNotice('Analysis History cleared. Reports are now empty.'); }
      else if (confirmation === 'defaults') { await restoreDefaults(); setNotice('Default settings restored. Your History was kept.'); }
      else { onRecords(await resetData()); onReset(); setNotice('ProofGPT data reset. Default settings restored; the downloaded model was kept.'); }
      setConfirmation(null);
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'The action could not be completed. Please try again.');
      if (confirmation === 'reset') await onRefreshHistory();
    } finally { setBusy(false); }
  }
  return <main className="settings-page min-w-0 flex-1 overflow-auto" aria-label="Settings">
    <header className="settings-heading"><div><Settings size={44} aria-hidden="true" /><span><h1>Settings</h1><p>Customize ProofGPT to fit your needs.</p></span></div><p className="settings-save-status" role="status">{saving ? 'Saving preferences...' : 'Changes save automatically'}</p></header>
    {error && <div className="settings-error" role="alert"><p>{error}</p><button type="button" onClick={() => void reload()}>Try again</button></div>}
    {notice && <p className="settings-notice" role="status"><Check size={16} aria-hidden="true" />{notice}</p>}
    <div className="settings-columns"><div className="settings-column">
      <SettingsSection title="General" description="Basic application preferences." icon={Settings}>
        <SettingRow id="theme" title="Theme" description="Dark is the currently supported appearance." className="theme-row"><div className="settings-dark-theme" aria-label="Dark theme, currently supported"><span aria-hidden="true" /><Moon size={27} /><strong>Dark</strong></div></SettingRow>
        <SettingRow id="language" title="Language" description="English only · Read-only in this version."><SettingsSelect id="language" value="en" icon={Globe} disabled onChange={() => {}}><option value="en">English</option></SettingsSelect></SettingRow>
        <SettingRow id="startup" title="Start-up" description="Choose what opens when launching ProofGPT."><SettingsSelect id="startup" value={settings.startPage} icon={House} disabled={disabled} onChange={(value) => change({ startPage: value as AppSettings['startPage'] })}><option value="home">Home</option><option value="history">History</option><option value="reports">Reports</option><option value="settings">Settings</option></SettingsSelect></SettingRow>
        <SettingRow id="restore-defaults" title="Restore Defaults" description="Restore preferences while keeping analysis History." className="settings-action-row"><button type="button" className="settings-secondary" disabled={loading || saving || busy} onClick={() => confirm('defaults')}><RotateCcw size={17} /> Restore Defaults</button></SettingRow>
      </SettingsSection>
      <SettingsSection title="Analysis Settings" description="Adjust warnings and result presentation." icon={SlidersHorizontal}>
        <SettingRow id="analysis-detail" title="Analysis detail level" description="Detailed adds the actual model and per-chunk scores."><SettingsSelect id="analysis-detail" value={settings.detailLevel} icon={FileText} disabled={disabled} onChange={(value) => change({ detailLevel: value as AppSettings['detailLevel'] })}><option value="standard">Standard</option><option value="detailed">Detailed</option></SettingsSelect></SettingRow>
        <SettingRow id="short-text" title="Short text warning" description="Show an advisory for 50–99 words. A minimum of 50 words is always required." className="short-text-setting"><Toggle id="short-text" checked={settings.warnShortText} disabled={disabled} onChange={(value) => change({ warnShortText: value })} /></SettingRow>
        <SettingRow id="explanations" title="Include Explanations" description="Show the detector's recorded result explanation."><Toggle id="explanations" checked={settings.includeExplanations} disabled={disabled} onChange={(value) => change({ includeExplanations: value })} /></SettingRow>
        <p className="settings-section-note">These preferences change warnings and result display. Detection scores stay the same.</p>
      </SettingsSection>
      <DetectionModelSection />
    </div><div className="settings-column">
      <SettingsSection title="Privacy & Data" description="Manage your data and privacy preferences." icon={ShieldCheck}>
        <SettingRow id="save-history" title="Save analyses to History" description="Store future successful analyses locally on this device."><Toggle id="save-history" checked={settings.saveHistory} disabled={disabled} onChange={(value) => change({ saveHistory: value })} /></SettingRow>
        <SettingRow id="clear-history" title="Clear analysis history" description="Remove saved analyses and the data shown in Reports."><button type="button" className="settings-danger" disabled={loading || saving || busy} onClick={() => confirm('clear')}><Trash2 size={18} /> Clear History</button></SettingRow>
        <SettingRow id="reset-data" title="Reset application data" description="Reset preferences and History; keep the model." className="settings-reset-row"><button type="button" className="settings-danger" disabled={loading || saving || busy} onClick={() => confirm('reset')}><Database size={18} /> Reset ProofGPT Data</button></SettingRow>
      </SettingsSection>
      <SettingsSection title="Export Settings" description="Configure default export options for your reports." icon={FileText}>
        <SettingRow id="export-format" title="Default export format" description="Format used by each report's download action."><SettingsSelect id="export-format" value={settings.defaultExportFormat} icon={FileText} disabled={disabled} onChange={(value) => change({ defaultExportFormat: value as AppSettings['defaultExportFormat'] })}><option value="csv">CSV</option><option value="json">JSON</option></SettingsSelect></SettingRow>
        <SettingRow id="chart-data" title="Include chart data in JSON" description="Include distribution and probability series in JSON exports."><Toggle id="chart-data" checked={settings.includeChartData} disabled={disabled} onChange={(value) => change({ includeChartData: value })} /></SettingRow>
      </SettingsSection>
      <SettingsSection title="Application" description="Local mode and application information." icon={UserRound}>
        <div className="settings-local-mode"><span className="settings-local-icon"><LockKeyhole size={26} /></span><div><h3>Local Mode</h3><p>ProofGPT runs on this device without an account.</p></div><span className="settings-local-badge">No account</span></div>
        <SettingRow id="app-version" title="ProofGPT version" description="Installed desktop application." className="settings-info-row"><strong className="settings-value" data-testid="app-version">{version || 'Unavailable'}</strong></SettingRow>
      </SettingsSection>
    </div></div>
    {confirmation && <ConfirmDialog {...dialogs[confirmation]} busy={busy} error={dialogError} confirmationText={confirmation === 'reset' ? 'RESET' : undefined} onConfirm={performAction} onCancel={() => setConfirmation(null)} />}
  </main>;
}
