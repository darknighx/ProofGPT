import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ModelState } from '../types/model';

const initial: ModelState = { status: 'checking', modelName: 'DACTYL AI Text Detector', totalBytes: 0, cachedBytes: 0, progress: null, error: null, sequence: -1 };
const ModelContext = createContext<{ model: ModelState; download: () => Promise<void> } | null>(null);
export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<ModelState>(initial);
  useEffect(() => {
    let active = true;
    const receive = (next: ModelState) => { if (active && next) setModel((current) => next.sequence >= current.sequence ? next : current); };
    if (!window.desktop) { setModel({ ...initial, status: 'failed', error: 'Open ProofGPT in the desktop application.' }); return; }
    const unsubscribe = window.desktop.onModelState(receive);
    void window.desktop.model.status().then(receive).catch(() => { if (active) setModel({ ...initial, status: 'failed', error: 'Model status could not be checked. Restart ProofGPT and try again.' }); });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function download() {
    if (!window.desktop) return;
    try { await window.desktop.model.download(); }
    catch { setModel((current) => ({ ...current, status: 'failed', progress: null, error: 'Model download could not be started. Restart ProofGPT and try again.' })); }
  }
  return <ModelContext.Provider value={{ model, download }}>{children}</ModelContext.Provider>;
}
export function useModel() {
  const context = useContext(ModelContext);
  if (!context) throw new Error('ModelProvider is required.');
  return context;
}
