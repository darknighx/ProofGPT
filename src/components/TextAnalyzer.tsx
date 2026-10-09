import { useRef, useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { analyzeText, MAX_CHARACTERS, validateText, shortTextWarning } from '../services/detectorService';
import type { AnalysisRecord } from '../types/analysis';
import { AnalysisResult } from './AnalysisResult';
import { useSettings } from '../contexts/SettingsContext';
import { useModel } from '../contexts/ModelContext';
import { DownloadStatus } from './DownloadStatus';

export function TextAnalyzer({ onSaved }: { onSaved?: () => void }) {
  const { settings } = useSettings();
  const { model } = useModel();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'saved' | 'not-saved' | 'error'>('saved');
  const inFlight = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const warning = shortTextWarning(text, settings.warnShortText);

  async function handleAnalyze() {
    if (inFlight.current) return;
    const validation = validateText(text);
    if (validation) { setError(validation); input.current?.focus(); return; }
    inFlight.current = true;
    setAnalyzing(true);
    setStatus('Preparing local detector...');
    setError(null);
    setSaveError('');
    setResult(null);
    try {
      const { analysis, historyError, savedToHistory } = await analyzeText(text, (update) => setStatus(update.message));
      setResult(analysis);
      setHistoryStatus(historyError ? 'error' : savedToHistory ? 'saved' : 'not-saved');
      if (historyError) setSaveError(`Analysis completed, but it could not be saved to History. ${historyError}`);
      else if (savedToHistory) onSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Detection unavailable. Please restart ProofGPT and try again.');
    } finally {
      inFlight.current = false;
      setAnalyzing(false);
      setStatus('');
    }
  }
  return <section className="analyzer flex min-h-0 flex-col items-center" aria-label="Text analyzer">
    <div className="text-input-wrap relative w-full">
      <textarea ref={input} aria-label="Text to analyze" aria-describedby={error ? 'character-count analysis-error' : 'character-count'} aria-invalid={!!error} readOnly={analyzing} placeholder="Paste your text here..."
        maxLength={MAX_CHARACTERS} value={text} spellCheck={false}
        onChange={(event) => { setText(event.target.value.slice(0, MAX_CHARACTERS)); setError(null); setSaveError(''); setResult(null); }} />
      <div id="character-count" className="character-count pointer-events-none absolute">
        {text.length.toLocaleString('en-US')} / 15,000 chars
      </div>
      <span className="resize-detail pointer-events-none" aria-hidden="true" />
    </div>
    {error && <p id="analysis-error" className="analysis-error" role="alert">{error}</p>}
    {!error && warning && <p className="analysis-short-warning" role="status">{warning}</p>}
    <button type="button" className="analyze-button flex items-center justify-center gap-5" onClick={handleAnalyze} disabled={analyzing} aria-busy={analyzing}>
      {analyzing ? <LoaderCircle className="analysis-spinner" aria-hidden="true" size={32} /> : <Sparkles aria-hidden="true" size={32} fill="currentColor" strokeWidth={1.2} />}
      <span>{analyzing ? 'Analyzing...' : 'Analyze Text'}</span>
    </button>
    {model.status === 'downloading' ? <DownloadStatus progress={model.progress} /> : <p className={analyzing ? 'result-note' : 'sr-only'} role="status">{analyzing ? status : result ? 'Analysis complete. Model result available below.' : ''}</p>}
    {result && <AnalysisResult result={result} historyStatus={historyStatus} />}
    {saveError && <p className="history-error" role="alert">{saveError}</p>}
  </section>;
}
