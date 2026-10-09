export type HelpCategoryId = 'getting-started' | 'ai-detection' | 'history' | 'reports' | 'settings' | 'privacy' | 'troubleshooting';
export type HelpIcon = 'book' | 'detector' | 'history' | 'reports' | 'settings' | 'privacy' | 'tools' | 'file' | 'download' | 'clock';
export interface HelpCategory { id: HelpCategoryId; title: string; description: string; icon: HelpIcon }
export interface HelpArticle {
  id: string; title: string; description: string; categories: HelpCategoryId[]; icon: HelpIcon;
  paragraphs: string[]; steps?: string[]; bullets?: string[];
}
export interface HelpFAQ { id: string; question: string; answer: string; categories: HelpCategoryId[] }

// Content describes implemented behavior. It is never analysis data or a support-service claim.
export const helpCategories: HelpCategory[] = [
  { id: 'getting-started', title: 'Getting Started', description: 'Learn the basics', icon: 'book' },
  { id: 'ai-detection', title: 'Using the AI Detector', description: 'Understand results', icon: 'detector' },
  { id: 'reports', title: 'Reports', description: 'View and export results', icon: 'reports' },
  { id: 'settings', title: 'Settings', description: 'Customize your experience', icon: 'settings' },
  { id: 'history', title: 'History', description: 'Manage saved analyses', icon: 'history' },
  { id: 'privacy', title: 'Privacy & Data', description: 'Your text and local storage', icon: 'privacy' },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'Fix common issues', icon: 'tools' },
];

