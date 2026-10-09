import { ChevronRight, FileText, Trash2 } from 'lucide-react';
import type { AnalysisRecord } from '../types/analysis';
import { historyTitle } from '../services/historyService';

export function HistoryItem({ record, onOpen, onDelete }: { record: AnalysisRecord; onOpen: () => void; onDelete: () => void }) {
  const date = new Date(record.analyzedAt);
  const tone = record.classification === 'AI Likely' ? 'ai' : record.classification === 'Human Likely' ? 'human' : 'uncertain';
  return <article className="history-row" data-record-id={record.id}>
    <button type="button" className="history-row-open history-row-layout" onClick={onOpen} aria-label={`Open analysis: ${historyTitle(record)}`}>
      <span className="history-document"><span className={`history-file-icon ${tone}`}><FileText size={27} aria-hidden="true" /></span>
        <span className="history-document-copy"><strong>{historyTitle(record)}</strong><span>{record.preview}</span></span></span>
      <span className="history-date"><span>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <small>{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></span>
      <span className="history-words"><strong>{record.wordCount.toLocaleString('en-US')}</strong><small>words</small></span>
      <span className={`classification history-badge ${tone}`}>{record.classification === 'Mixed / Uncertain' ? 'Mixed' : record.classification}</span>
      <span className={`classification history-badge probability-badge ${tone}`}>{record.aiProbability}%</span>
      <span className="history-report-button">Open Report <ChevronRight size={20} aria-hidden="true" /></span>
    </button>
    <button type="button" className="history-delete" aria-label={`Delete analysis: ${historyTitle(record)}`} title="Delete analysis" onClick={onDelete}><Trash2 size={17} /></button>
  </article>;
}
