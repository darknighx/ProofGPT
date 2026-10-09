import { useState } from 'react';
import { FileText, Flag, ChartNoAxesColumnIncreasing, Search, History, Trash2, ArrowRight } from 'lucide-react';
import type { AnalysisRecord } from '../types/analysis';
import { filterHistory, getHistoryStats, historyService, type HistoryFilter } from '../services/historyService';
import { HistoryItem } from '../components/HistoryItem';
import { HistoryDetail } from '../components/HistoryDetail';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AmbientWave } from '../components/AmbientWave';

const filters: HistoryFilter[] = ['All', 'AI Likely', 'Mixed / Uncertain', 'Human Likely'];
export function HistoryPage({ records, loading, error, onRecords, onRefresh, onHome, initialRecordId = null }: {
  records: AnalysisRecord[]; loading: boolean; error: string;
  onRecords: (records: AnalysisRecord[]) => void; onRefresh: () => void; onHome: () => void;
  initialRecordId?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('All');
  const [selected, setSelected] = useState<string | null>(initialRecordId);
  const [confirmation, setConfirmation] = useState<AnalysisRecord | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const stats = getHistoryStats(records);
  const visible = filterHistory(records, query, filter);
  const detail = records.find((record) => record.id === selected);
  function confirmDelete(record: AnalysisRecord | 'all') { setDeleteError(''); setConfirmation(record); }
  async function performDelete() {
    if (!confirmation || deleting) return;
    setDeleting(true); setDeleteError('');
    try {
      const updated = confirmation === 'all' ? await historyService.clear() : await historyService.remove(confirmation.id);
      onRecords(updated);
      if (confirmation === 'all' || confirmation.id === selected) setSelected(null);
      setConfirmation(null);
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'History could not be updated. Please try again.'); }
    finally { setDeleting(false); }
  }
  return <main className="home-page history-page relative min-w-0 flex-1 overflow-auto" aria-label="Analysis history">
    <AmbientWave />
    <div className="history-content relative">
      {error ? <div className="history-load-error" role="alert"><p>{error}</p><button className="history-secondary" onClick={onRefresh}>Try again</button></div> : null}
      {detail ? <HistoryDetail record={detail} onBack={() => setSelected(null)} onDelete={() => confirmDelete(detail)} /> : <>
        <header className="history-heading"><div><h1>Analysis <span>History</span></h1><p className="history-subtitle">Review your previous scans and reopen past reports.</p></div>
          {records.length > 0 && <button className="history-clear" type="button" onClick={() => confirmDelete('all')}><Trash2 size={15} /> Clear History</button>}</header>
        <div className="history-stat-cards">
          <div className="history-stat-card"><span className="history-stat-icon scans"><FileText size={34} /></span><div><p>Total scans</p><strong data-testid="total-scans">{stats.total}</strong><small className="positive">+{stats.thisWeek} this week</small></div></div>
          <div className="history-stat-card"><span className="history-stat-icon flagged"><Flag size={34} fill="currentColor" /></span><div><p>AI Likely</p><strong>{stats.aiLikely}</strong><small>{stats.total ? Math.round(stats.aiLikely / stats.total * 100) : 0}% of total</small></div></div>
          <div className="history-stat-card"><span className="history-stat-icon weekly"><ChartNoAxesColumnIncreasing size={34} /></span><div><p>This week</p><strong>{stats.thisWeek}</strong><small>scans completed</small></div></div>
        </div>
        <div className="history-tools"><div className="history-filters" aria-label="Filter history">{filters.map((category) => <button key={category} type="button" aria-pressed={filter === category} className={`history-filter ${filter === category ? 'active' : ''}`} onClick={() => setFilter(category)}>
          {category} ({category === 'All' ? records.length : records.filter((record) => record.classification === category).length})</button>)}</div>
          <label className="history-search"><Search size={24} aria-hidden="true" /><input type="search" aria-label="Search history" placeholder="Search history..." value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        <div className="history-column-headings history-row-layout" aria-hidden="true"><span>Document</span><span>Date</span><span>Words</span><span>Result</span><span>AI probability</span><span /></div>
        {loading ? <div className="history-empty" role="status">Loading history...</div> : error ? null : records.length === 0 ? <div className="history-empty"><span className="history-empty-icon"><History size={44} /></span><h2>No analyses yet</h2><p>Analyze some text and your results will appear here.</p><button type="button" className="history-primary" onClick={onHome}>Analyze Text <ArrowRight size={18} /></button></div>
          : visible.length === 0 ? <div className="history-empty"><Search size={36} /><h2>No matching analyses</h2><p>Try a different search or classification filter.</p><button type="button" className="history-secondary" onClick={() => { setQuery(''); setFilter('All'); }}>Reset filters</button></div>
            : <div className="history-list" aria-label="Saved analyses">{visible.map((record) => <HistoryItem key={record.id} record={record} onOpen={() => setSelected(record.id)} onDelete={() => confirmDelete(record)} />)}</div>}
      </>}
    </div>
    {confirmation && <ConfirmDialog title={confirmation === 'all' ? 'Clear all history?' : 'Delete this analysis?'} message={confirmation === 'all' ? `This permanently deletes all ${records.length} saved analyses from this computer. This cannot be undone.` : 'This permanently deletes the saved text and result from this computer. This cannot be undone.'} action={confirmation === 'all' ? 'Clear History' : 'Delete analysis'} busy={deleting} error={deleteError} onConfirm={performDelete} onCancel={() => setConfirmation(null)} />}
  </main>;
}
