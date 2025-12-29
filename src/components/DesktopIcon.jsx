export function DesktopIcon({ label, onClick, onMouseDown, style, className, children }) {
  return (
    <button
      className={`desktop-icon ${className ?? ''}`.trim()}
      type="button"
      onClick={onClick}
      onMouseDown={onMouseDown}
      style={style}
    >
      {children}
      <span className="icon-label">{label}</span>
    </button>
  )
}
