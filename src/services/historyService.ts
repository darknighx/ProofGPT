import type { AnalysisRecord, Classification } from '../types/analysis';

function desktopHistory() {
  if (!window.desktop?.history) throw new Error('History is available in the ProofGPT desktop application.');
  return window.desktop.history;
}
async function readResponse(response: Awaited<ReturnType<NonNullable<Window['desktop']>['history']['list']>>): Promise<AnalysisRecord[]> {
  if (!response.ok) throw new Error(response.error);
  return response.records;
}
export const historyService = {
  list: async () => readResponse(await desktopHistory().list()),
  remove: async (id: string) => readResponse(await desktopHistory().remove(id)),
  clear: async () => readResponse(await desktopHistory().clear()),
};
export type HistoryFilter = 'All' | Classification;
export function filterHistory(records: AnalysisRecord[], query: string, filter: HistoryFilter) {
  const search = query.trim().toLocaleLowerCase();
  return records.filter((record) => (filter === 'All' || record.classification === filter)
    && record.text.toLocaleLowerCase().includes(search));
}
export function getHistoryStats(records: AnalysisRecord[], now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return { total: records.length, aiLikely: records.filter((record) => record.classification === 'AI Likely').length,
    thisWeek: records.filter((record) => new Date(record.analyzedAt) >= monday && new Date(record.analyzedAt) <= now).length };
}
export const historyTitle = (record: AnalysisRecord) => record.text.trim().replace(/\s+/g, ' ').slice(0, 72);
