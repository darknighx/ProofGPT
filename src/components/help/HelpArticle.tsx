import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { helpIcons } from './HelpCategoryCard';
import type { HelpArticle as Article } from '../../data/helpContent';

export function HelpArticle({ article }: { article: Article }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const Icon = helpIcons[article.icon];
  return <div className="help-article">
    <h3><button id={`${id}-title`} type="button" className="help-article-toggle" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={() => setExpanded(!expanded)}>
      <span className="help-article-icon"><Icon size={28} aria-hidden="true" /></span>
      <span className="help-article-copy"><strong>{article.title}</strong><small>{article.description}</small></span>
      <ChevronRight size={20} aria-hidden="true" />
    </button></h3>
    <div id={`${id}-body`} className="help-article-body" hidden={!expanded} aria-labelledby={`${id}-title`}>
      {article.steps && <ol>{article.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
      {article.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {article.bullets && <ul>{article.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
    </div>
  </div>;
}
