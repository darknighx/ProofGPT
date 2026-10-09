import { useEffect, useId, useRef } from 'react';
import { FlaskConical } from 'lucide-react';
import type { AnalysisRecord } from '../types/analysis';
import { useSettings } from '../contexts/SettingsContext';

export function AnalysisResult({ result, saved = false, historyStatus = 'saved' }: { result: AnalysisRecord; saved?: boolean; historyStatus?: 'saved' | 'not-saved' | 'error' }) {
  const { settings } = useSettings();
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [result.id]);
  const tone = result.classification === 'AI Likely' ? 'ai' : result.classification === 'Human Likely' ? 'human' : 'uncertain';
  return <section className="analysis-result" aria-labelledby={headingId}>
    <div className="result-heading-row">
      <h2 id={headingId} ref={heading} tabIndex={-1}>Analysis result</h2>
      <span className="prototype-tag"><FlaskConical size={15} aria-hidden="true" /> Local ML detector</span>
    </div>
    <p className="result-disclaimer">These model probabilities are not proof of authorship. AI detection can produce false positives and false negatives, especially outside the model's English training domains.</p>
    <div className="result-scores">
      <div><span>AI Probability</span><strong data-testid="ai-score">{result.aiProbability}%</strong></div>
      <div><span>Human Probability</span><strong data-testid="human-score">{result.humanProbability}%</strong></div>
      <div className="result-verdict"><span className={`classification ${tone}`}>{result.classification}</span><span>Confidence: {result.confidence}</span><small>Classifier decisiveness, not author certainty</small></div>
    </div>
    <div className="result-meter" aria-hidden="true"><span style={{ width: `${result.aiProbability}%` }} /></div>
    <dl className="result-stats">
      <div><dt>Word count</dt><dd>{result.wordCount.toLocaleString('en-US')}</dd></div>
      <div><dt>Character count</dt><dd>{result.characterCount.toLocaleString('en-US')}</dd></div>
      <div><dt>Sentence count</dt><dd>{result.sentenceCount.toLocaleString('en-US')}</dd></div>
    </dl>
    {settings.includeExplanations && <><h3>Why ProofGPT gave this result</h3><ul>{result.observations.map((observation) => <li key={observation}>{observation}</li>)}</ul></>}
    {settings.detailLevel === 'detailed' && <section className="analysis-detailed-info" aria-label="Detailed analysis information"><h3>Analysis details</h3><p>Model: {result.modelName}<br />Processed {result.chunksAnalyzed} {result.chunksAnalyzed === 1 ? 'chunk' : 'chunks'} in {(result.inferenceDurationMs / 1000).toFixed(2)} seconds.</p><table><thead><tr><th>Chunk</th><th>Tokens</th><th>Character range</th><th>AI probability</th></tr></thead><tbody>{result.chunks.map((chunk, index) => <tr key={index}><td>{index + 1}</td><td>{chunk.tokenCount}</td><td>{chunk.startCharacter + 1}–{chunk.endCharacter}</td><td>{chunk.aiProbability.toFixed(2)}%</td></tr>)}</tbody></table></section>}
    <p className="result-note">{saved ? 'This saved analysis is shown exactly as recorded. Opening it does not run the detector again.' : historyStatus === 'not-saved' ? 'This analysis was not saved to History because history saving is off.' : historyStatus === 'error' ? 'This analysis completed but was not saved to History. See the save warning below.' : 'Edit the text above and select Analyze Text to run another analysis. Successful analyses are saved locally in History.'}</p>
  </section>;
}
