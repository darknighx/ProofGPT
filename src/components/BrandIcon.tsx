import { useId } from 'react';

export function BrandIcon({ className = '' }: { className?: string }) {
  const gradient = useId();
  return <svg className={className} viewBox="0 0 112 116" fill="none" aria-hidden="true">
    <defs><linearGradient id={gradient} x1="8" y1="4" x2="106" y2="104" gradientUnits="userSpaceOnUse">
      <stop stopColor="#bc78f8" /><stop offset=".5" stopColor="#6765ff" /><stop offset="1" stopColor="#c195f4" />
    </linearGradient></defs>
    <g stroke={`url(#${gradient})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M59 96H18a9 9 0 0 1-9-9V15a9 9 0 0 1 9-9h45l23 24v11M62 7v23h23" />
      <path d="M25 29h25M25 44h34M25 59h22M25 74h11" />
      <path d="M84 51c-7 6-16 10-25 11v20c0 13 9 23 25 29 16-6 25-16 25-29V62c-9-1-18-5-25-11Z" fill="#101423" />
      <path d="m74 83 8 8 15-17" stroke="#c2c5ff" strokeWidth="6" />
    </g>
  </svg>;
}
