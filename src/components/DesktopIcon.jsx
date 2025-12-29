import { forwardRef } from 'react'

export const DesktopIcon = forwardRef(function DesktopIcon(
  { label, onClick, onDoubleClick, onMouseDown, style, className, children },
  ref
) {
  return (
    <button
      ref={ref}
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
})
