import { TextAnalyzer } from '../components/TextAnalyzer';
import { AmbientWave } from '../components/AmbientWave';

export function HomePage({ onSaved }: { onSaved?: () => void }) {
  return <main className="home-page relative min-w-0 flex-1 overflow-auto">
    <AmbientWave />
    <div className="home-content relative flex flex-col">
      <header className="home-heading text-center">
        <h1>Detect <span>AI-Generated Text</span></h1>
        <p>Paste or type text below to analyze it.</p>
      </header>
      <TextAnalyzer onSaved={onSaved} />
      <footer className="trust-footer flex items-center justify-center">
        <span className="trust-rule" /><p>Accurate <span>•</span> Private <span>•</span> Easy to understand</p><span className="trust-rule" />
      </footer>
    </div>
  </main>;
}
