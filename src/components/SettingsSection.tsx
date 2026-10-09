import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function SettingsSection({ title, description, icon: Icon, children }: { title: string; description: string; icon: LucideIcon; children: ReactNode }) {
  return <section className="settings-section" aria-label={title}><header><Icon size={35} aria-hidden="true" /><div><h2>{title}</h2><p>{description}</p></div></header>{children}</section>;
}
export function SettingRow({ id, title, description, children, className = '' }: { id: string; title: string; description: string; children: ReactNode; className?: string }) {
  return <div className={`setting-row ${className}`}><div className="setting-copy"><h3 id={`${id}-label`}>{title}</h3><p id={`${id}-description`}>{description}</p></div><div className="setting-control">{children}</div></div>;
}
export function Toggle({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <button type="button" className={`setting-toggle ${checked ? 'checked' : ''}`} role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} disabled={disabled} onClick={() => onChange(!checked)}><span aria-hidden="true" /></button>;
}
export function SettingsSelect({ id, value, onChange, disabled, icon: Icon, children }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; icon: LucideIcon; children: ReactNode }) {
  return <div className="settings-select"><Icon size={18} aria-hidden="true" /><select aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select></div>;
}
