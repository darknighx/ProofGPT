"""Local DACTYL inference: JSON lines on stdin/stdout, diagnostics on stderr.
No submitted text leaves this process. No heuristic fallback. See MODEL_NOTES.md.
"""
import json
import math
import os
import re
import sys
import time
import threading
from pathlib import Path
from bisect import bisect_left

MODEL_NAME = "ShantanuT01/dactyl-ai-text-detector"
MODEL_REVISION = "b62b403cb6c5c14751b5b98b474e5f662b41cef9"
ROOT = Path(__file__).resolve().parent.parent
FROZEN = getattr(sys, "frozen", False)
# Electron supplies its userData/model-cache path. Standalone tools also have a
# writable default; frozen code never writes model weights beside the executable.
default_cache = Path(os.environ.get("APPDATA", Path.home())) / "ProofGPT" / "model-cache" if FROZEN else ROOT / ".model-cache"
os.environ.setdefault("HF_HOME", str(default_cache))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_IMPLICIT_TOKEN", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
if FROZEN:
    # The optional native transfer stalled in Windows installer verification.
    # Standard Hub HTTP downloads retain the same pinned model/cache semantics.
    os.environ["HF_HUB_DISABLE_XET"] = "1"

if __package__:
    from .model_cache import ensure_model, MANIFEST, TOTAL_BYTES, ModelIntegrityError
else:
    from model_cache import ensure_model, MANIFEST, TOTAL_BYTES, ModelIntegrityError


def download_model(status, progress=lambda _: None, repair=False):
    try:
        return ensure_model(status, progress, repair)
    except Exception as error:
        if isinstance(error, OSError) and getattr(error, "errno", None) in {28, 112}:
            message = "There is not enough free disk space to download the detection model. Free some space and retry."
        else:
            message = "The detection model could not be downloaded. Check your internet connection and free disk space, then try again."
        raise DetectorError("MODEL_INTEGRITY" if isinstance(error, ModelIntegrityError) else "MODEL_DOWNLOAD", message) from error


class DetectorError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def diagnostic(**values):
    if os.environ.get("PROOFGPT_DIAGNOSTICS") == "1":
        print(json.dumps(values, ensure_ascii=True, allow_nan=False), file=sys.stderr, flush=True)


def word_count(text):
    return len(re.findall(r"[^\W_]+(?:['’][^\W_]+)*", text, re.UNICODE))


def utf16_length(text):
    return len(text.encode("utf-16-le")) // 2


def validate_text(text):
    if not isinstance(text, str) or not text.strip():
        raise DetectorError("INVALID_INPUT", "Enter some text before analyzing.")
    if utf16_length(text) > 15000:
        raise DetectorError("INVALID_INPUT", "Please keep your text within 15,000 characters.")
    if word_count(text) < 50:
        raise DetectorError("INVALID_INPUT", "Please enter at least 50 words for a more reliable analysis.")


def supported_length(tokenizer, config):
    # HF's enormous model_max_length is a sentinel, not a context limit.
    candidates = [getattr(tokenizer, "model_max_length", None), getattr(config, "max_position_embeddings", None)]
    limits = [int(value) for value in candidates if isinstance(value, (int, float)) and 2 < value < 1_000_000]
    if not limits:
        raise DetectorError("MODEL_CONFIG", "Detection unavailable: the model's context limit is unknown.")
    return min(limits)


