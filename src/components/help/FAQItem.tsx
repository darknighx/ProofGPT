import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { HelpFAQ } from '../../data/helpContent';

export function FAQItem({ faq }: { faq: HelpFAQ }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return <div className="help-faq-item">
    <h3><button id={`${id}-question`} type="button" aria-expanded={expanded} aria-controls={`${id}-answer`} onClick={() => setExpanded(!expanded)}>
      <span>{faq.question}</span><ChevronDown size={17} aria-hidden="true" />
    </button></h3>
    <div id={`${id}-answer`} hidden={!expanded} aria-labelledby={`${id}-question`} className="help-faq-answer"><p>{faq.answer}</p></div>
  </div>;
}
