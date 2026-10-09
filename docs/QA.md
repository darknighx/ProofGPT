# ProofGPT bundled-runtime QA

Source and standalone detector checks passed on Windows x64 on **2026-10-07**, in isolated profiles. Normal user History/settings were not changed.

## Completed checks

- Strict TypeScript/build, Node ESLint/syntax, Python syntax/dependency consistency, nineteen detector/cache unit tests (including partial offline snapshot rejection and measured/resumed download progress).
- Source-only Python discovery and process validation: compatible executable/version/architecture, separated dependency errors, cancellation, malformed output, crashes, duplicate requests.
- Missing bundled engine returns a reinstall message without falling back to available developer Python.
- All six source pages: Home/AI Detector, History, Reports, Settings, Help; actual inference, persistence, filters, exports, confirmed deletion/reset, responsive sizing, no renderer errors.
- Frozen standalone runtime metadata verifies Python 3.12.14 x64, torch 2.6.0+cpu, no CUDA, PyInstaller onedir. Python/python3/py/pip unavailable on PATH.
- Real standalone offline inference matches the source AI/human probability baseline exactly; native imports and model loading succeed. Cached model is reused.

## Release regression workflow

`npm run dist:win` builds and verifies the detector before React/NSIS packaging. `check:package` checks matching runtime/assets, exclusions (weights, CUDA, setup helper, developer discovery), and native window controls.

`test:release` is designed to run against win-unpacked or an installed executable selected by PROOFGPT_TEST_EXE. It creates an empty isolated profile, checks offline download failure/status without Python messages, then allows a real first-time model download. It records the OS child process path to prove ProofGPTDetector.exe is used. It checks History, Reports, preferences/restart, Help/documentation, deletion/export/clear, all six pages and three sizes, then restarts for real cached offline inference.

Python commands are removed from the test PATH, an invalid developer override/PYTHONHOME/PYTHONPATH is supplied, and production must ignore these settings. Offline tests use HF_HUB_OFFLINE=1 with unreachable HTTP/HTTPS proxy endpoints. This simulates unavailable internet/Python without uninstalling Python or disabling the computer's network. It is not a fresh Windows VM test.

Build/test logs and machine-readable results are written under artifacts/ (excluded from packaging). The installed regression result is artifacts/release-regression.json; standalone results are artifacts/standalone-regression.json. Successful runs record the exact executable/profile/cache path, download statuses, actual detector process, real probabilities, offline reuse, and app/renderer errors.

## Boundaries

The small sample set is a regression check, not an accuracy benchmark. Existing Transformers fast-tokenizer warnings can appear in developer stderr; production keeps technical logs out of the UI. Model/scoring/chunking are unchanged. The approved icon/branding are preserved. No CUDA/model weights/developer setup tool are shipped. Production uses only its bundled runtime outside ASAR; internet is needed for first model download.

The installer remains unsigned. CPU inference needs several GB of RAM/free disk space and may be slow. A fresh VM across supported Windows versions is still advisable before public distribution. The owner chooses the project source license and any signing identity; public screenshots must use isolated, nonprivate data. Builds do not publish automatically.

The optional native Xet transfer stalled during Windows first-use verification. The frozen runtime uses the Hub's standard resumable HTTP transport instead, preserving the pinned files and local inference. Xet binaries and the unused protobuf compiler are excluded. First-download timeout is 90 minutes; model loading/inference retains a 20-minute timeout. Interrupted download data is retained for retry.
