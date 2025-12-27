export function DesktopIcon({ label, onClick, children }) {
  return (
    <button className="desktop-icon" type="button" onClick={onClick}>
      {children}
      <span className="icon-label">{label}</span>
    </button>
  )
}
