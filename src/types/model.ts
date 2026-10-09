import type { DownloadProgress } from './analysis';

export interface ModelState {
  status: 'checking' | 'not-downloaded' | 'downloading' | 'ready' | 'failed';
  modelName: string;
  totalBytes: number;
  cachedBytes: number;
  progress: DownloadProgress | null;
  error: string | null;
  sequence: number;
}
