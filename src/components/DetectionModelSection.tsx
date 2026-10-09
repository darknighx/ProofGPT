import { Cpu, Download, Check, LoaderCircle } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { DownloadStatus } from './DownloadStatus';
import { useModel } from '../contexts/ModelContext';
import { formatBytes } from '../services/downloadFormat';

export function DetectionModelSection() {
  const { model, download } = useModel();
  const downloading = model.status === 'downloading';
  return <SettingsSection title="Detection Model" description="Download once for local, offline analysis." icon={Cpu}>
    <div className="settings-detection-model">
      <h3>{model.modelName}</h3>
      {downloading ? <DownloadStatus progress={model.progress} settings /> : <p className={`model-local-status ${model.status === 'ready' ? 'is-ready' : ''}`} role="status" data-testid="model-local-status">
        {model.status === 'checking' ? 'Checking local model...' : model.status === 'ready' ? <><Check size={16} aria-hidden="true" />Model ready · {formatBytes(model.cachedBytes)} cached locally</> : model.status === 'failed' ? 'Model download failed' : 'Model not downloaded · ~1.74 GB'}
      </p>}
      {model.status === 'failed' && <p className="model-download-error" role="alert">{model.error}</p>}
      <p className="model-description">ProofGPT uses a local AI detection model. Downloading it once allows future analyses to run locally, including offline after the model is cached.</p>
      {model.status !== 'ready' && <button type="button" className="settings-secondary model-download-button" disabled={downloading || model.status === 'checking'} onClick={() => void download()}>
        {downloading ? <LoaderCircle size={17} className="analysis-spinner" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
        {downloading ? 'Downloading Model...' : model.status === 'failed' ? 'Retry Download' : 'Download Model'}
      </button>}
    </div>
  </SettingsSection>;
}
