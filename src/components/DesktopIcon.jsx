export function DesktopIcon({
  label,
  onClick,
  onDoubleClick,
  onMouseDown,
  style,
  className,
  children
}) {
  return (
    <button
      className={`desktop-icon ${className ?? ''}`.trim()}
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      style={style}
    >
      {children}
      <span className="icon-label">{label}</span>
    </button>
  )
}
