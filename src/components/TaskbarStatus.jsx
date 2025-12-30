import { NotificationCenter } from './NotificationCenter'

export function TaskbarStatus({ panelRootRef }) {
  return (
    <div className="taskbar-status" aria-label="System status">
      <span className="taskbar-status-icon" title="Wi-Fi">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1.4 9a16 16 0 0 1 21.2 0" />
          <path d="M5 12.5a11 11 0 0 1 14.1 0" />
          <path d="M8.6 16.1a6 6 0 0 1 6.8 0" />
          <path d="M12 20h.01" />
        </svg>
      </span>
      <NotificationCenter panelRootRef={panelRootRef} />
      <span className="taskbar-status-icon" title="Volume">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 5L6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 4.9a10 10 0 0 1 0 14.2" />
        </svg>
      </span>
    </div>
  )
}
