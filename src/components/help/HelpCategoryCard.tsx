import { BookOpen, FileSearch, History, ChartNoAxesColumnIncreasing, Settings, ShieldCheck, Wrench, FileText, Download, Clock, ChevronRight } from 'lucide-react';
import type { HelpCategory, HelpIcon } from '../../data/helpContent';

export const helpIcons = { book: BookOpen, detector: FileSearch, history: History, reports: ChartNoAxesColumnIncreasing, settings: Settings, privacy: ShieldCheck, tools: Wrench, file: FileText, download: Download, clock: Clock } satisfies Record<HelpIcon, typeof BookOpen>;
export function HelpCategoryCard({ category, selected, onClick }: { category: HelpCategory; selected: boolean; onClick: () => void }) {
  const Icon = helpIcons[category.icon];
  return <button type="button" className={`help-category ${selected ? 'is-selected' : ''}`} data-category={category.id} aria-pressed={selected} onClick={onClick}>
    <span className="help-category-icon"><Icon size={35} aria-hidden="true" /></span>
    <span className="help-category-copy"><strong>{category.title}</strong><small>{category.description}</small></span>
    <ChevronRight size={17} aria-hidden="true" />
  </button>;
}
