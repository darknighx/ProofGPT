# Model integration evidence

Model: [ShantanuT01/dactyl-ai-text-detector](https://huggingface.co/ShantanuT01/dactyl-ai-text-detector), pinned revision `b62b403cb6c5c14751b5b98b474e5f662b41cef9`.

## Label mapping: one logit, not two classes

The actual [configuration](https://huggingface.co/ShantanuT01/dactyl-ai-text-detector/blob/b62b403cb6c5c14751b5b98b474e5f662b41cef9/config.json) exposes `id2label = {0: "LABEL_0"}` and `num_labels = 1`. `LABEL_0` is the name of the **only output neuron**, not a statement that class zero is human.

The author's repository at commit `4e7c9df09448dac78737bdb040d55cfc2837ab2e` provides the semantics:

- [train_detector.py](https://github.com/ShantanuT01/DACTYL/blob/4e7c9df09448dac78737bdb040d55cfc2837ab2e/training/train_detector.py) creates `num_labels=1`, trains against `target`, and explicitly selects `target == 0` as human text.
- [training README](https://github.com/ShantanuT01/DACTYL/blob/4e7c9df09448dac78737bdb040d55cfc2837ab2e/training/README.md) configures `apply_sigmoid: true`.
- [evaluate_detector.py](https://github.com/ShantanuT01/DACTYL/blob/4e7c9df09448dac78737bdb040d55cfc2837ab2e/training/evaluate_detector.py) uses the `LABEL_0` pipeline score as the positive-class prediction against `target`.

Consequently `P(AI) = sigmoid(logits[0, 0])`, and `P(human) = 1 - P(AI)`. Applying softmax to one logit would incorrectly yield 100% for every text. ProofGPT checks the pinned model's output shape and labels; an unexpected configuration is an error, not a guessed mapping.

## Context and coverage

The tokenizer declares a sentinel length (~1e30). The model has `max_position_embeddings = 512`. The effective limit is the minimum finite supported limit: 512 total tokens, including `[CLS]` and `[SEP]`, leaving 510 content tokens.

The complete text is tokenized once with no truncation. Contiguous, non-overlapping chunks prefer paragraph boundaries, then sentence boundaries, in the latter half of the available window. Otherwise they use a word boundary; an oversized word is split at a subword-token boundary. Every content token appears exactly once. There is no rewriting, normalizing by the app, summarization, overlap, or dropped suffix. The tokenizer's standard normalization still applies. UTF-16 character spans and token spans are retained with every chunk for future highlighting.

Document AI probability = `sum(chunk_probability * content_token_count) / sum(content_token_count)`. Special tokens do not count toward weights. Keep full chunk precision; round only the displayed document probabilities to two decimals. Thresholds apply to the unrounded aggregate: <=35 Human Likely, >=65 AI Likely, otherwise Mixed / Uncertain.

Confidence describes output decisiveness, not validated authorship accuracy. It is Low for <100 words, distance from 50 below 15, or a chunk score range >40 percentage points. Otherwise distance >=35 is High, and the rest Moderate. Submissions below 50 words are rejected with the existing warning.

## Runtime and limitations

CPU float32, `model.eval()`, `torch.inference_mode()`, deterministic algorithms, up to four CPU threads. One local detector subprocess and one loaded model per app session. Installed builds bundle the interpreter and CPU libraries with PyInstaller onedir; development uses source Python. Nothing is trained. No heuristic score, hidden fallback, remote inference, or text-bearing network request exists.

The weight file is 1,740,300,340 bytes (~1.74 GB / 1.62 GiB); runtime memory is higher. Installed users only need internet for the first model download; runtime libraries are included. The model is cached in Electron userData, outside the installation directory. Cached inference can run offline. First load and long documents can be slow on CPU.

The model card notes domain/threshold sensitivity. Scores are classifier outputs, not calibrated proof of authorship, and document aggregation is an application policy rather than a separately validated document model. Sentence statistics use punctuation/paragraph splitting and can miscount abbreviations. A small regression set is not an accuracy benchmark.

Human test fixtures are public-domain opening excerpts from Jane Austen's *Pride and Prejudice* (1813) and H. G. Wells's *The War of the Worlds* (1898), retrieved from the source URLs recorded in `tests/fixtures/samples.json`. They are authentic human texts, but historical fiction does not represent all modern writing. The AI samples are synthetic regression fixtures containing no personal records. No test text is seeded into the UI or used to tune weights or thresholds.
