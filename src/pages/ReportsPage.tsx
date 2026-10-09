import { useState } from 'react';
import { ChartNoAxesColumnIncreasing, Plus, FileText, Brain, UserRound, FileClock, FileSpreadsheet, Braces, ArrowRight, LoaderCircle } from 'lucide-react';
import type { AnalysisRecord } from '../types/analysis';
import { buildReport, defaultReportSelection, exportReport, reportRanges, type ReportSelection } from '../services/reportService';
import { ReportDistribution, ReportTrend } from '../components/ReportCharts';
import { RecentReports } from '../components/RecentReports';
import { useSettings } from '../contexts/SettingsContext';

export function ReportsPage({ records, loading, error, onRefresh, onHome, onOpen }: {
  records: AnalysisRecord[]; loading: boolean; error: string;
  onRefresh: () => void; onHome: () => void; onOpen: (id: string) => void;
}) {
  const { settings } = useSettings();
  const [selection, setSelection] = useState<ReportSelection>(defaultReportSelection);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const report = buildReport(records, selection);
  const ai = report.distribution[0], human = report.distribution[1];
  async function save(format: 'csv' | 'json', record?: AnalysisRecord) {
    if (exporting) return;
    setExporting(true); setExportMessage(''); setExportError('');
    try {
      const response = await exportReport(record ? buildReport([record]) : report, format, settings.includeChartData);
      setExportMessage(response.canceled ? 'Export canceled.' : `Report saved to ${response.path}`);
    } catch (cause) { setExportError(cause instanceof Error ? cause.message : 'The report could not be exported.'); }
    finally { setExporting(false); }
  }
  return <main className="reports-page min-w-0 flex-1 overflow-auto" aria-label="Reports">
    <header className="reports-heading"><div className="reports-heading-copy"><ChartNoAxesColumnIncreasing className="reports-heading-icon" aria-hidden="true" /><div><h1>Reports</h1><p>View, manage, and export your analysis reports.</p></div></div>
      <div className="reports-heading-actions"><select className="report-select" aria-label="Report time range" value={selection.range} onChange={(event) => setSelection({ ...selection, range: event.target.value as ReportSelection['range'] })}>{reportRanges.map((range) => <option key={range}>{range}</option>)}</select><button type="button" className="report-new-analysis" onClick={onHome}><Plus size={20} /> Analyze Text</button></div></header>
    {loading ? <div className="reports-empty" role="status"><LoaderCircle className="analysis-spinner" size={30} /><p>Loading report data...</p></div> : error ? <div className="reports-empty" role="alert"><h2>Report data could not be loaded</h2><p>{error}</p><button type="button" className="report-new-analysis" onClick={onRefresh}>Try again</button></div> : !records.length ? <div className="reports-empty"><div className="reports-empty-icon"><ChartNoAxesColumnIncreasing size={44} /></div><h2>No report data yet</h2><p>Analyze some text to start building your reports.</p><button type="button" className="report-new-analysis" onClick={onHome}>Analyze Text <ArrowRight size={18} /></button></div> : <>
      <div className="reports-stats">
        <div className="report-panel report-stat"><span className="report-stat-icon total"><FileText size={34} /></span><div><p>Total Analyses</p><strong data-testid="report-total">{report.total.toLocaleString('en-US')}</strong><small>{selection.range === 'All Time' ? 'All saved analyses' : selection.range}{selection.classification !== 'All' || selection.query.trim() ? ' · Filtered' : ''}</small></div></div>
        <div className="report-panel report-stat"><span className="report-stat-icon ai"><Brain size={35} /></span><div><p>AI Likely</p><strong data-testid="report-ai-count">{ai.count.toLocaleString('en-US')}</strong><small><span className="report-text-ai">{ai.percentage}%</span> of analyses</small></div></div>
        <div className="report-panel report-stat"><span className="report-stat-icon human"><UserRound size={35} /></span><div><p>Human Likely</p><strong data-testid="report-human-count">{human.count.toLocaleString('en-US')}</strong><small><span className="report-text-human">{human.percentage}%</span> of analyses</small></div></div>
        <div className="report-panel report-stat"><span className="report-stat-icon average"><FileClock size={34} /></span><div><p>Avg. AI Probability</p><strong data-testid="report-average">{report.averageAiProbability === null ? '—' : `${report.averageAiProbability}%`}</strong><small>Across matching analyses</small></div></div>
      </div>
      <div className="reports-layout"><RecentReports records={report.records} selection={selection} onSelection={setSelection} onOpen={onOpen} onExport={(record) => void save(settings.defaultExportFormat, record)} exporting={exporting} exportFormat={settings.defaultExportFormat} />
        <aside className="reports-insights" aria-label="Report charts and export"><ReportDistribution entries={report.distribution} total={report.total} /><ReportTrend points={report.trend} onOpen={onOpen} />
          <section className="report-panel report-export" aria-labelledby="export-reports-heading"><h2 id="export-reports-heading">Export Reports</h2><p>Export the analyses in your current selection for personal records or sharing.</p><div className="report-export-buttons"><button type="button" className="export-csv" disabled={exporting || !report.total} onClick={() => void save('csv')}><FileSpreadsheet size={18} /> Export CSV</button><button type="button" className="export-json" disabled={exporting || !report.total} onClick={() => void save('json')}><Braces size={18} /> Export JSON</button></div>
            <small className="report-export-preference">Analysis downloads use {settings.defaultExportFormat.toUpperCase()}.</small>{exporting && <p className="report-export-status" role="status">Choose a location to save your report...</p>}{exportMessage && <p className="report-export-status" role="status">{exportMessage}</p>}{exportError && <p className="report-export-error" role="alert">{exportError}</p>}</section>
        </aside>
      </div>
    </>}
  </main>;
}
