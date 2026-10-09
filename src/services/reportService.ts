import type { AnalysisRecord, Classification } from '../types/analysis';

export const reportRanges = ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'] as const;
export type ReportRange = typeof reportRanges[number];
export interface ReportSelection {
  range: ReportRange;
  classification: 'All' | Classification;
  query: string;
  sort: 'newest' | 'oldest';
}
export const defaultReportSelection: ReportSelection = { range: 'All Time', classification: 'All', query: '', sort: 'newest' };
export const classificationColors: Record<Classification, string> = {
  'AI Likely': '#ff5275', 'Human Likely': '#35c99a', 'Mixed / Uncertain': '#e4b654',
};
export interface DistributionEntry { classification: Classification; count: number; percentage: number }
export interface TrendPoint { id: string; analyzedAt: string; aiProbability: number; classification: Classification }
export interface ReportData {
  selection: ReportSelection;
  records: AnalysisRecord[];
  total: number;
  averageAiProbability: number | null;
  distribution: DistributionEntry[];
  trend: TrendPoint[];
}
const classifications: Classification[] = ['AI Likely', 'Human Likely', 'Mixed / Uncertain'];
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function filterAnalysesByDateRange(records: AnalysisRecord[], range: ReportRange, now = new Date()) {
  if (range === 'All Time') return [...records];
  const days = range === 'Last 7 Days' ? 7 : range === 'Last 30 Days' ? 30 : 90;
  const earliest = now.getTime() - days * 24 * 60 * 60 * 1000;
  return records.filter((record) => {
    const time = Date.parse(record.analyzedAt);
    return time >= earliest && time <= now.getTime();
  });
}
export function calculateAverageAiProbability(records: AnalysisRecord[]) {
  return records.length ? round(records.reduce((sum, record) => sum + record.aiProbability, 0) / records.length) : null;
}
export function calculateClassificationDistribution(records: AnalysisRecord[]): DistributionEntry[] {
  return classifications.map((classification) => {
    const count = records.filter((record) => record.classification === classification).length;
    return { classification, count, percentage: records.length ? round(count / records.length * 100) : 0 };
  });
}
export function createProbabilityTrend(records: AnalysisRecord[]): TrendPoint[] {
  return [...records].sort((a, b) => Date.parse(a.analyzedAt) - Date.parse(b.analyzedAt) || a.id.localeCompare(b.id))
    .map(({ id, analyzedAt, aiProbability, classification }) => ({ id, analyzedAt, aiProbability, classification }));
}
export function buildReport(records: AnalysisRecord[], selection = defaultReportSelection, now = new Date()): ReportData {
  const query = selection.query.trim().toLocaleLowerCase();
  const selected = filterAnalysesByDateRange(records, selection.range, now).filter((record) =>
    (selection.classification === 'All' || record.classification === selection.classification)
    && record.text.toLocaleLowerCase().includes(query));
  selected.sort((a, b) => {
    const chronological = Date.parse(a.analyzedAt) - Date.parse(b.analyzedAt) || a.id.localeCompare(b.id);
    return selection.sort === 'oldest' ? chronological : -chronological;
  });
  return { selection: { ...selection }, records: selected, total: selected.length,
    averageAiProbability: calculateAverageAiProbability(selected),
    distribution: calculateClassificationDistribution(selected), trend: createProbabilityTrend(selected) };
}

// Escape CSV structure and neutralize spreadsheet formulas in submitted text.
function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === 'string' && /^(\s*[=+\-@]|[\t\r\n])/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function serializeReportCSV(report: ReportData) {
  const columns = ['Analysis ID', 'Analyzed At', 'Title', 'Original Text', 'Word Count', 'Character Count', 'Sentence Count',
    'AI Probability (%)', 'Human Probability (%)', 'Classification', 'Confidence', 'Model', 'Model Revision'];
  const rows = report.records.map((record) => [record.id, record.analyzedAt, record.preview.slice(0, 72), record.text,
    record.wordCount, record.characterCount, record.sentenceCount, record.aiProbability, record.humanProbability,
    record.classification, record.confidence, record.modelName, record.modelRevision]);
  return '\uFEFF' + [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function serializeReportJSON(report: ReportData, now = new Date(), includeChartData = true) {
  return JSON.stringify({ application: 'ProofGPT', version: 1, exportedAt: now.toISOString(), filters: report.selection,
    summary: { totalAnalyses: report.total, averageAiProbability: report.averageAiProbability, ...(includeChartData ? { distribution: report.distribution } : {}) },
    ...(includeChartData ? { trend: report.trend } : {}), analyses: report.records }, null, 2) + '\n';
}
export async function exportReport(report: ReportData, format: 'csv' | 'json', includeChartData = true) {
  if (!report.total) throw new Error('There are no analyses in this selection to export.');
  if (!window.desktop?.exportReport) throw new Error('Export is available in the ProofGPT desktop application.');
  const data = format === 'csv' ? serializeReportCSV(report) : serializeReportJSON(report, new Date(), includeChartData);
  const response = await window.desktop.exportReport(format, data);
  if (!response.ok) throw new Error(response.error);
  return response;
}
