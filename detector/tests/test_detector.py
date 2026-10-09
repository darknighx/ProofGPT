import math
import re
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from detector.detector import DetectorError, DactylDetector, make_chunks, supported_length, summarize_scores, utf16_length, validate_text


class WordTokenizer:
    model_max_length = 10**30

    def num_special_tokens_to_add(self, pair=False):
        return 2

    def __call__(self, text, **kwargs):
        spans = [(match.start(), match.end()) for match in re.finditer(r'\S+', text)]
        return {'input_ids': list(range(len(spans))), 'offset_mapping': spans}


class DetectorTests(unittest.TestCase):
    def test_input_validation(self):
        for text in ['', ' \n ', 'Ten words are far too short.', 'a' * 15001, None]:
            with self.assertRaises(DetectorError):
                validate_text(text)
        validate_text('word ' * 50)
        self.assertEqual(utf16_length('a😀'), 3)

    def test_context_sentinel(self):
        self.assertEqual(supported_length(WordTokenizer(), SimpleNamespace(max_position_embeddings=512)), 512)
        self.assertEqual(supported_length(SimpleNamespace(model_max_length=256), SimpleNamespace(max_position_embeddings=512)), 256)
        with self.assertRaises(DetectorError):
            supported_length(WordTokenizer(), SimpleNamespace())

    def test_complete_chunk_coverage(self):
        text = ('One two three four five.\n\nSix seven eight nine ten. 😀\n' * 100)[:15000]
        tokenizer = WordTokenizer()
        chunks = make_chunks(text, tokenizer, 32)
        expected = tokenizer(text)['input_ids']
        self.assertEqual([token for chunk in chunks for token in chunk['ids']], expected)
        self.assertTrue(all(0 < len(chunk['ids']) <= 30 for chunk in chunks))
        self.assertEqual(chunks[0]['startCharacter'], 0)
        self.assertEqual(chunks[-1]['endCharacter'], utf16_length(text))
        for left, right in zip(chunks, chunks[1:]):
            self.assertEqual(left['tokenEnd'], right['tokenStart'])
            self.assertEqual(left['endCharacter'], right['startCharacter'])

    def test_aggregation_and_confidence(self):
        chunks = [{'aiProbability': 10, 'tokenCount': 100}, {'aiProbability': 90, 'tokenCount': 300}]
        score, classification, confidence = summarize_scores(chunks, 300)
        self.assertEqual(score, 70)
        self.assertEqual(classification, 'AI Likely')
        self.assertEqual(confidence, 'Low')  # Disagreement across chunks.
        self.assertEqual(summarize_scores([{'aiProbability': 95, 'tokenCount': 100}], 60)[2], 'Low')
        self.assertEqual(summarize_scores([{'aiProbability': 50, 'tokenCount': 100}], 200)[2], 'Low')
        for score in [math.nan, math.inf, -1, 101]:
            with self.assertRaises(DetectorError):
                summarize_scores([{'aiProbability': score, 'tokenCount': 10}], 100)

    def test_missing_dependencies(self):
        original = __import__
        def missing(name, *args, **kwargs):
            if name == 'torch':
                raise ImportError('test missing dependency')
            return original(name, *args, **kwargs)
        with patch('builtins.__import__', side_effect=missing):
            with self.assertRaises(DetectorError) as error:
                DactylDetector().load(lambda *_: None)
        self.assertEqual(error.exception.code, 'DEPENDENCIES')

    def test_failed_download(self):
        with patch('detector.detector.ensure_model', side_effect=OSError('test offline')):
            with self.assertRaises(DetectorError) as error:
                DactylDetector().load(lambda *_: None)
        self.assertEqual(error.exception.code, 'MODEL_DOWNLOAD')

    def test_partial_offline_snapshot_is_a_download_error(self):
        # The cache service rejects partial data before model loading.
        with patch('detector.detector.ensure_model', side_effect=OSError('Incomplete model cache')), patch('transformers.AutoTokenizer.from_pretrained') as tokenizer:
            with self.assertRaises(DetectorError) as error:
                DactylDetector().load(lambda *_: None)
        self.assertEqual(error.exception.code, 'MODEL_DOWNLOAD')
        tokenizer.assert_not_called()

    def test_inference_failure_no_fallback(self):
        detector = DactylDetector()
        detector.model = object()  # Skip load; simulate a tokenizer failure.
        detector.context_length = 512
        detector.tokenizer = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError('test'))
        with self.assertRaises(DetectorError) as error:
            detector.analyze('word ' * 100)
        self.assertEqual(error.exception.code, 'INFERENCE')

    def test_model_load_failure(self):
        with patch('detector.detector.ensure_model', return_value='fake-cache'), patch('transformers.AutoTokenizer.from_pretrained', side_effect=OSError('test corrupt cache')):
            with self.assertRaises(DetectorError) as error:
                DactylDetector().load(lambda *_: None)
        self.assertEqual(error.exception.code, 'MODEL_LOAD')

    def test_malformed_logits(self):
        import torch
        class Tokenizer(WordTokenizer):
            def prepare_for_model(self, ids, **kwargs):
                return {'input_ids': torch.tensor([ids])}
        for logits in [torch.tensor([[float('nan')]]), torch.tensor([[1., 2.]])]:
            detector = DactylDetector()
            detector.model = lambda **kwargs: SimpleNamespace(logits=logits)
            detector.tokenizer, detector.torch, detector.context_length = Tokenizer(), torch, 512
            with self.assertRaises(DetectorError) as error:
                detector.analyze('word ' * 100)
            self.assertEqual(error.exception.code, 'MODEL_OUTPUT')

    def test_unknown_labels_are_rejected(self):
        model = SimpleNamespace(config=SimpleNamespace(num_labels=2, id2label={0: 'LABEL_0', 1: 'LABEL_1'}))
        with patch('detector.detector.ensure_model', return_value='fake-cache'), patch('transformers.AutoTokenizer.from_pretrained', return_value=WordTokenizer()), patch('transformers.AutoModelForSequenceClassification.from_pretrained', return_value=model):
            with self.assertRaises(DetectorError) as error:
                DactylDetector().load(lambda *_: None)
        self.assertEqual(error.exception.code, 'MODEL_LABELS')


if __name__ == '__main__':
    unittest.main()
