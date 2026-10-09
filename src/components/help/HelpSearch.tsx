import { Search, X } from 'lucide-react';

export function HelpSearch({ query, onChange }: { query: string; onChange: (query: string) => void }) {
  return <div className="help-search">
    <label className="sr-only" htmlFor="help-search">Search help articles</label>
    <Search size={21} aria-hidden="true" />
    <input id="help-search" type="search" placeholder="Search help articles..." value={query} onChange={(event) => onChange(event.target.value)} />
    {query && <button type="button" aria-label="Clear help search" onClick={() => onChange('')}><X size={17} aria-hidden="true" /></button>}
  </div>;
}
