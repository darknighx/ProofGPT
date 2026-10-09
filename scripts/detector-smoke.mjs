import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { samples } from './detector-check.mjs';
import { createTestProfile } from './test-profile.mjs';

const env = { ...process.env, HF_HUB_OFFLINE: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.PROOFGPT_DEV_URL;
const profile = await createTestProfile('detector');
const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const input = page.getByRole('textbox', { name: 'Text to analyze' });
  const button = page.getByRole('button', { name: 'Analyze Text', exact: true });
  await button.click();
  assert.match(await page.getByRole('alert').innerText(), /Enter some text/);
  await input.fill('Too short.');
  await button.click();
  assert.match(await page.getByRole('alert').innerText(), /at least 50 words/);
  const outputs = [];
  for (const sample of [samples[0], samples[2], samples[0]]) {
    await input.fill(sample.text);
    assert.equal(await page.locator('.analysis-result').count(), 0);
    await button.click();
    const busy = page.getByRole('button', { name: 'Analyzing...', exact: true });
    assert.equal(await busy.isDisabled(), true);
    assert.equal(await input.getAttribute('readonly'), '');
    assert.ok((await page.getByRole('status').innerText()).length > 0);
    await busy.evaluate((element) => { element.click(); element.click(); });
    await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
    outputs.push({ id: sample.id, score: await page.getByTestId('ai-score').innerText() });
    assert.equal(await input.inputValue(), sample.text);
    assert.equal(await button.isEnabled(), true);
    assert.match(await page.locator('.result-disclaimer').innerText(), /not proof/);
    assert.equal(await page.locator('.analysis-result').count(), 1);
  }
  assert.equal(outputs[0].score, outputs[2].score);
  assert.notEqual(outputs[0].score, outputs[1].score);
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/ml-electron-results.json', JSON.stringify(outputs, null, 2));
  await page.locator('.analysis-result').screenshot({ path: 'artifacts/ml-analysis-result.png' });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));
  assert.equal(await page.locator('main').evaluate((element) => element.scrollWidth > element.clientWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: real OFFLINE Electron inference, status, duplicate protection, original text, repeatability, reanalysis, resize.', outputs);
} finally { await app.close(); }

const failureEnv = { ...env, PROOFGPT_PYTHON: 'C:/ProofGPT-test-missing/python.exe' };
const failureProfile = await createTestProfile('detector-failure');
const failureApp = await electron.launch({ args: ['.', `--user-data-dir=${failureProfile}`], env: failureEnv });
try {
  const page = await failureApp.firstWindow();
  await page.getByRole('textbox').fill(samples[0].text);
  await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /Detection unavailable/);
  assert.equal(await page.locator('.analysis-result').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Analyze Text', exact: true }).isEnabled(), true);
  console.log('PASS: missing Python shown inline, no fallback score, UI recovers.');
} finally { await failureApp.close(); }
