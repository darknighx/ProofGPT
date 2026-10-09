"""Only DACTYL's DeBERTa-v2 and Auto factories; retain sources for lazy imports.

Transformers discovers its lazy exports by inspecting Python source files and
checks installed distribution metadata. The standard hook's collection mode is
necessary even though these files are not user-supplied remote model code.
"""
from PyInstaller.utils.hooks import copy_metadata

datas = []
for distribution in ["transformers", "torch", "numpy", "packaging", "filelock",
                     "huggingface-hub", "tokenizers", "safetensors", "sentencepiece",
                     "protobuf", "regex", "requests", "tqdm", "PyYAML"]:
    datas += copy_metadata(distribution)
module_collection_mode = "pyz+py"
hiddenimports = [
    "transformers.models.auto.configuration_auto",
    "transformers.models.auto.tokenization_auto",
    "transformers.models.auto.modeling_auto",
    "transformers.models.auto.auto_factory",
    "transformers.models.deberta_v2.configuration_deberta_v2",
    "transformers.models.deberta_v2.modeling_deberta_v2",
    "transformers.models.deberta_v2.tokenization_deberta_v2",
    "transformers.models.deberta_v2.tokenization_deberta_v2_fast",
    "transformers.convert_slow_tokenizer",
]
