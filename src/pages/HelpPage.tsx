import { useRef, useState } from 'react';
import { CircleHelp, FileText, MessageSquareMore, BookOpen, ChevronRight, Wrench, ShieldCheck, HardDrive, ExternalLink, SearchX, Info } from 'lucide-react';
import { HelpSearch } from '../components/help/HelpSearch';
import { HelpCategoryCard } from '../components/help/HelpCategoryCard';
import { HelpArticle } from '../components/help/HelpArticle';
import { FAQItem } from '../components/help/FAQItem';
import { helpArticles, helpCategories, helpFAQs, type HelpCategoryId } from '../data/helpContent';
import { filterHelpArticles, filterHelpFAQs, openProjectDocumentation } from '../services/helpService';
import { useSettings } from '../contexts/SettingsContext';
import '../help.css';

export function HelpPage() {
  const { version } = useSettings();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategoryId | null>(null);
  const [allArticles, setAllArticles] = useState(false);
  const [allFAQs, setAllFAQs] = useState(false);
  const [documentationError, setDocumentationError] = useState('');
  const [openingDocumentation, setOpeningDocumentation] = useState(false);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const filtered = !!query.trim() || !!category;
  const articles = filterHelpArticles(helpArticles, query, category);
  const faqs = filterHelpFAQs(helpFAQs, query, category);
  const visibleArticles = filtered || allArticles ? articles : articles.slice(0, 6);
  const visibleFAQs = filtered || allFAQs ? faqs : faqs.slice(0, 6);
  const selectedCategory = helpCategories.find((item) => item.id === category);
  const empty = articles.length === 0 && faqs.length === 0;
  function resetFilters() { setQuery(''); setCategory(null); }
  function selectTroubleshooting() {
    setQuery(''); setCategory('troubleshooting');
    requestAnimationFrame(() => { resultsHeading.current?.focus(); resultsHeading.current?.scrollIntoView({ block: 'start' }); });
  }
  async function openDocumentation() {
    if (openingDocumentation) return;
    setOpeningDocumentation(true); setDocumentationError('');
    try { await openProjectDocumentation(); }
    catch (cause) { setDocumentationError(cause instanceof Error ? cause.message : 'Documentation could not be opened. Use the troubleshooting articles below.'); }
    finally { setOpeningDocumentation(false); }
  }
  return <main className="help-page min-w-0 flex-1 overflow-auto" aria-label="Help">
    <header className="help-heading">
      <div><CircleHelp size={49} aria-hidden="true" /><span><h1>Help</h1><p>Find answers and learn how to use ProofGPT.</p></span></div>
      <HelpSearch query={query} onChange={setQuery} />
    </header>
    <nav className="help-categories" aria-label="Help categories">
      {helpCategories.map((item) => <HelpCategoryCard key={item.id} category={item} selected={category === item.id} onClick={() => setCategory(category === item.id ? null : item.id)} />)}
      <button type="button" className="help-category help-documentation-category" disabled={openingDocumentation} onClick={() => void openDocumentation()}>
        <span className="help-category-icon"><BookOpen size={35} aria-hidden="true" /></span><span className="help-category-copy"><strong>Documentation</strong><small>Open the project guide</small></span><ExternalLink size={17} aria-hidden="true" />
      </button>
    </nav>
    {documentationError && <p className="help-error" role="alert">{documentationError}</p>}
    {filtered && <div className="help-filter-status"><p role="status">{empty ? 'No matching articles or FAQs' : `${articles.length} articles · ${faqs.length} FAQs`}{selectedCategory ? ` in ${selectedCategory.title}` : ''}</p><button type="button" onClick={resetFilters}>Show all help</button></div>}
    {empty ? <section className="help-empty"><SearchX size={39} aria-hidden="true" /><h2>No help articles found</h2><p>Try a different search or choose another category.</p><button type="button" className="help-primary" onClick={resetFilters}>Clear filters</button></section> : <div className="help-content-grid">
      <section className="help-panel help-articles" aria-labelledby="help-articles-title">
        <header><FileText size={35} aria-hidden="true" /><div><h2 id="help-articles-title" ref={resultsHeading} tabIndex={-1}>{selectedCategory?.title ?? (filtered ? 'Help articles' : 'Popular Articles')}</h2><p>Quick answers to common questions.</p></div></header>
        {visibleArticles.length ? visibleArticles.map((article) => <HelpArticle key={article.id} article={article} />) : <p className="help-section-empty">No articles match. See the related FAQs.</p>}
        {!filtered && <button type="button" className="help-view-more" onClick={() => setAllArticles(!allArticles)}>{allArticles ? 'Show popular articles' : `View all ${articles.length} articles`}<ChevronRight size={16} aria-hidden="true" /></button>}
      </section>
      <div className="help-right-column">
        <section className="help-panel help-faqs" aria-labelledby="help-faqs-title">
          <header><MessageSquareMore size={35} aria-hidden="true" /><div><h2 id="help-faqs-title">Frequently Asked Questions</h2><p>Honest answers about the detector and your data.</p></div></header>
          <div className="help-faq-list">{visibleFAQs.length ? visibleFAQs.map((faq) => <FAQItem key={faq.id} faq={faq} />) : <p className="help-section-empty">No FAQs match. See the related articles.</p>}</div>
          {!filtered && <button type="button" className="help-view-more" onClick={() => setAllFAQs(!allFAQs)}>{allFAQs ? 'Show common FAQs' : `View all ${faqs.length} FAQs`}<ChevronRight size={16} aria-hidden="true" /></button>}
        </section>
        <section className="help-panel help-support" aria-labelledby="help-support-title">
          <div className="help-support-top"><BookOpen size={40} aria-hidden="true" /><div><h2 id="help-support-title">Still need help?</h2><p>Check the project guide or troubleshooting articles.</p></div><button type="button" className="help-primary" disabled={openingDocumentation} onClick={() => void openDocumentation()}><ExternalLink size={17} aria-hidden="true" />{openingDocumentation ? 'Opening...' : 'Open documentation'}</button></div>
          <div className="help-support-details"><span><HardDrive size={26} aria-hidden="true" />Local setup<br />and model guide</span><button type="button" onClick={selectTroubleshooting}><Wrench size={26} aria-hidden="true" />Troubleshooting<br />Fix common issues</button><span><ShieldCheck size={26} aria-hidden="true" />Local analysis<br />and saved data</span></div>
        </section>
        <section className="help-panel help-about" aria-labelledby="help-about-title"><Info size={25} aria-hidden="true" /><div><h2 id="help-about-title">About ProofGPT <span>Version {version || 'unavailable'}</span></h2><p>Current detector: <strong>DACTYL AI Text Detector</strong><br />Pretrained machine-learning model · Local text analysis</p></div></section>
      </div>
    </div>}
  </main>;
}
