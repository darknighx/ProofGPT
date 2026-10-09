import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createTestProfile } from './test-profile.mjs';

const samples = JSON.parse(await readFile('detector/tests/fixtures/samples.json', 'utf8'));
const profile = await createTestProfile('reports');
const env = { ...process.env, HF_HUB_OFFLINE: '1' };
delete env.ELECTRON_RUN_AS_NODE; delete env.PROOFGPT_DEV_URL;
const launch = () => electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
let app;
const errors = [];
try {
  app = await launch();
  let page = await app.firstWindow();
  page.setDefaultTimeout(180000);
  page.on('pageerror', (error) => errors.push(error.message));
  const reports = () => page.getByRole('button', { name: 'Reports', exact: true }).click();
  await reports();
  await page.getByRole('heading', { name: 'No report data yet' }).waitFor();
  assert.equal(await page.locator('[aria-current="page"]').innerText(), 'Reports');
  assert.equal(await page.locator('.report-donut, .report-bar-chart, .report-table').count(), 0);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/reports-empty.png' });
  await page.locator('.reports-empty').getByRole('button', { name: 'Analyze Text' }).click();
  assert.equal(await page.locator('[aria-current="page"]').innerText(), 'Home');
  const scores = [];
  for (const sample of [samples[0], samples[2]]) {
    await page.getByRole('textbox', { name: 'Text to analyze' }).fill(sample.text);
    await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
    await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
    scores.push(Number((await page.getByTestId('ai-score').innerText()).replace('%', '')));
    await reports();
    await page.waitForFunction((total) => document.querySelector('[data-testid="report-total"]')?.textContent === String(total), scores.length);
    assert.equal(await page.locator('.report-trend-point').count(), scores.length);
    if (scores.length === 1) {
      assert.equal(await page.getByTestId('report-average').innerText(), `${scores[0]}%`);
      await page.screenshot({ path: 'artifacts/reports-one-analysis.png' });
      await page.getByRole('button', { name: 'Home', exact: true }).click();
    }
  }
  const stored = JSON.parse(await readFile(path.join(profile, 'history.json'), 'utf8')).records;
  const expectedAverage = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length + Number.EPSILON) * 100) / 100;
  assert.equal(await page.getByTestId('report-average').innerText(), `${expectedAverage}%`);
  assert.equal(await page.getByTestId('report-ai-count').innerText(), '1');
  assert.equal(await page.getByTestId('report-human-count').innerText(), '1');
  assert.match(await page.locator('.report-legend').innerText(), /1 \(50%\)/);
  assert.equal(await page.locator('.report-trend-point').first().getAttribute('data-record-id'), stored[1].id);
  assert.equal(await page.locator('.report-trend-point').last().getAttribute('data-probability'), String(scores[1]));
  assert.equal(await page.locator('.report-table tbody tr').first().getAttribute('data-record-id'), stored[0].id);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 1024));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.export-json').evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight), true);
  await page.screenshot({ path: 'artifacts/reports-desktop.png' });
  for (const range of ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'All Time']) {
    await page.getByRole('combobox', { name: 'Report time range' }).selectOption(range);
    assert.equal(await page.getByTestId('report-total').innerText(), '2');
  }
  await page.getByRole('combobox', { name: 'Sort reports' }).selectOption('oldest');
  assert.equal(await page.locator('.report-table tbody tr').first().getAttribute('data-record-id'), stored[1].id);
  await page.getByRole('combobox', { name: 'Sort reports' }).selectOption('newest');
  for (const [classification, count] of [['AI Likely', 1], ['Human Likely', 1], ['Mixed / Uncertain', 0], ['All', 2]]) {
    await page.locator('.report-filters').getByRole('button', { name: classification, exact: true }).click();
    assert.equal(await page.getByTestId('report-total').innerText(), String(count));
    assert.equal(await page.locator('.report-trend-point').count(), count);
    if (!count) {
      assert.equal(await page.locator('.report-donut').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), true);
    }
  }
  const search = page.getByRole('searchbox', { name: 'Search reports' });
  await search.fill('UNIVERSALLY ACKNOWLEDGED');
  assert.equal(await page.getByTestId('report-total').innerText(), '1');
  assert.equal(await page.getByTestId('report-average').innerText(), `${scores[1]}%`);
  const jsonFile = path.join(profile, 'reports.json');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, jsonFile);
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Report saved' }).waitFor();
  const exported = JSON.parse(await readFile(jsonFile, 'utf8'));
  assert.equal(exported.summary.totalAnalyses, 1);
  assert.equal(exported.summary.averageAiProbability, scores[1]);
  assert.equal(exported.analyses[0].text, samples[2].text);
  assert.equal(exported.filters.query, 'UNIVERSALLY ACKNOWLEDGED');
  await search.fill('');
  const csvFile = path.join(profile, 'reports.csv');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, csvFile);
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Report saved' }).waitFor();
  const csv = await readFile(csvFile, 'utf8');
  assert.ok(csv.includes(stored[0].id) && csv.includes(stored[1].id));
  assert.ok(csv.includes('AI Probability (%)') && csv.includes(samples[2].text));
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Export canceled' }).waitFor();
  await search.fill('no text with this phrase');
  await page.getByRole('heading', { name: 'No matching analyses' }).waitFor();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.locator('.report-title-button').first().click();
  assert.equal(await page.locator('[aria-current="page"]').innerText(), 'History');
  assert.equal(await page.locator('.history-full-text p').innerText(), samples[2].text);
  await page.getByRole('button', { name: 'Back to History' }).click();
  await page.locator('.history-delete').last().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete analysis', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.history-row').length === 1);
  await reports();
  assert.equal(await page.getByTestId('report-total').innerText(), '1');
  assert.equal(await page.getByTestId('report-average').innerText(), `${scores[1]}%`);
  await app.close(); app = undefined;
  env.PROOFGPT_PYTHON = 'C:/ProofGPT-test-missing/python.exe';
  app = await launch(); page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await reports();
  await page.getByTestId('report-total').waitFor();
  assert.equal(await page.getByTestId('report-total').innerText(), '1');
  assert.equal(await page.getByTestId('report-average').innerText(), `${scores[1]}%`);
  // Charts and their detail links work without an available model/runtime.
  await page.locator('.report-trend-point').first().press('Enter');
  assert.equal(await page.locator('.history-full-text p').innerText(), samples[2].text);
  await reports();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(850, 660));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.reports-page').evaluate((element) => element.scrollWidth > element.clientWidth), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/reports-compact.png' });
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Clear History', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear History', exact: true }).click();
  await page.getByRole('heading', { name: 'No analyses yet' }).waitFor();
  await reports();
  await page.getByRole('heading', { name: 'No report data yet' }).waitFor();
  assert.deepEqual(JSON.parse(await readFile(path.join(profile, 'history.json'), 'utf8')).records, []);
  assert.deepEqual(errors, []);
  console.log('PASS: Reports empty/one/multiple, real inference, saved-data metrics/trend/distribution, filters/search/sort, CSV/JSON/cancel, detail links, delete/clear updates, restart without Python, minimum resize, no renderer errors.');
} finally { await app?.close(); }
