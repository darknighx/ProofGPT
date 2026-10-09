import { helpCategories, type HelpArticle, type HelpCategoryId, type HelpFAQ } from '../data/helpContent.ts';

function categoryText(ids: HelpCategoryId[]) {
  return ids.map((id) => {
    const category = helpCategories.find((item) => item.id === id);
    return `${category?.title ?? ''} ${category?.description ?? ''}`;
  }).join(' ');
}
function matches(text: string, query: string) {
  return text.toLocaleLowerCase('en').includes(query.trim().toLocaleLowerCase('en'));
}
export function filterHelpArticles(articles: HelpArticle[], query: string, category: HelpCategoryId | null) {
  return articles.filter((article) => (!category || article.categories.includes(category)) && matches([
    article.title, article.description, categoryText(article.categories), ...article.paragraphs, ...(article.steps ?? []), ...(article.bullets ?? []),
  ].join(' '), query));
}
export function filterHelpFAQs(faqs: HelpFAQ[], query: string, category: HelpCategoryId | null) {
  return faqs.filter((faq) => (!category || faq.categories.includes(category)) && matches([
    faq.question, faq.answer, categoryText(faq.categories),
  ].join(' '), query));
}

export async function openProjectDocumentation() {
  if (!window.desktop) throw new Error('Open the Electron application to access the project documentation.');
  const response = await window.desktop.openDocumentation();
  if (!response.ok) throw new Error(response.error);
}
