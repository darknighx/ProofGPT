import { ArrowLeft, Trash2 } from 'lucide-react';
import type { AnalysisRecord } from '../types/analysis';
import { AnalysisResult } from './AnalysisResult';

export function HistoryDetail({ record, onBack, onDelete }: { record: AnalysisRecord; onBack: () => void; onDelete: () => void }) {
  return <section className="history-detail">
    <div className="history-detail-toolbar"><button type="button" className="history-secondary" onClick={onBack}><ArrowLeft size={18} /> Back to History</button>
      <button type="button" className="history-secondary history-danger" onClick={onDelete}><Trash2 size={16} /> Delete analysis</button></div>
    <h1>Saved <span>Analysis</span></h1>
    <p className="history-subtitle"><time dateTime={record.analyzedAt}>{new Date(record.analyzedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</time></p>
    <AnalysisResult result={record} saved />
    <section className="history-full-text" aria-labelledby="submitted-text-heading"><h2 id="submitted-text-heading">Submitted text</h2><p>{record.text}</p></section>
    <p className="result-note">Model used: {record.modelName}</p>
  </section>;
}