export const helpArticles: HelpArticle[] = [
  {
    id: 'analyze-text', title: 'How to analyze text for AI content', description: 'Step-by-step guide to using the AI Detector.',
    categories: ['getting-started', 'ai-detection'], icon: 'file',
    paragraphs: ['Use at least 50 words and no more than 15,000 characters. Longer passages generally provide a more meaningful signal than very short samples. Samples under 100 words always receive Low confidence.'],
    steps: ['Open Home or AI Detector from the sidebar. Both open the same text-analysis workflow.', 'Paste or type your text into the large text box.', 'Click Analyze Text.', 'ProofGPT includes its detection runtime. On first use, allow approximately 1.74 GB of model files to download. Live text shows downloaded size, percentage and actual speed; the model is then cached locally. You can also download it ahead of time in Settings → Detection Model.', 'Review AI probability, Human probability, classification, and confidence in the result.'],
  },
  {
    id: 'understand-results', title: 'Understanding your results', description: 'Learn what probability and confidence mean.',
    categories: ['ai-detection'], icon: 'reports',
    paragraphs: ['ProofGPT uses the pretrained DACTYL AI Text Detector to estimate how much text resembles AI-generated writing. AI probability is a model estimate; Human probability is its complement. Neither score proves who wrote the text. False positives and false negatives can occur, so use results as indicators alongside context and other evidence.', 'Confidence describes how decisive and consistent the model output was. Low, Moderate, and High are model-output labels, not certainty that a classification is correct. Short samples and inconsistent chunk scores can lower confidence. High confidence does not mean ProofGPT is definitely correct.'],
    bullets: ['Human Likely: stronger signals associated with human-written text (AI probability at or below 35%).', 'Mixed / Uncertain: no strong signal in either direction (AI probability above 35% and below 65%). It does not identify which sentences or authors contributed.', 'AI Likely: stronger signals associated with AI-generated text (AI probability at or above 65%).', 'Even a displayed 0% or 100% can be a rounded model score, not proof of authorship or academic misconduct.'],
  },
  {
    id: 'manage-history', title: 'Managing your history', description: 'Reopen, search, filter, or delete saved analyses.',
    categories: ['history', 'privacy'], icon: 'history',
    paragraphs: ['Successful analyses are saved locally when Settings → Save analyses to History is enabled. Failed analyses do not create records. Each saved record includes the original text, timestamp, and real detector result.', 'Open History to search the full submitted text or filter by All, AI Likely, Mixed / Uncertain, or Human Likely. Open a record to review its saved text and result without running the model again.', 'Delete removes one record; Clear History removes all saved records after confirmation. Turning saving off preserves existing records but prevents future successful analyses from entering History and Reports.'],
  },
  {
    id: 'export-reports', title: 'Exporting reports', description: 'Summarize and export your saved analysis results.',
    categories: ['reports', 'history'], icon: 'download',
    paragraphs: ['Reports uses saved History data to show total analyses, AI Likely and Human Likely counts, average AI probability, classification distribution, and a chronological probability trend. With no saved analyses, it shows an empty state.', 'Search, classification, and date-range filters apply to statistics, charts, and aggregate exports. Newest/Oldest First changes the recent table order. Row and chart actions reopen the saved History detail.', 'Export CSV or Export JSON opens a native Save dialog. Aggregate exports include all matching records, even when only eight recent rows are visible. Each row’s download uses the default export format in Settings. Canceling the dialog creates no file.', 'CSV includes the original text and analysis fields. JSON includes complete saved results; Include chart data in JSON controls distribution and trend datasets. PDF export is not currently available.'],
  },
  {
    id: 'change-settings', title: 'Changing app settings', description: 'Choose warnings, result details, and export options.',
    categories: ['settings'], icon: 'settings',
    paragraphs: ['Settings changes save automatically when the local write succeeds. Dark is the currently supported theme and English is the currently supported language. Start-up selects Home, History, Reports, or Settings for the next launch. Preferences change presentation and storage, not detection scores.'],
    bullets: ['Short text warning: show an advisory for 50–99 words. The mandatory 50-word minimum remains.', 'Analysis detail level: Standard or Detailed. Detailed shows the actual model, inference time, and recorded chunk scores.', 'Include Explanations: show or hide the recorded result explanation.', 'Save analyses to History: control saving of future successful analyses.', 'Default export format: CSV or JSON for individual report downloads. Include chart data in JSON controls exported distribution and trend data.', 'Clear History: confirm removal of all saved analyses; Reports updates too.', 'Restore Defaults: confirm restoration of preferences while keeping History and the current Home input/result.', 'Reset ProofGPT Data: type RESET and confirm to clear History, restore preferences, and clear current Home input/results. The bundled detection engine, downloaded model, and exported files are kept. Wait for an active analysis to finish before resetting.'],
  },
  {
    id: 'private-data', title: 'Is my data private?', description: 'Learn about local analysis and saved text.',
    categories: ['privacy'], icon: 'privacy',
    paragraphs: ['Text classification runs on this device in the bundled detection engine. The renderer sends text to the local Electron process and detector worker; it does not send submitted text to an external AI classification API.', 'The first use downloads model files from Hugging Face. This downloads the model rather than uploading your text for inference. Once the complete model is cached locally, analysis can run offline.', 'History includes full submitted text and is stored as local JSON in the ProofGPT application-data folder. On Windows the default file is %APPDATA%\\ProofGPT\\history.json. An explicitly selected application profile can use a different location. Settings are stored beside it in settings.json.', 'Local storage is not encrypted by ProofGPT: people or software with access to those files may read them. Disabling History saving prevents new successful analyses from being saved, and does not remove existing records. Use confirmed deletion or Clear History for those records. Exported files are separate and are not deleted by clearing or resetting app data.'],
  },
  {
    id: 'detector-load', title: 'Detector will not load', description: 'Check the detection engine, connection, and model cache.',
    categories: ['troubleshooting', 'ai-detection'], icon: 'tools',
    paragraphs: ['ProofGPT includes its detection runtime. Read the error shown under the text box. If the detection engine could not be started, reinstall ProofGPT to repair its bundled files.', 'If the model download was interrupted, reconnect to the internet and try again. Allow several GB of free disk space and RAM; the model weights alone are about 1.74 GB. Settings → Detection Model shows live downloaded size, percentage and speed. Use Retry Download after a failure; valid partial downloads are retained.', 'If the model cannot load, close other memory-intensive applications and restart ProofGPT. For a damaged model cache, close ProofGPT and remove only model-cache\\hub\\models--ShantanuT01--dactyl-ai-text-detector inside its application-data folder (normally %APPDATA%\\ProofGPT). A custom application profile uses its own model-cache folder. The next valid analysis downloads the pinned model again. Keep history.json and settings.json to preserve saved data.'],
  },
  {
    id: 'slow-analysis', title: 'Why the first analysis is slow', description: 'Model downloads, memory loading, and CPU work.',
    categories: ['troubleshooting', 'getting-started', 'ai-detection'], icon: 'clock',
    paragraphs: ['Use Settings → Detection Model → Download Model to prepare the model ahead of time. Home and Settings share one download, which continues when you navigate. An analysis requested during that download waits and continues automatically. The first analysis may download the model and load its weights into memory. Even with a cached model, the first analysis after launching the app needs to load it. Subsequent analyses reuse the running model.', 'CPU inference takes time, especially for long text processed in multiple chunks. Wait while the Analyze Text button shows progress. If an error appears, follow that message and the model-load troubleshooting article. No fixed completion time is guaranteed.'],
  },
  {
    id: 'analyze-button', title: 'Analyze Text does not start', description: 'Check input validation and loading messages.',
    categories: ['troubleshooting', 'getting-started'], icon: 'detector',
    paragraphs: ['Enter at least 50 words, up to the 15,000-character limit. Empty or shorter input shows a validation error near the text box. A 50–99-word advisory is informational; it does not block analysis.', 'If the button shows Analyzing…, a request is already running. Wait for the loading status or result; repeated clicks do not start duplicate work. Check any displayed detection engine, download, or model error.', 'Launch an installed copy from its ProofGPT shortcut. A regular browser preview cannot access the Electron detector bridge. Developers can follow the separate Development section in the project documentation.'],
  },
  {
    id: 'history-not-saving', title: 'History is not saving', description: 'Check the saving preference and local write errors.',
    categories: ['troubleshooting', 'history', 'settings'], icon: 'history',
    paragraphs: ['Check Settings → Save analyses to History. When it is off, new results still appear on Home but are not added to History or Reports. Only successful detector results can be saved.', 'If saving fails, Home shows the actual result with a storage warning. Check that the application-data folder is writable and the disk has free space. Damaged history.json files are preserved and reported instead of silently overwritten; back up the file before attempting recovery.', 'If History cannot be loaded, use its Try again action after resolving the displayed error. See the project documentation for storage details. Clearing History or resetting data is destructive and requires confirmation; it is not needed simply to enable future saving.'],
  },
];

