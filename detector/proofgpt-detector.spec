"""Windows x64, CPU inference, onedir. Model weights are intentionally absent."""
from pathlib import Path
from PyInstaller.utils.hooks import get_package_paths

project = Path(SPECPATH).parent
models = Path(get_package_paths("transformers")[1]) / "models"
# Auto factories dynamically select DeBERTa-v2. Exclude other architectures,
# rather than collecting every Transformers backend or optional ML framework.
excludes = ["tensorflow", "jax", "flax", "keras", "torchvision", "torchaudio", "hf_xet", "IPython", "pytest"]
# AutoModel's membership check enumerates configuration classes for every
# architecture. Those lightweight configs are required; their model/tokenizer
# implementations are not. Keep configuration modules and exclude other files.
configs = []
for folder in models.iterdir():
    if not folder.is_dir() or folder.name == "__pycache__":
        continue
    for source in folder.glob("*.py"):
        module = f"transformers.models.{folder.name}.{source.stem}"
        if source.stem.startswith("configuration_"):
            configs.append(module)
        elif folder.name not in {"auto", "deberta_v2"} and source.stem != "__init__":
            excludes.append(module)
a = Analysis(
    [str(project / "detector" / "detector.py")],
    pathex=[str(project / "detector")],
    binaries=[], datas=[(str(project / "shared" / "model-manifest.json"), "shared")],
    hiddenimports=["safetensors.torch", "sentencepiece", "google.protobuf.internal.builder"] + configs,
    hookspath=[str(project / "detector" / "hooks")],
    excludes=excludes, noarchive=False,
)
# Torch's wheel includes the protobuf compiler, which inference never executes.
for collection in (a.binaries, a.datas):
    collection[:] = [item for item in collection if not item[0].replace("\\", "/").startswith("torch/bin/")]
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [("u", None, "OPTION")],
    exclude_binaries=True, name="ProofGPTDetector", console=True,
    debug=False, strip=False, upx=False,
    icon=str(project / "build" / "icons" / "icon.ico"),
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="proofgpt-detector")
