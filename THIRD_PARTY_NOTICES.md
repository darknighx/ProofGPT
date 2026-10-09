# Third-party attribution

This notice describes third-party materials used by ProofGPT. It does not select a license for ProofGPT's own source or change any upstream terms. Dependencies, model weights and fixtures retain their respective copyright and license notices.

## Detection model

ProofGPT uses [ShantanuT01/dactyl-ai-text-detector](https://huggingface.co/ShantanuT01/dactyl-ai-text-detector), by the DACTYL authors, at revision `b62b403cb6c5c14751b5b98b474e5f662b41cef9`. Its official model card identifies the model as MIT licensed and based on [microsoft/deberta-v3-large](https://huggingface.co/microsoft/deberta-v3-large), whose model card also identifies MIT licensing.

- DACTYL source: [ShantanuT01/DACTYL](https://github.com/ShantanuT01/DACTYL).
- DACTYL retained copyright/license: [DACTYL-MIT.txt](docs/licenses/DACTYL-MIT.txt), copied unchanged from the upstream [license at commit 4e7c9df](https://github.com/ShantanuT01/DACTYL/blob/4e7c9df09448dac78737bdb040d55cfc2837ab2e/LICENSE).
- DeBERTa retained copyright/license: [DeBERTa-MIT.txt](docs/licenses/DeBERTa-MIT.txt), copied unchanged from the [Microsoft DeBERTa license](https://github.com/microsoft/DeBERTa/blob/master/LICENSE).
- Research attribution: Shantanu Thorat and Andrew Caines, *DACTYL: Diverse Adversarial Corpus of Texts Yielded from Large Language Models* (2025), [arXiv:2508.00619](https://arxiv.org/abs/2508.00619).

The source repository includes only model identifiers, metadata and integration code. Model weights are downloaded separately from official Hugging Face hosting and excluded from Git. Upstream model terms continue to apply to the downloaded files.

## Software dependencies

The following are principal dependencies and build tools; this is an attribution overview, not a replacement for their complete licenses or transitive dependency notices.

| Component | Upstream | License |
| --- | --- | --- |
| Electron | [electron/electron](https://github.com/electron/electron) | MIT |
| React | [facebook/react](https://github.com/facebook/react) | MIT |
| TypeScript | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
| Tailwind CSS | [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | MIT |
| Lucide | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | ISC |
| Vite | [vitejs/vite](https://github.com/vitejs/vite) | MIT |
| PyTorch | [pytorch/pytorch](https://github.com/pytorch/pytorch) | BSD-3-Clause |
| Transformers | [huggingface/transformers](https://github.com/huggingface/transformers) | Apache-2.0 |
| Hugging Face Hub | [huggingface/huggingface_hub](https://github.com/huggingface/huggingface_hub) | Apache-2.0 |
| Playwright | [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 |
| electron-builder | [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) | MIT |
| PyInstaller | [pyinstaller/pyinstaller](https://github.com/pyinstaller/pyinstaller) | GPL-2.0-or-later with its distribution/bootloader exception |

Exact Node dependencies are recorded in `package-lock.json`; detector and build requirements are pinned in `detector/requirements.txt` and `detector/build-requirements.txt`. The bundled runtime also contains CPython and other native/transitive libraries, which retain their own terms. When distributing generated binaries, preserve the complete applicable upstream notices included with those components; this source-repository overview is not an exhaustive binary license inventory.

## Regression fixtures and assets

`detector/tests/fixtures/samples.json` includes two synthetic AI-generated samples and opening excerpts from Jane Austen's *Pride and Prejudice* (1813) and H. G. Wells's *The War of the Worlds* (1898). Source URLs are retained with the excerpts. These fixtures contain no personal analyses and are used for regression checks, not an accuracy benchmark.

`detector/tests/RESULTS.json` is the checked-in, nonprivate regression baseline required by several test scripts. It is not user History or application seed data.

The ProofGPT PNG/ICO assets are the owner's approved application artwork. The screenshots are captures of the real application in isolated test profiles, with empty states or a labeled synthetic sample. A future project license should state its scope without overriding third-party material.
