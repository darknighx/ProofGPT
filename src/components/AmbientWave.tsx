import { useId } from 'react';

export function AmbientWave() {
  const gradient = useId();
  return <svg className="ambient-wave pointer-events-none absolute" viewBox="0 0 750 290" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6351ff" stopOpacity=".06" /><stop offset=".55" stopColor="#5139de" stopOpacity=".4" /><stop offset="1" stopColor="#3022b0" stopOpacity=".13" /></linearGradient></defs>
    <path d="M0 0H750V260C733 161 580 159 500 105S412 12 303 0Z" fill={`url(#${gradient})`} />
    <path d="M438 0C581 8 585 114 750 165V0Z" fill={`url(#${gradient})`} stroke="#8e69ff" strokeOpacity=".18" />
  </svg>;
}
