import { useRef } from 'react'
import { DesktopIcon } from '../components/DesktopIcon'
import { DesktopWindow } from '../components/DesktopWindow'
import { useWindowManager } from '../hooks/useWindowManager'
import '../styles/desktop.css'

export function DesktopScreen() {
  const viewportRef = useRef(null)
  const {
    windows,
    openWindow,
    bringToFront,
    closeWindow,
    toggleMinimize,
    toggleMaximize,
    startDrag
  } = useWindowManager(viewportRef)

  return (
    <main className="app">
      <div className="viewport desktop-screen" ref={viewportRef}>
        <div className="desktop-header">Desktop</div>
        <div className="desktop-icons">
          <DesktopIcon label="My Computer" onClick={() => openWindow('computer')}>
            <span className="icon-graphic computer" aria-hidden="true">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <rect x="8" y="10" width="48" height="32" rx="3" />
                <rect x="14" y="16" width="36" height="20" rx="2" />
                <rect x="26" y="44" width="12" height="4" rx="1" />
                <rect x="20" y="48" width="24" height="4" rx="1" />
              </svg>
            </span>
          </DesktopIcon>
          <DesktopIcon label="Case Files">
            <span className="icon-graphic folder" aria-hidden="true">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <path d="M8 20a4 4 0 0 1 4-4h14l6 6h20a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z" />
                <path d="M8 24h48v8H8z" />
              </svg>
            </span>
          </DesktopIcon>
        </div>
        {windows
          .filter((appWindow) => !appWindow.isMinimized)
          .map((appWindow) => {
            const style = appWindow.isMaximized
              ? { zIndex: appWindow.zIndex }
              : {
                  top: appWindow.y,
                  left: appWindow.x,
                  width: appWindow.width,
                  height: appWindow.height,
                  zIndex: appWindow.zIndex
                }
            return (
              <DesktopWindow
                key={appWindow.id}
                appWindow={appWindow}
                style={style}
                onFocus={() => bringToFront(appWindow.id)}
                onDragStart={(event) => startDrag(event, appWindow)}
                onMinimize={() => toggleMinimize(appWindow.id)}
                onMaximize={() => toggleMaximize(appWindow.id)}
                onClose={() => closeWindow(appWindow.id)}
              />
            )
          })}
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
                  toggleMinimize(appWindow.id)
                  bringToFront(appWindow.id)
                }}
              >
                <span className="taskbar-window-icon">PC</span>
                <span className="taskbar-window-label">{appWindow.title}</span>
              </button>
            ))}
          </div>
          <div className="taskbar-icons" aria-hidden="true">
            <div className="taskbar-icon app-green">NB</div>
            <div className="taskbar-icon app-slate">DM</div>
          </div>
        </div>
      </div>
    </main>
  )
}
