import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateText, analyzeText } from '../src/services/detectorService.ts';

export const samples = JSON.parse(readFileSync(new URL('../detector/tests/fixtures/samples.json', import.meta.url), 'utf8'));
assert.match(validateText('  '), /Enter some text/);
assert.match(validateText('Tiny sample.'), /at least 50 words/);
assert.match(validateText('x'.repeat(15001)), /15,000/);
await assert.rejects(analyzeText(''), /Enter some text/);
assert.equal(validateText(samples[0].text), null);
console.log('PASS: renderer input validation.');
