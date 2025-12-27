function WindowControlButton({ label, onClick, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.stopPropagation()}
      aria-label={label}
      className={className}
    >
      {children}
    </button>
  )
}

export function DesktopWindow({
  appWindow,
  style,
  onFocus,
  onDragStart,
  onMinimize,
  onMaximize,
  onClose
}) {
  return (
    <div
      className={`desktop-window ${appWindow.isMaximized ? 'is-maximized' : ''}`}
      style={style}
      onMouseDown={onFocus}
    >
      <div className="window-titlebar" onMouseDown={onDragStart}>
        <div className="window-title">{appWindow.title}</div>
        <div className="window-controls">
          <WindowControlButton
            label="Minimize window"
            onClick={onMinimize}
            className="window-control-button"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <line x1="3" y1="12" x2="13" y2="12" />
            </svg>
          </WindowControlButton>
          <WindowControlButton
            label={appWindow.isMaximized ? 'Restore window' : 'Maximize window'}
            onClick={onMaximize}
            className="window-control-button"
          >
            {appWindow.isMaximized ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="5" width="8" height="8" rx="1" />
                <path d="M6 3h7v7" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            )}
          </WindowControlButton>
          <WindowControlButton
            label="Close window"
            onClick={onClose}
            className="window-control-button is-close"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </WindowControlButton>
        </div>
      </div>
      <div className="window-body">
        <div className="window-empty">No content yet.</div>
      </div>
    </div>
  )
}
