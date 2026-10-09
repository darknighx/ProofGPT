import type { DownloadProgress } from '../types/analysis';
import { formatBytes } from '../services/downloadFormat';

export function DownloadStatus({ progress, settings = false }: { progress: DownloadProgress | null; settings?: boolean }) {
  return <div className={`model-download-status ${settings ? 'in-settings' : 'in-home'}`} role="status" aria-live="polite" aria-atomic="true">
    <strong>{settings ? 'Downloading model...' : 'Downloading detection model...'}</strong>
    {!settings && <p>First-time setup requires the local AI detection model (~1.74 GB).</p>}
    {progress ? <div className="model-download-metrics">
      <span data-testid="download-size">{formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}</span>
      <span data-testid="download-percentage">{progress.percentage.toLocaleString('en-US', { maximumFractionDigits: 1 })}% downloaded</span>
      <span data-testid="download-speed">Download speed: {formatBytes(progress.bytesPerSecond)}/s</span>
    </div> : <p>Preparing download...</p>}
  </div>;
}
