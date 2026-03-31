import { getAppDefinition } from '../apps/registry'
import { TaskbarStatus } from './TaskbarStatus'

const ICON_CLASS_FILE_OVERRIDES = {
  'friend-media': 'friendmedia',
  'box-browser': 'boxbrowser'
}

const getTaskbarIconName = (appType) => {
  const appDefinition = getAppDefinition(appType)
  if (!appDefinition?.iconClass) return 'file'
  return ICON_CLASS_FILE_OVERRIDES[appDefinition.iconClass] ?? appDefinition.iconClass
}

const getTaskbarIconNameForWindow = (appWindow) => {
  const payloadIconClass =
    typeof appWindow?.payload?.taskbarIconClass === 'string'
      ? appWindow.payload.taskbarIconClass.trim()
      : ''
  if (payloadIconClass) {
    return ICON_CLASS_FILE_OVERRIDES[payloadIconClass] ?? payloadIconClass
  }
  return getTaskbarIconName(appWindow?.type)
}

export function Taskbar({
  windows,
  onToggleMinimize,
  onBringToFront,
  panelRootRef,
  iconDesign = 'classic'
}) {
  return (
    <div className="taskbar">
      <button className="start-button" type="button" aria-label="Start">
        <img src="/detective-face.svg" alt="" aria-hidden="true" />
      </button>
      <div className="taskbar-windows">
        {windows.map((appWindow) => {
          const iconName = getTaskbarIconNameForWindow(appWindow)
          return (
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
                <img
                  src={`/icons/${iconDesign}/${iconName}.svg`}
                  alt=""
                  aria-hidden="true"
                  onError={(event) => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = '/icons/classic/file.svg'
                  }}
                />
              </span>
              <span className="taskbar-window-label">{appWindow.title}</span>
            </button>
          )
        })}
      </div>
      <div className="taskbar-icons" aria-hidden="true">
        <div className="taskbar-icon app-green">NB</div>
        <div className="taskbar-icon app-slate">DM</div>
      </div>
      <TaskbarStatus panelRootRef={panelRootRef} />
    </div>
  )
}
