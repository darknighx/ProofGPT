import assert from 'node:assert/strict';
import { helpArticles, helpCategories, helpFAQs } from '../src/data/helpContent.ts';
import { filterHelpArticles, filterHelpFAQs } from '../src/services/helpService.ts';

assert.equal(filterHelpArticles(helpArticles, '  HISTORY  ', null).some((article) => article.id === 'manage-history'), true);
assert.equal(filterHelpArticles(helpArticles, 'step-by-step', null).some((article) => article.id === 'analyze-text'), true);
// Category labels are searchable even when a title/description does not contain the term.
assert.equal(filterHelpArticles(helpArticles, 'Getting Started', null).some((article) => article.id === 'analyze-text'), true);
assert.equal(filterHelpFAQs(helpFAQs, '100% ACCURATE', null)[0].id, 'accuracy');
assert.equal(filterHelpFAQs(helpFAQs, 'PROBABILITIES', null).some((faq) => faq.id === 'accuracy'), true);
assert.deepEqual(filterHelpArticles(helpArticles, 'zz-nonexistent-help-term', null), []);
assert.deepEqual(filterHelpFAQs(helpFAQs, 'zz-nonexistent-help-term', null), []);
assert.deepEqual(filterHelpArticles(helpArticles, 'offline', 'settings'), []);
assert.equal(filterHelpArticles(helpArticles, '', null).length, helpArticles.length);
assert.equal(filterHelpFAQs(helpFAQs, '', null).length, helpFAQs.length);
for (const category of helpCategories) {
  assert.ok(filterHelpArticles(helpArticles, '', category.id).length > 0, `No real articles for ${category.title}`);
}
assert.equal(new Set(helpArticles.map((item) => item.id)).size, helpArticles.length);
assert.equal(new Set(helpFAQs.map((item) => item.id)).size, helpFAQs.length);
for (const item of [...helpArticles, ...helpFAQs]) {
  assert.ok(item.categories.length > 0);
  for (const category of item.categories) assert.ok(helpCategories.some((item) => item.id === category));
}
console.log('PASS: Help title/description/category/FAQ/answer search, case and whitespace, combined filters, empty state, complete category content.');
