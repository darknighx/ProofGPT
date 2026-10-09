# ProofGPT application icon

The approved **Neon Document Shield Icon.png** artwork supplies both application assets. The existing renderer vector branding and UI layout are preserved.

`icon.png` is the original 1254×1254 RGB PNG, copied unchanged. Source SHA-256: `28593ef33b44d2367a56580a65e8d43b1b97469b96806a3ff4c51fec4ad0a663`.

`icon.ico` contains 32-bit Windows bitmap frames at **16, 24, 32, 48, 64, 128, and 256 pixels**. Pillow's ICO writer uses Lanczos downsampling from the source; no crop, stretch, recoloring, or background removal is applied. The opaque background is part of the approved artwork.

Electron uses the ICO on Windows and the PNG on other development hosts. Paths resolve from the project in development and `resources/icons` in packaged builds. Windows executable, NSIS installer, and uninstaller icons are configured explicitly in `electron-builder.config.cjs`; both assets are shipped as resources.

Rebuild with `npm run dist:win`. Windows may retain an old icon for an existing shortcut or pinned taskbar entry; relaunch the new executable and recreate that shortcut/pin if needed. The application remains unsigned unless a signing certificate is configured.
