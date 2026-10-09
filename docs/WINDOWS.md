# Windows installation and bundled detector

Install `ProofGPT-Setup-<package-version>-x64.exe`, then open ProofGPT. The installer includes the Python runtime and CPU ML libraries inside `resources/detector-runtime`. End users do not install Python or run a setup helper. NSIS retains per-user installation, destination choice, desktop/Start Menu shortcuts, and app data on uninstall.

The first valid analysis downloads the pinned DACTYL model (~1.74 GB), or use Settings → Detection Model → Download Model to prepare it first. Downloaded/total size, percentage and actual speed update about once per second, without a progress bar. Navigation does not interrupt the shared download; analysis joins an active download and continues automatically. Retry Download keeps valid partial downloads. Subsequent sessions detect and reuse `%APPDATA%\ProofGPT\model-cache\hub` without a network check; a custom Electron profile uses its own model-cache folder. No downloaded weights are stored inside Program Files or the app installation. The complete cache enables offline inference. Allow several GB of free disk space/RAM; CPU inference may be slow.

## Recovery

- Engine could not start: reinstall ProofGPT to restore missing/damaged bundled runtime files.
- Model could not download: check internet/free disk space and retry.
- Model could not load: close memory-intensive applications and restart. If the cache is damaged, close ProofGPT and remove only `model-cache\hub\models--ShantanuT01--dactyl-ai-text-detector` inside the active app-data profile. Retry online to download again. Preserve History/settings.
- Storage error: check app-data permissions/free space. Damaged History/settings files are preserved; back them up before recovery.
- Help opens `resources\README.md` with the associated document reader; use a text editor if no reader is associated.
- Reset/clear/uninstall retain model cache and exports. No secure erasure is promised.

## Developer build

Follow Development in README for compatible x64 Python and CPU PyTorch, then:

```powershell
npm run dist:win
```

This builds/verifies PyInstaller's onedir detector, builds the React/Electron app, and packages NSIS x64. Outputs are `release/ProofGPT-Setup-<version>-x64.exe` and `release/win-unpacked/ProofGPT.exe`. Packaging fails if the runtime is missing. Setup helpers, source detector, developer discovery, model weights, test fixtures, and user records are not shipped.

`npm run check:package` verifies package/resources/window controls. `npm run test:release` exercises the packaged detector in a profile with system Python unavailable; `PROOFGPT_TEST_EXE` can select an installed copy for that test only. Test profiles are isolated from normal app data.

The approved PNG/ICO assets and Windows icon configuration are preserved for window, executable, installer, and uninstaller. Shortcuts/taskbar pins may retain Windows' icon cache. No signing certificate is supplied; Windows may warn about the unsigned publisher. Builds do not publish automatically.
