"""Real model regression report, not accuracy claims or pass/fail tuning."""
import json
from pathlib import Path
from detector.detector import DactylDetector, make_chunks

root = Path(__file__).resolve().parents[2]
samples = json.loads((root / 'detector/tests/fixtures/samples.json').read_text(encoding='utf-8'))
detector = DactylDetector()
results = []
for sample in samples:
    result = detector.analyze(sample['text'], lambda phase, message: print(message, flush=True))
    results.append({key: value for key, value in sample.items() if key != 'text'} | result)
    print(sample['id'], result['aiProbability'], result['classification'], flush=True)

model_id = id(detector.model)
repeat = detector.analyze(samples[0]['text'])
assert repeat['aiProbability'] == results[0]['aiProbability']
assert id(detector.model) == model_id

# Entire 15,000-character stream is covered; later chunks include different text.
long_text = ((samples[0]['text'] + '\n\n' + samples[-1]['text'] + '\n\n') * 20)[:15000]
chunks = make_chunks(long_text, detector.tokenizer, detector.context_length)
ids = detector.tokenizer(long_text, add_special_tokens=False, truncation=False, verbose=False)['input_ids']
assert [token for chunk in chunks for token in chunk['ids']] == ids
assert all(len(chunk['ids']) + 2 <= detector.context_length for chunk in chunks)
long_result = detector.analyze(long_text, lambda phase, message: print(message, flush=True))
assert long_result['chunksAnalyzed'] > 1
assert sum(chunk['tokenCount'] for chunk in long_result['chunks']) == len(ids)
assert long_result['characterCount'] == 15000
report = {'model': results[0]['modelName'], 'revision': results[0]['modelRevision'],
          'id2label': detector.model.config.id2label, 'contextLength': detector.context_length,
          'samples': results, 'repeatIdentical': True, 'longDocument': long_result}
(root / 'detector/tests/RESULTS.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('PASS: real inference, repeated score stability, model reuse, full 15,000-character coverage.', flush=True)
