import { getAppDefinition } from '../apps/registry'
import { TaskbarStatus } from './TaskbarStatus'

export function Taskbar({ windows, onToggleMinimize, onBringToFront, panelRootRef }) {
  return (
    <div className="taskbar">
      <button className="start-button" type="button" aria-label="Start">
        <img src="/detective-face.svg" alt="" aria-hidden="true" />
      </button>
      <div className="taskbar-windows">
        {windows.map((appWindow) => (
          <button
            key={appWindow.id}
            className={`taskbar-window ${
              appWindow.isMinimized ? 'is-minimized' : 'is-active'
            }`}
            type="button"
            onClick={() => {
              onToggleMinimize(appWindow.id)
              onBringToFront(appWindow.id)
            }}
          >
            <span className="taskbar-window-icon">
              {getAppDefinition(appWindow.type)?.taskbarLabel ?? 'APP'}
            </span>
            <span className="taskbar-window-label">{appWindow.title}</span>
          </button>
        ))}
      </div>
      <div className="taskbar-icons" aria-hidden="true">
        <div className="taskbar-icon app-green">NB</div>
        <div className="taskbar-icon app-slate">DM</div>
      </div>
      <TaskbarStatus panelRootRef={panelRootRef} />
    </div>
  )
}
