import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from detector import model_cache as cache
from detector.detector import download_model, DetectorError


class ModelCacheTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.env = patch.dict(os.environ, {"HF_HOME": self.directory.name, "HF_HUB_CACHE": str(Path(self.directory.name) / "hub")})
        self.env.start(); self.addCleanup(self.env.stop)
        self.body = b'a' * 100
        self.file = {"name": "model.safetensors", "size": 100, "etag": hashlib.sha256(self.body).hexdigest()}
        self.manifest = patch.object(cache, 'MANIFEST', {"model": "test/model", "revision": "pinned", "files": [self.file]})
        self.manifest.start(); self.addCleanup(self.manifest.stop)
        self.total = patch.object(cache, 'TOTAL_BYTES', 100)
        self.total.start(); self.addCleanup(self.total.stop)

    def write(self, path, body):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return path

    def test_local_availability_no_network_and_truncated_rejected(self):
        self.assertIsNone(cache.cached_snapshot())
        target = self.write(cache.snapshot_path() / self.file['name'], self.body[:-1])
        self.assertIsNone(cache.cached_snapshot())
        target.write_bytes(self.body)
        self.assertEqual(cache.cached_snapshot(), cache.snapshot_path())

    def test_real_size_delta_resume_and_stall_speed(self):
        partial = self.write(cache.cache_root() / 'blobs' / (self.file['etag'] + '.incomplete'), self.body[:40])
        events, clock = [], [0]
        monitor = cache.DownloadMonitor(events.append, clock=lambda: clock[0])
        monitor.sample()
        self.assertEqual(events[-1]['downloadedBytes'], 40)
        self.assertEqual(events[-1]['bytesPerSecond'], 0)
        partial.write_bytes(self.body[:70]); clock[0] = 2; monitor.sample()
        self.assertEqual(events[-1]['percentage'], 70)
        self.assertEqual(events[-1]['bytesPerSecond'], 15)
        clock[0] = 3; monitor.sample()
        self.assertEqual(events[-1]['bytesPerSecond'], 10)
        clock[0] = 8; monitor.sample()
        self.assertEqual(events[-1]['bytesPerSecond'], 0)

    def test_completed_snapshot_blob_partial_not_double_counted(self):
        self.write(cache.snapshot_path() / self.file['name'], self.body)
        self.write(cache.cache_root() / 'blobs' / self.file['etag'], self.body)
        self.write(cache.cache_root() / 'blobs' / (self.file['etag'] + '.incomplete'), self.body[:90])
        self.assertEqual(cache.downloaded_bytes(), 100)

    def test_retry_retains_partial_and_shared_hf_cache(self):
        partial = self.write(cache.cache_root() / 'blobs' / (self.file['etag'] + '.incomplete'), self.body[:50])
        with patch('huggingface_hub.hf_hub_download', side_effect=ConnectionError('interrupted')):
            with self.assertRaises(ConnectionError):
                cache.ensure_model(lambda *_: None)
        self.assertEqual(partial.read_bytes(), self.body[:50])
        def resume(*args, **kwargs):
            self.assertFalse(kwargs['force_download'])
            self.assertEqual(kwargs['revision'], 'pinned')
            return self.write(cache.snapshot_path() / self.file['name'], self.body)
        progress = []
        with patch('huggingface_hub.hf_hub_download', side_effect=resume) as hub:
            self.assertEqual(cache.ensure_model(lambda *_: None, progress.append), cache.snapshot_path())
            self.assertEqual(hub.call_count, 1)
        self.assertEqual(progress[0]['downloadedBytes'], 50)
        self.assertEqual(progress[-1]['downloadedBytes'], 100)
        with patch('huggingface_hub.hf_hub_download', side_effect=AssertionError('network should not be used')):
            self.assertEqual(cache.ensure_model(lambda *_: None), cache.snapshot_path())

    def test_corrupt_completed_file_requires_repair(self):
        wrong = self.write(cache.snapshot_path() / self.file['name'], b'b' * 100)
        with self.assertRaises(cache.ModelIntegrityError):
            cache.verify_file(wrong, self.file)
        def repair(*args, **kwargs):
            self.assertTrue(kwargs['force_download'])
            return self.write(wrong, self.body)
        with patch('huggingface_hub.hf_hub_download', side_effect=repair):
            cache.ensure_model(lambda *_: None, repair=True)

    def test_repair_progress_does_not_count_old_completed_weights(self):
        self.write(cache.snapshot_path() / self.file['name'], b'b' * 100)
        events, clock = [], [0]
        monitor = cache.DownloadMonitor(events.append, clock=lambda: clock[0], repair=True)
        monitor.sample()
        self.assertEqual(events[-1]['downloadedBytes'], 0)
        partial = self.write(cache.cache_root() / 'blobs' / (self.file['etag'] + '.incomplete'), self.body[:20])
        clock[0] = 2; monitor.sample()
        self.assertEqual(events[-1]['downloadedBytes'], 20)
        self.assertEqual(events[-1]['bytesPerSecond'], 10)
        self.write(cache.snapshot_path() / self.file['name'], self.body)
        partial.unlink(); monitor.completed(self.file['name']); clock[0] = 4; monitor.sample()
        self.assertEqual(events[-1]['downloadedBytes'], 100)
        self.assertEqual(events[-1]['bytesPerSecond'], 25)

    def test_disk_full_has_separate_actionable_error(self):
        with patch('detector.detector.ensure_model', side_effect=OSError(28, 'disk full')):
            with self.assertRaises(DetectorError) as error:
                download_model(lambda *_: None)
        self.assertIn('not enough free disk space', str(error.exception))

    def test_git_blob_hash_verification(self):
        data = b'{"key":"value"}'
        file = {"name": 'config.json', "size": len(data), "etag": hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()}
        cache.verify_file(self.write(cache.snapshot_path() / file['name'], data), file)


if __name__ == '__main__':
    unittest.main()