def make_chunks(text, tokenizer, context_length):
    """Partition ALL tokens with no overlap/truncation. Prefer paragraph/sentence
    boundaries in the latter half of each window, then whitespace. Only oversized
    words need subword splits. Original spans use UTF-16 units, matching JS.
    """
    encoded = tokenizer(text, add_special_tokens=False, truncation=False, return_offsets_mapping=True, verbose=False)
    ids, offsets = encoded["input_ids"], encoded["offset_mapping"]
    capacity = context_length - tokenizer.num_special_tokens_to_add(pair=False)
    if capacity < 1 or not ids or len(ids) != len(offsets):
        raise DetectorError("TOKENIZATION", "Detection unavailable: the text could not be tokenized.")
    paragraphs = {match.end() for match in re.finditer(r"\n\s*\n", text)}
    sentences = {match.end() for match in re.finditer(r"[.!?][\"'’”)]*\s+", text)}
    def boundary_set(positions):
        ordered = sorted(positions)
        boundaries = set()
        for i in range(1, len(ids)):
            candidate = bisect_left(ordered, offsets[i - 1][1])
            if candidate < len(ordered) and ordered[candidate] <= offsets[i][0]:
                boundaries.add(i)
        return boundaries
    paragraph_ends, sentence_ends = boundary_set(paragraphs), boundary_set(sentences)
    chunks, start = [], 0
    while start < len(ids):
        end = min(start + capacity, len(ids))
        if end < len(ids):
            lower = start + max(1, capacity // 2)
            preferred = [i for i in paragraph_ends if lower <= i <= end]
            if not preferred:
                preferred = [i for i in sentence_ends if lower <= i <= end]
            if not preferred:
                preferred = [i for i in range(lower, end + 1) if text[offsets[i - 1][1]:offsets[i][0]].isspace()
                             or (offsets[i][0] > 0 and text[offsets[i][0] - 1].isspace())]
            if preferred:
                end = max(preferred)
        char_start = 0 if start == 0 else offsets[start][0]
        char_end = len(text) if end == len(ids) else offsets[end][0]
        chunks.append({"ids": ids[start:end], "tokenStart": start, "tokenEnd": end,
                       "startCharacter": utf16_length(text[:char_start]), "endCharacter": utf16_length(text[:char_end])})
        start = end
    return chunks


def summarize_scores(chunks, words):
    if not chunks or any(not math.isfinite(chunk["aiProbability"]) or not 0 <= chunk["aiProbability"] <= 100
                         or chunk["tokenCount"] <= 0 for chunk in chunks):
        raise DetectorError("MODEL_OUTPUT", "Detection unavailable: the model returned an invalid probability.")
    total = sum(chunk["tokenCount"] for chunk in chunks)
    score = sum(chunk["aiProbability"] * chunk["tokenCount"] for chunk in chunks) / total
    classification = "Human Likely" if score <= 35 else "AI Likely" if score >= 65 else "Mixed / Uncertain"
    distance = abs(score - 50)
    spread = max(chunk["aiProbability"] for chunk in chunks) - min(chunk["aiProbability"] for chunk in chunks)
    confidence = "Low" if words < 100 or distance < 15 or spread > 40 else "High" if distance >= 35 else "Moderate"
    return score, classification, confidence


class DactylDetector:
    def __init__(self):
        self.model = self.tokenizer = self.torch = self.context_length = None

    def load(self, status, progress=lambda _: None):
        if self.model is not None:
            return
        status("loading", "Loading detection model...")
        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
        except (ImportError, OSError) as error:
            message = ("ProofGPT's detection engine could not be started. Try reinstalling ProofGPT." if FROZEN else
                       "Python detected, but detector dependencies could not load. Install detector/requirements.txt in the developer environment.")
            raise DetectorError("DEPENDENCIES", message) from error
        snapshot = download_model(status, progress)
        try:
            status("loading", "Loading detection model...")
            torch.set_num_threads(min(4, os.cpu_count() or 1))
            torch.use_deterministic_algorithms(True)
            tokenizer = AutoTokenizer.from_pretrained(snapshot, use_fast=True, local_files_only=True, trust_remote_code=False)
            model = AutoModelForSequenceClassification.from_pretrained(snapshot, local_files_only=True, trust_remote_code=False, use_safetensors=True)
            # Verified upstream single-logit semantics. Do not guess generic labels.
            if model.config.num_labels != 1 or model.config.id2label != {0: "LABEL_0"}:
                raise DetectorError("MODEL_LABELS", "Detection unavailable: the model labels do not match the verified DACTYL configuration.")
            model.to("cpu").eval()
            context_length = supported_length(tokenizer, model.config)
            self.torch, self.tokenizer, self.model, self.context_length = torch, tokenizer, model, context_length
            diagnostic(model=MODEL_NAME, revision=MODEL_REVISION, id2label=model.config.id2label,
                       output="sigmoid(single logit) = P(AI); P(human) = 1 - P(AI)", contextLength=context_length)
        except DetectorError:
            raise
        except Exception as error:
            raise DetectorError("MODEL_LOAD", "The detection model could not be loaded. Check available memory or clear the model cache and retry.") from error

    def analyze(self, text, status=lambda *_: None, progress=lambda _: None):
        validate_text(text)
        self.load(status, progress)
        started = time.perf_counter()
        try:
            chunks = make_chunks(text, self.tokenizer, self.context_length)
            results = []
            with self.torch.inference_mode():
                for index, chunk in enumerate(chunks):
                    status("analyzing", f"Analyzing text ({index + 1} of {len(chunks)})...")
                    inputs = self.tokenizer.prepare_for_model(chunk["ids"], add_special_tokens=True,
                        truncation=False, return_tensors="pt", return_attention_mask=True, prepend_batch_axis=True)
                    if inputs["input_ids"].ndim != 2 or inputs["input_ids"].shape[0] != 1:
                        raise DetectorError("TOKENIZATION", "Detection unavailable: tokenized input has an invalid batch shape.")
                    if inputs["input_ids"].shape[-1] > self.context_length:
                        raise DetectorError("TOKENIZATION", "Detection unavailable: a text chunk exceeds the model context.")
                    logits = self.model(**inputs).logits
                    if tuple(logits.shape) != (1, 1) or not self.torch.isfinite(logits).all():
                        raise DetectorError("MODEL_OUTPUT", "Detection unavailable: the model returned malformed output.")
                    probability = self.torch.sigmoid(logits[0, 0]).item() * 100
                    results.append({key: value for key, value in chunk.items() if key != "ids"} |
                                   {"tokenCount": len(chunk["ids"]), "aiProbability": probability})
            words = word_count(text)
            score, classification, confidence = summarize_scores(results, words)
            ai = round(score, 2)
            duration = round((time.perf_counter() - started) * 1000)
            diagnostic(model=MODEL_NAME, chunks=len(results), chunkProbabilities=[chunk["aiProbability"] for chunk in results],
                       finalProbability=score, inferenceDurationMs=duration)
            observations = [
                f"The pretrained classifier analyzed {len(results)} text chunk{'s' if len(results) != 1 else ''}, covering all {sum(c['tokenCount'] for c in results)} content tokens.",
                "The document score is the token-weighted average of the model's chunk scores; no writing-style rules change it.",
                (f"Chunk AI scores range from {min(c['aiProbability'] for c in results):.2f}% to {max(c['aiProbability'] for c in results):.2f}%."
                 if len(results) > 1 else f"The model assigned this text an AI score of {ai:.2f}%."),
                ("This sample has fewer than 100 words, so confidence is reduced."
                 if words < 100 else "Confidence describes the decisiveness and consistency of model output, not certainty about the author."),
            ]
            return {"aiProbability": ai, "humanProbability": round(100 - ai, 2), "classification": classification,
                    "confidence": confidence, "wordCount": words, "characterCount": utf16_length(text),
                    "sentenceCount": len([part for part in re.split(r'(?<=[.!?])\s+|\n\s*\n', text) if re.search(r'\w', part)]),
                    "chunksAnalyzed": len(results), "chunks": results, "modelName": MODEL_NAME, "modelRevision": MODEL_REVISION,
                    "detectorVersion": "dactyl-ml-v1", "observations": observations, "inferenceDurationMs": duration}
        except DetectorError:
            raise
        except Exception as error:
            raise DetectorError("INFERENCE", "Detection unavailable: local model inference failed. Please try again or restart ProofGPT.") from error


output_lock = threading.Lock()


def emit(message):
    # The cache monitor runs on a thread; keep each protocol line atomic.
    with output_lock:
        print(json.dumps(message, ensure_ascii=True, allow_nan=False), flush=True)


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:] == ["--runtime-info"]:
        # Fixed build-time diagnostic, never accepts submitted text as arguments.
        import platform
        import struct
        import torch
        import tokenizers
        import safetensors.torch
        import sentencepiece
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        from transformers.models.deberta_v2.modeling_deberta_v2 import DebertaV2ForSequenceClassification
        emit({"frozen": FROZEN, "executable": sys.executable, "python": platform.python_version(),
              "bits": struct.calcsize("P") * 8, "torch": torch.__version__, "cuda": torch.version.cuda,
              "model": MODEL_NAME, "revision": MODEL_REVISION})
        return
    detector = DactylDetector()
    for line in sys.stdin:
        request_id = None
        try:
            if len(line) > 200_000:
                raise DetectorError("INVALID_INPUT", "Detection request is too large.")
            request = json.loads(line)
            if not isinstance(request, dict):
                raise DetectorError("INVALID_REQUEST", "Invalid detection request.")
            request_id = request.get("id")
            if not isinstance(request, dict) or not isinstance(request_id, str) or request.get("method") not in {"analyze", "download_model"}:
                raise DetectorError("INVALID_REQUEST", "Invalid detection request.")
            status = lambda phase, message: emit({"id": request_id, "type": "status", "phase": phase, "message": message})
            progress = lambda metrics: emit({"id": request_id, "type": "download_progress", **metrics})
            if request["method"] == "download_model":
                download_model(status, progress, request.get("repair") is True)
                if request.get("repair") is True:
                    detector = DactylDetector()  # Don't retain an earlier corrupt in-memory model.
                emit({"id": request_id, "type": "model_ready", "model": {"name": MANIFEST["model"], "revision": MANIFEST["revision"], "cachedBytes": TOTAL_BYTES}})
            else:
                result = detector.analyze(request.get("text"), status, progress)
                emit({"id": request_id, "type": "result", "result": result})
        except DetectorError as error:
            diagnostic(error=error.code, detail=repr(error.__cause__))
            emit({"id": request_id, "type": "error", "code": error.code, "message": str(error)})
        except Exception:
            emit({"id": request_id, "type": "error", "code": "INTERNAL", "message": "Detection unavailable: an unexpected detector error occurred."})


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
