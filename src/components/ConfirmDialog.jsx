export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel
}) {
  return (
    <div className="confirm-dialog">
      <div className="confirm-dialog-title">{title ?? 'Confirm'}</div>
      <div className="confirm-dialog-text">{message}</div>
      <div className="confirm-dialog-actions">
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'is-danger' : 'is-primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
