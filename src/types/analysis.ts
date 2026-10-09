export type Classification = 'AI Likely' | 'Mixed / Uncertain' | 'Human Likely';
export interface ChunkScore {
  tokenStart: number;
  tokenEnd: number;
  tokenCount: number;
  startCharacter: number;
  endCharacter: number;
  aiProbability: number;
}
export interface DownloadProgress { downloadedBytes: number; totalBytes: number; percentage: number; bytesPerSecond: number }
export interface DetectorStatus { phase: 'loading' | 'downloading' | 'analyzing'; message: string; progress?: DownloadProgress }
export interface DetectorResult {
  wordCount: number;
  characterCount: number;
  sentenceCount: number;
  aiProbability: number;
  humanProbability: number;
  classification: Classification;
  confidence: 'Low' | 'Moderate' | 'High';
  detectorVersion: 'dactyl-ml-v1';
  modelName: string;
  modelRevision: string;
  chunksAnalyzed: number;
  chunks: ChunkScore[];
  observations: string[];
  inferenceDurationMs: number;
}
/** Complete detector snapshot persisted in local history. */
export interface AnalysisRecord extends DetectorResult {
  id: string;
  text: string;
  preview: string;
  analyzedAt: string;
}
