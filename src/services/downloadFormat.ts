/** Decimal units match Hugging Face's download sizes; transfer rate is actual bytes/s. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.max(0, Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1));
  const amount = bytes / 1000 ** index;
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: index === 3 ? 2 : index ? 1 : 0 })} ${units[index]}`;
}
