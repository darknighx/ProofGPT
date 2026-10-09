import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultSettings, settingsService } from '../services/settingsService';
import type { AppSettings } from '../types/settings';
import type { AnalysisRecord } from '../types/analysis';

interface SettingsContextValue {
  settings: AppSettings; version: string; loading: boolean; saving: boolean; error: string;
  reload: () => Promise<void>; update: (patch: Partial<AppSettings>) => Promise<void>;
  restoreDefaults: () => Promise<void>; resetData: () => Promise<AnalysisRecord[]>;
}
const SettingsContext = createContext<SettingsContextValue | null>(null);
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({ ...defaultSettings });
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function reload() {
    try { const response = await settingsService.get(); setSettings(response.settings); setVersion(response.version); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Settings could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  async function change(operation: () => Promise<AppSettings>) {
    setSaving(true);
    try { setSettings(await operation()); setError(''); }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Settings could not be saved.'; setError(message); throw new Error(message); }
    finally { setSaving(false); }
  }
  async function resetData() {
    setSaving(true);
    try { const response = await settingsService.resetData(); setSettings(response.settings); setError(''); return response.records; }
    catch (cause) { await reload(); throw cause; }
    finally { setSaving(false); }
  }
  return <SettingsContext.Provider value={{ settings, version, loading, saving, error, reload,
    update: (patch) => change(() => settingsService.update(patch)), restoreDefaults: () => change(() => settingsService.restoreDefaults()), resetData }}>{children}</SettingsContext.Provider>;
}
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('SettingsProvider is required.');
  return context;
}
