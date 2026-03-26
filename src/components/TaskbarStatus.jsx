import { NotificationCenter } from './NotificationCenter'
import { WifiCenter } from './WifiCenter'

export function TaskbarStatus({ panelRootRef }) {
  return (
    <div className="taskbar-status" aria-label="System status">
      <WifiCenter panelRootRef={panelRootRef} />
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
