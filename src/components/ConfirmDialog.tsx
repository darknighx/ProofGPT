import { useEffect, useRef, useState } from 'react';
import { Trash2, LoaderCircle } from 'lucide-react';

export function ConfirmDialog({ title, message, action, busy, error, onConfirm, onCancel, confirmationText }: {
  title: string; message: string; action: string; busy: boolean; error: string;
  onConfirm: () => void; onCancel: () => void;
  confirmationText?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const confirmed = !confirmationText || typedConfirmation === confirmationText;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal(); cancel.current?.focus();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="history-confirm" aria-labelledby="confirm-title" aria-describedby="confirm-message"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="confirm-icon"><Trash2 size={26} aria-hidden="true" /></div>
    <h2 id="confirm-title">{title}</h2><p id="confirm-message">{message}</p>
    {confirmationText && <label className="settings-confirm-input">Type <strong>{confirmationText}</strong> to confirm<input aria-label={`Type ${confirmationText} to confirm`} value={typedConfirmation} autoComplete="off" spellCheck={false} disabled={busy} onChange={(event) => setTypedConfirmation(event.target.value)} /></label>}
    {error && <p className="history-error" role="alert">{error}</p>}
    <div className="confirm-actions"><button ref={cancel} type="button" className="history-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" className="history-confirm-delete" disabled={busy || !confirmed} onClick={onConfirm}>{busy && <LoaderCircle className="analysis-spinner" size={16} aria-hidden="true" />}{busy ? 'Applying...' : action}</button></div>
  </dialog>;
}
