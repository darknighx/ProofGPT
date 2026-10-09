import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildReport, calculateAverageAiProbability, serializeReportCSV, serializeReportJSON, filterAnalysesByDateRange } from '../src/services/reportService.ts';
const { saveReportExport } = createRequire(import.meta.url)('../electron/report-export.cjs');
const results = JSON.parse(await readFile('detector/tests/RESULTS.json', 'utf8'));
const samples = JSON.parse(await readFile('detector/tests/fixtures/samples.json', 'utf8'));
const now = new Date('2026-10-04T12:00:00.000Z');
function record(index, daysAgo) {
  const text = samples[index].text;
  return { ...results.samples[index], id: `math-test-${index}-${daysAgo}`, text,
    preview: text.trim().replace(/\s+/g, ' ').slice(0, 160), analyzedAt: new Date(+now - daysAgo * 86400000).toISOString() };
}
// Synthetic Mixed probability is only a calculation edge case. Never persisted or seeded in the app.
const mixed = { ...record(0, 60), id: 'math-only-mixed', aiProbability: 50, humanProbability: 50, classification: 'Mixed / Uncertain' };
const records = [record(0, 1), record(2, 20), mixed, record(3, 100)];
const selection = { range: 'All Time', classification: 'All', query: '', sort: 'newest' };
const report = buildReport(records, selection, now);
assert.equal(report.total, 4);
assert.equal(report.averageAiProbability, 37.5);
assert.deepEqual(report.distribution.map(({ count, percentage }) => [count, percentage]), [[1, 25], [2, 50], [1, 25]]);
assert.deepEqual(report.records.map((record) => record.id), records.map((record) => record.id));
assert.deepEqual(report.trend.map((point) => point.id), [...records].reverse().map((record) => record.id));
assert.equal(calculateAverageAiProbability([]), null);
assert.equal(buildReport([]).total, 0);
for (const [range, count] of [['Last 7 Days', 1], ['Last 30 Days', 2], ['Last 90 Days', 3]]) {
  assert.equal(filterAnalysesByDateRange(records, range, now).length, count);
  assert.equal(buildReport(records, { ...selection, range }, now).total, count);
}
assert.equal(filterAnalysesByDateRange([record(0, 7), record(2, -1)], 'Last 7 Days', now).length, 1);
assert.equal(buildReport(records, { ...selection, classification: 'Mixed / Uncertain' }, now).total, 1);
assert.equal(buildReport(records, { ...selection, query: 'UNIVERSALLY ACKNOWLEDGED' }, now).total, 1);
assert.equal(buildReport(records, { ...selection, query: 'no matching content' }, now).averageAiProbability, null);
assert.deepEqual(buildReport(records, { ...selection, sort: 'oldest' }, now).records.map((record) => record.id), [...records].reverse().map((record) => record.id));
assert.equal(records[0].id, 'math-test-0-1'); // Source array was not sorted/mutated.
const one = buildReport([records[1]], selection, now);
assert.equal(one.trend.length, 1);
assert.equal(one.averageAiProbability, records[1].aiProbability);
const json = JSON.parse(serializeReportJSON(one, now));
assert.equal(json.analyses[0].text, records[1].text);
assert.equal(json.summary.totalAnalyses, 1);
assert.equal(json.trend[0].aiProbability, records[1].aiProbability);
assert.equal(json.exportedAt, now.toISOString());
const withoutCharts = JSON.parse(serializeReportJSON(one, now, false));
assert.equal(withoutCharts.trend, undefined);
assert.equal(withoutCharts.summary.distribution, undefined);
assert.deepEqual(withoutCharts.analyses, json.analyses);
const tricky = { ...records[0], text: '=SUM(1,2)\n"Quoted", comma', preview: '=SUM(1,2) "Quoted", comma' };
const csv = serializeReportCSV(buildReport([tricky]));
assert.ok(csv.startsWith('\uFEFFAnalysis ID,'));
assert.ok(csv.includes('"\'=SUM(1,2)\n""Quoted"", comma"'));
assert.ok(csv.includes(',100,0,AI Likely,'));
await mkdir('artifacts/test-profiles', { recursive: true });
const directory = await mkdtemp(path.resolve('artifacts/test-profiles/export-'));
const file = path.join(directory, 'report.json');
const dialog = { showSaveDialog: async () => ({ canceled: false, filePath: file }) };
assert.deepEqual(await saveReportExport({ format: 'json', data: serializeReportJSON(one), dialog, documentsDirectory: directory }), { ok: true, canceled: false, path: file });
assert.equal(JSON.parse(await readFile(file, 'utf8')).analyses[0].text, records[1].text);
assert.deepEqual(await saveReportExport({ format: 'csv', data: csv, dialog: { showSaveDialog: async () => ({ canceled: true }) }, documentsDirectory: directory }), { ok: true, canceled: true });
assert.equal((await saveReportExport({ format: 'pdf', data: csv, dialog, documentsDirectory: directory })).ok, false);
assert.equal((await saveReportExport({ format: 'csv', data: csv, dialog: { showSaveDialog: async () => ({ canceled: false, filePath: path.join(directory, 'missing', 'report.csv') }) }, documentsDirectory: directory })).ok, false);
console.log('PASS: averages, all three classifications, chronological trend, date boundaries, search/filter/sort, one/zero records, CSV escaping/formula protection, JSON contents, native export save/cancel/errors.');
