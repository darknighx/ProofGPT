"""One pinned HF cache, local-only availability and byte-based download events.

Hub 0.36's snapshot tqdm reports file counts, not individual byte transfers.
Observe only this revision's known snapshot/blob/incomplete files. Taking the
maximum per file avoids double-counting symlinks, copies or atomic renames.
"""
import hashlib
import json
import os
import sys
import threading
import time
from pathlib import Path
from collections import deque

MANIFEST_PATH = (Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent) / "shared" / "model-manifest.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
TOTAL_BYTES = sum(file["size"] for file in MANIFEST["files"])


class ModelIntegrityError(OSError):
    pass


def cache_root():
    hub = Path(os.environ.get("HF_HUB_CACHE", Path(os.environ["HF_HOME"]) / "hub"))
    return hub / ("models--" + MANIFEST["model"].replace("/", "--"))


def snapshot_path():
    return cache_root() / "snapshots" / MANIFEST["revision"]


def file_size(path):
    try:
        return path.stat().st_size if path.is_file() else 0
    except OSError:
        return 0


def cached_snapshot():
    """No imports/network; reject missing/truncated files, including broken links.

Full download hashes are checked before readiness. Startup uses exact lengths
to avoid re-reading 1.74 GB every launch. Load failures allow an explicit repair.
"""
    snapshot = snapshot_path()
    return snapshot if all(file_size(snapshot / file["name"]) == file["size"] for file in MANIFEST["files"]) else None


def downloaded_bytes(exclude_completed=frozenset()):
    root, snapshot = cache_root(), snapshot_path()
    count = 0
    for file in MANIFEST["files"]:
        # A file being repaired must not count its old (possibly corrupt) copy.
        complete = file["size"] if file["name"] not in exclude_completed and any(
            file_size(location) == file["size"] for location in [snapshot / file["name"], root / "blobs" / file["etag"]]) else 0
        partial = min(file_size(root / "blobs" / (file["etag"] + ".incomplete")), file["size"])
        count += max(complete, partial)
    return count


class DownloadMonitor:
    def __init__(self, callback, clock=time.monotonic, repair=False):
        self.callback, self.clock = callback, clock
        self.exclude_completed = {file["name"] for file in MANIFEST["files"]} if repair else set()
        self.repair = repair
        self.last_bytes = downloaded_bytes(self.exclude_completed)
        self.last_time = clock()
        self.samples = deque([(self.last_time, self.last_bytes)])
        self.stopped = threading.Event()
        self.thread = None

    def sample(self):
        now, current = self.clock(), downloaded_bytes(self.exclude_completed)
        if not self.repair:
            # Atomic HF renames can race a stat sample. Already received bytes
            # still exist in the snapshot; don't briefly regress during a move.
            current = max(current, self.last_bytes)
        self.samples.append((now, current))
        while len(self.samples) > 1 and self.samples[1][0] <= now - 5:
            self.samples.popleft()
        elapsed = now - self.samples[0][0]
        # Resumed bytes form the baseline, never an artificial speed spike.
        # A five-second actual-byte window smooths buffered disk writes.
        speed = max(0, current - self.samples[0][1]) / elapsed if elapsed > 0 else 0
        self.last_time, self.last_bytes = now, current
        self.callback({"downloadedBytes": current, "totalBytes": TOTAL_BYTES,
                       "percentage": round(current / TOTAL_BYTES * 100, 2),
                       "bytesPerSecond": round(speed, 2)})

    def start(self):
        self.sample()
        def monitor():
            while not self.stopped.wait(1):
                self.sample()
        self.thread = threading.Thread(target=monitor, daemon=True)
        self.thread.start()

    def completed(self, name):
        self.exclude_completed.discard(name)

    def stop(self):
        self.stopped.set()
        if self.thread:
            self.thread.join()
        self.sample()


def verify_file(path, file):
    if file_size(path) != file["size"]:
        raise OSError("The downloaded model file is incomplete.")
    # HF etags are SHA256 for LFS files and Git blob SHA1 for regular files.
    digest = hashlib.sha256() if len(file["etag"]) == 64 else hashlib.sha1()
    if len(file["etag"]) == 40:
        digest.update(f'blob {file["size"]}\0'.encode())
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != file["etag"]:
        raise ModelIntegrityError("The downloaded model file failed its integrity check.")


def ensure_model(status, progress=lambda _: None, repair=False):
    existing = cached_snapshot()
    if existing and not repair:
        return existing
    from huggingface_hub import hf_hub_download
    status("downloading", "Downloading detection model... First-time setup requires the local AI detection model (~1.74 GB).")
    monitor = DownloadMonitor(progress, repair=repair)
    monitor.start()
    try:
        for file in MANIFEST["files"]:
            target = snapshot_path() / file["name"]
            invalid = target.exists() and file_size(target) != file["size"]
            downloaded = Path(hf_hub_download(MANIFEST["model"], filename=file["name"], revision=MANIFEST["revision"],
                                             force_download=repair or invalid))
            monitor.completed(file["name"])
            # Validate newly transferred files; valid cached weights need no rehash.
            if not existing or repair or invalid:
                verify_file(downloaded, file)
        if not cached_snapshot():
            raise OSError("The downloaded model cache is incomplete.")
        return snapshot_path()
    finally:
        monitor.stop()
