import type { AnalysisRecord, DetectorResult, DetectorStatus } from './types/analysis';
import type { AppSettings } from './types/settings';
import type { ModelState } from './types/model';
type HistoryResponse = { ok: true; records: AnalysisRecord[] } | { ok: false; error: string };
declare global {
  interface Window {
    desktop?: {
      minimize(): void;
      maximize(): void;
      close(): void;
      openDocumentation(): Promise<{ ok: true } | { ok: false; error: string }>;
      exportReport(format: 'csv' | 'json', data: string): Promise<{ ok: true; canceled: true } | { ok: true; canceled: false; path: string } | { ok: false; error: string }>;
      analyze(text: string): Promise<{ ok: true; result: DetectorResult; record: AnalysisRecord; savedToHistory: boolean; historyError?: string } | { ok: false; error: string }>;
      model: {
        status(): Promise<ModelState>;
        download(): Promise<{ ok: true } | { ok: false; error: string }>;
      };
      onModelState(callback: (state: ModelState) => void): () => void;
      settings: {
        get(): Promise<{ ok: true; settings: AppSettings; version: string } | { ok: false; error: string }>;
        update(patch: Partial<AppSettings>): Promise<{ ok: true; settings: AppSettings } | { ok: false; error: string }>;
        restoreDefaults(): Promise<{ ok: true; settings: AppSettings } | { ok: false; error: string }>;
        resetData(): Promise<{ ok: true; settings: AppSettings; records: AnalysisRecord[] } | { ok: false; error: string }>;
      };
      history: {
        list(): Promise<HistoryResponse>;
        remove(id: string): Promise<HistoryResponse>;
        clear(): Promise<HistoryResponse>;
      };
      onDetectorStatus(callback: (status: DetectorStatus) => void): () => void;
    };
  }
}
