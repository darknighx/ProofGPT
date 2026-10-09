import { ChevronRight, type LucideIcon } from 'lucide-react';

interface SidebarItemProps { label: string; icon: LucideIcon; active?: boolean; onClick?: () => void }
export function SidebarItem({ label, icon: Icon, active = false, onClick }: SidebarItemProps) {
  return <button type="button" className={`sidebar-item flex w-full items-center text-left ${active ? 'is-active' : ''}`}
    aria-current={active ? 'page' : undefined} onClick={onClick}>
    <Icon className="nav-icon shrink-0" strokeWidth={1.75} />
    <span>{label}</span>
    {active && <ChevronRight className="nav-chevron ml-auto" strokeWidth={1.7} />}
  </button>;
}