export const helpFAQs: HelpFAQ[] = [
  { id: 'accuracy', question: 'Is ProofGPT 100% accurate?', categories: ['ai-detection'], answer: 'No. False positives and false negatives can occur. Model probabilities and confidence are estimates, not guarantees. Interpret them with the writing context and other evidence.' },
  { id: 'proof', question: 'Can ProofGPT prove that someone used AI?', categories: ['ai-detection'], answer: 'No. ProofGPT estimates patterns associated with AI-generated writing. It cannot establish authorship or prove academic misconduct, even when it reports high confidence or 100% AI probability.' },
  { id: 'online-text', question: 'Does ProofGPT send my text online?', categories: ['privacy'], answer: 'The app passes text to its bundled local detection engine for inference, with no external AI classification API. The model is initially downloaded from Hugging Face. Saved History includes your full text in local JSON; it is not encrypted by ProofGPT.' },
  { id: 'offline', question: 'Does ProofGPT work offline?', categories: ['privacy', 'getting-started'], answer: 'Yes, after the complete model has been downloaded and cached locally. ProofGPT includes its detection runtime. First-time model download requires an internet connection. Removing the model cache means it must be downloaded again.' },
  { id: 'first-analysis', question: 'Why does the first analysis take longer?', categories: ['troubleshooting', 'getting-started'], answer: 'The first run may download the model. The first analysis in each app session loads weights into memory; later analyses reuse the worker. CPU inference and longer passages can take additional time.' },
  { id: 'short-text', question: 'Why is very short text difficult to analyze?', categories: ['ai-detection', 'getting-started'], answer: 'Short text provides fewer patterns for the model to assess. ProofGPT requires at least 50 words and assigns Low confidence below 100 words. More text can provide a more meaningful signal, but it cannot guarantee correctness.' },
  { id: 'false-negative', question: 'Why did ProofGPT classify AI text as human?', categories: ['ai-detection'], answer: 'That can be a false negative. AI text may resemble human writing, particularly after editing or in styles the pretrained model does not distinguish well. A Human Likely result does not prove human authorship.' },
  { id: 'different-detectors', question: 'Why can two AI detectors give different results?', categories: ['ai-detection'], answer: 'Detectors can use different models, training data, text processing, and classification thresholds. Their scores need not agree and are not necessarily comparable. Disagreement does not establish which detector is correct.' },
  { id: 'history-location', question: 'Where is my History stored?', categories: ['history', 'privacy'], answer: 'History is local JSON in Electron’s ProofGPT application-data folder. On Windows the default is %APPDATA%\\ProofGPT\\history.json; settings.json is beside it. A custom --user-data-dir profile changes that location. The file is created when an analysis is first saved.' },
  { id: 'delete-history', question: 'Can I delete my saved analyses?', categories: ['history', 'settings', 'privacy'], answer: 'Yes. Delete a record from History, or use Clear History in History or Settings to remove all records after confirmation. Reports updates from the remaining saved records. Exported files are separate and remain on disk.' },
];
