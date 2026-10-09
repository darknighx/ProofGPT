# Architecture

The Electron renderer is React/TypeScript with Tailwind and Lucide, preserving the approved desktop layout. A sandboxed preload exposes narrow context-isolated IPC. Renderer text is data, never an executable argument.

## Production inference

`electron/main.cjs` supplies `process.resourcesPath/detector-runtime/ProofGPTDetector.exe` and `app.getPath('userData')/model-cache` to DetectorClient. It launches that exact executable, no arguments, `shell: false`, hidden console, stdin/stdout pipes. It never discovers system Python or imports developer discovery code (excluded from ASAR). Inherited developer Python/cache overrides do not control production. JSON-lines input carries text; structured status/result/error lines drive existing UI. Stderr is separate and shown only during development.

The engine is PyInstaller onedir with console pipe support. `_internal` includes CPython/native modules, CPU PyTorch, selected Transformers Auto/DeBERTa-v2 imports and sources used for lazy discovery, tokenizer libraries, Hugging Face downloading, and TLS certificates. The build validates frozen/64-bit/CPU metadata without Python on PATH. A generated manifest records runtime versions/model revision/source hash. No model files or CUDA are packaged. `beforePack` rejects absent/unverified detector builds. extraResources copies the runtime outside ASAR.

DACTYL remains pinned at b62b403cb6c5c14751b5b98b474e5f662b41cef9. Initial valid analysis checks the full cached snapshot, downloads missing model files when needed, reports downloading/loading, then performs local CPU inference. The cache is user writable, persists upgrades, and supports offline operation. Submitted text is never supplied to model-download requests or any external API. No remote model code is trusted. Scoring, chunking, thresholds, and confidence are unchanged.

## Model management and progress

Electron ModelManager owns one DetectorClient and one shared download promise. A renderer-wide ModelProvider subscribes to sequenced state snapshots, preventing late startup responses from overwriting newer progress. Home and the Detection Model section in Settings render the same state. Download Model starts a text-free `download_model` JSON request. An analysis joins that promise, then sends its separate `analyze` request automatically. Repeated clicks cannot create a second download/worker. Navigation does not own or cancel the operation.

Startup checks local pinned snapshot file lengths without launching the engine or contacting a server. `shared/model-manifest.json` records exact file sizes and etags obtained from official Hugging Face metadata for the pinned revision; it is included in both ASAR and the frozen runtime. The Python cache service calls the official `hf_hub_download` for these same files/revision/cache. It reports `download_progress` JSON from a one-second monitor of the known snapshot/blob/incomplete files, taking a maximum per file to avoid counting links/copies twice. Total bytes are the manifest sum. Speed uses actual new bytes over a rolling five-second window, excluding resumed bytes from its baseline. Buffered writes can make measured speed fluctuate or temporarily reach zero. No terminal output is parsed, no speed is invented, and no progress bar is rendered.

Completed downloads are checked against HF etags (SHA256 for LFS, Git blob SHA1 for other files) before `model_ready`. Truncated files are rejected by the local check. Valid partials stay in the standard HF cache and are resumed on retry. Integrity/load failures offer explicit repair through Retry Download. User History/settings are independent; optional model removal is intentionally omitted. Loading/result/error states clear progress. Packaged production still uses only its bundled runtime and userData cache, with no system Python fallback.

Missing/damaged bundled runtime produces a reinstall message. Model download/load errors are distinct. The child is reused for later analyses, killed when closing, and responses are strictly validated. Failed analyses are not saved. Requests cannot run concurrently; timeout/cancellation remain enforced.

## Development and build

Development still launches `detector.py` through one validated Python 3.11/3.12 x64 interpreter. Python/dependency checks are source-only developer tooling. `build:detector` validates CPU torch, installs pinned build tools, runs the spec, and executes a frozen runtime diagnostic. `dist:win` builds detector before renderer/NSIS. Packaging never publishes.

## Storage and features

Versioned History and preferences JSON use atomic writes in Electron userData. Malformed records/files are reported and preserved. Home and AI Detector share the retained workflow. History opens saved details without rerunning inference. Reports derives metrics/charts/exports from filtered actual History. Settings changes presentation/saving, never scoring. Reset requires explicit confirmation and leaves model cache/exports. Help describes bundled runtime, local inference, first-use downloading, and probabilistic limitations.

No accounts, subscriptions, cloud sync, fake reports, tracking, or online detection service. Local saved text/exports are not encrypted. Uninstall preserves app data. The approved window/application/installer icons and product metadata are retained.
