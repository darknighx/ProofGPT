import { House, Search, History, ChartNoAxesColumnIncreasing, Settings, CircleHelp } from 'lucide-react';
import { BrandIcon } from './BrandIcon';
import { SidebarItem } from './SidebarItem';
import type { StartupPage } from '../types/settings';

export type Page = StartupPage | 'detector' | 'help';
export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return <aside className="sidebar shrink-0">
    <div className="brand flex flex-col items-center">
      <BrandIcon className="brand-icon" />
      <div className="brand-name">Proof<span>GPT</span></div>
      <div className="brand-tagline">TRUST WHAT YOU READ</div>
    </div>
    <nav aria-label="Main navigation" className="flex flex-col">
      <SidebarItem label="Home" icon={House} active={page === 'home'} onClick={() => onNavigate('home')} />
      <SidebarItem label="AI Detector" icon={Search} active={page === 'detector'} onClick={() => onNavigate('detector')} />
      <SidebarItem label="History" icon={History} active={page === 'history'} onClick={() => onNavigate('history')} />
      <SidebarItem label="Reports" icon={ChartNoAxesColumnIncreasing} active={page === 'reports'} onClick={() => onNavigate('reports')} />
      <SidebarItem label="Settings" icon={Settings} active={page === 'settings'} onClick={() => onNavigate('settings')} />
      <SidebarItem label="Help" icon={CircleHelp} active={page === 'help'} onClick={() => onNavigate('help')} />
    </nav>
  </aside>;
}
