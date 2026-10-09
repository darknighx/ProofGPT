import type { AnalysisRecord, DetectorStatus } from '../types/analysis';

export const MAX_CHARACTERS = 15_000;
export const MIN_WORDS = 50;
export const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
export function shortTextWarning(text: string, enabled: boolean) {
  const words = countWords(text);
  return enabled && words >= MIN_WORDS && words < 100 ? 'Short sample: fewer than 100 words. The detector will report Low confidence.' : null;
}
export function validateText(text: string): string | null {
  if (!text.trim()) return 'Enter some text before analyzing.';
  if (text.length > MAX_CHARACTERS) return 'Please keep your text within 15,000 characters.';
  if (countWords(text) < MIN_WORDS) return 'Please enter at least 50 words for a more reliable analysis.';
  return null;
}

/** Only the local pretrained model supplies scores. No heuristic fallback. */
export async function analyzeText(text: string, onStatus?: (status: DetectorStatus) => void): Promise<{ analysis: AnalysisRecord; historyError?: string; savedToHistory: boolean }> {
  const error = validateText(text);
  if (error) throw new Error(error);
  if (!window.desktop) throw new Error('Detection unavailable: open ProofGPT in the Electron desktop application.');
  const unsubscribe = window.desktop.onDetectorStatus((status) => onStatus?.(status));
  try {
    const response = await window.desktop.analyze(text);
    if (!response.ok) throw new Error(response.error);
    return { analysis: response.record, historyError: response.historyError, savedToHistory: response.savedToHistory };
  } finally { unsubscribe(); }
}
