import { Minus, Square, X } from 'lucide-react';
import { BrandIcon } from './BrandIcon';

export function TitleBar() {
  return <header className="title-bar flex shrink-0 items-center justify-between">
    <div className="flex items-center gap-4"><BrandIcon className="title-logo" /><span>ProofGPT</span></div>
    <div className="window-controls flex h-full items-stretch">
      <button aria-label="Minimize window" onClick={() => window.desktop?.minimize()}><Minus /></button>
      <button aria-label="Maximize or restore window" onClick={() => window.desktop?.maximize()}><Square /></button>
      <button className="close-window" aria-label="Close window" onClick={() => window.desktop?.close()}><X /></button>
    </div>
  </header>;
}
