import { FileText, Search, ExternalLink, Download } from 'lucide-react';
import type { AnalysisRecord, Classification } from '../types/analysis';
import type { ReportSelection } from '../services/reportService';
import { historyTitle } from '../services/historyService';

const filters: Array<'All' | Classification> = ['All', 'AI Likely', 'Human Likely', 'Mixed / Uncertain'];
export function RecentReports({ records, selection, onSelection, onOpen, onExport, exporting, exportFormat = 'csv' }: {
  records: AnalysisRecord[]; selection: ReportSelection;
  onSelection: (selection: ReportSelection) => void; onOpen: (id: string) => void;
  onExport: (record: AnalysisRecord) => void; exporting: boolean;
  exportFormat?: 'csv' | 'json';
}) {
  const recent = records.slice(0, 8);
  return <section className="report-panel recent-reports" aria-labelledby="recent-reports-heading">
    <div className="recent-reports-heading"><h2 id="recent-reports-heading">Recent Reports</h2><label className="report-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search reports" placeholder="Search reports..." value={selection.query} onChange={(event) => onSelection({ ...selection, query: event.target.value })} /></label></div>
    <div className="recent-reports-tools"><div className="report-filters" aria-label="Filter reports">{filters.map((filter) => <button type="button" key={filter} aria-pressed={selection.classification === filter} className={selection.classification === filter ? 'active' : ''} onClick={() => onSelection({ ...selection, classification: filter })}>{filter}</button>)}</div>
      <select className="report-select" aria-label="Sort reports" value={selection.sort} onChange={(event) => onSelection({ ...selection, sort: event.target.value as ReportSelection['sort'] })}><option value="newest">Newest First</option><option value="oldest">Oldest First</option></select></div>
    {recent.length ? <><div className="report-table-scroll"><table className="report-table"><colgroup><col className="report-title-column" /><col className="report-date-column" /><col className="report-result-column" /><col className="report-score-column" /><col className="report-actions-column" /></colgroup>
      <thead><tr><th>Title</th><th>Date</th><th>Result</th><th>AI Probability</th><th>Actions</th></tr></thead>
      <tbody>{recent.map((record) => {
        const date = new Date(record.analyzedAt);
        const tone = record.classification === 'AI Likely' ? 'ai' : record.classification === 'Human Likely' ? 'human' : 'uncertain';
        return <tr key={record.id} data-record-id={record.id}><td><button type="button" className="report-title-button" aria-label={`Open report: ${historyTitle(record)}`} onClick={() => onOpen(record.id)}><FileText size={27} aria-hidden="true" /><span><strong>{historyTitle(record)}</strong><small>{record.preview}</small></span></button></td>
          <td><time dateTime={record.analyzedAt}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<small>{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></time></td>
          <td><span className={`classification report-result ${tone}`} title={record.classification}>{record.classification === 'AI Likely' ? 'AI Likely' : record.classification === 'Human Likely' ? 'Human' : 'Mixed'}</span></td>
          <td><span className="report-row-score">{record.aiProbability}%</span><span className={`report-probability-meter ${tone}`} aria-hidden="true"><span style={{ width: `${record.aiProbability}%` }} /></span></td>
          <td><div className="report-row-actions"><button type="button" aria-label={`View saved analysis: ${historyTitle(record)}`} title="View saved analysis" onClick={() => onOpen(record.id)}><ExternalLink size={18} /></button><button type="button" aria-label={`Export ${exportFormat.toUpperCase()}: ${historyTitle(record)}`} title={`Export analysis as ${exportFormat.toUpperCase()}`} disabled={exporting} onClick={() => onExport(record)}><Download size={18} /></button></div></td>
        </tr>;
      })}</tbody></table></div><p className="report-table-note">Showing {recent.length} of {records.length} matching analyses. Exports include every matching analysis.</p></> : <div className="report-table-empty"><Search size={30} /><h3>No matching analyses</h3><p>Try another search, classification, or date range.</p><button type="button" className="report-reset" onClick={() => onSelection({ range: 'All Time', classification: 'All', query: '', sort: 'newest' })}>Reset filters</button></div>}
  </section>;
}
